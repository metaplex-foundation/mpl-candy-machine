use solana_program::{program::invoke_signed, system_instruction};

use super::*;
use crate::{
    state::GuardType,
    utils::{assert_keys_equal, assert_owned_by, cmp_pubkeys},
};

/// Gaurd to specify the maximum number of mints in a guard set.
///
/// List of accounts required:
///
///   0. `[writable]` Mint tracker PDA. The PDA is derived
///                   using the seed `["allocation", allocation id,
///                   candy guard pubkey, candy machine pubkey]`.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct Allocation {
    /// Unique identifier of the allocation.
    pub id: u8,
    /// The size of the allocation.
    pub size: u32,
}

/// PDA to track the number of mints.
#[derive(AnchorDeserialize, AnchorSerialize)]
pub struct MintTracker {
    pub count: u32,
}

impl Guard for Allocation {
    fn size() -> usize {
        1   // id
        + 4 // count
    }

    fn mask() -> u64 {
        GuardType::as_mask(GuardType::Allocation)
    }

    /// Instruction to initialize the allocation PDA.
    ///
    /// List of accounts required:
    ///
    ///   0. `[writable]` Pda to track the number of mints (seeds `["allocation", allocation id,
    ///                   candy guard pubkey, candy machine pubkey]`).
    ///   1. `[signer]` Candy Guard authority.
    ///   2. `[]` System program account.
    fn instruction<'info>(
        ctx: &Context<'_, '_, '_, 'info, Route<'info>>,
        route_context: RouteContext<'info>,
        _data: Vec<u8>,
    ) -> Result<()> {
        msg!("Instruction: Initialize (Allocation guard)");

        let allocation = try_get_account_info(ctx.remaining_accounts, 0)?;
        let authority = try_get_account_info(ctx.remaining_accounts, 1)?;
        let _system_program = try_get_account_info(ctx.remaining_accounts, 2)?;

        let candy_guard = route_context
            .candy_guard
            .as_ref()
            .ok_or(CandyGuardError::Uninitialized)?;

        let candy_machine = route_context
            .candy_machine
            .as_ref()
            .ok_or(CandyGuardError::Uninitialized)?;

        // only the authority can initialize the allocation
        if !(cmp_pubkeys(authority.key, &candy_guard.authority) && authority.is_signer) {
            return err!(CandyGuardError::MissingRequiredSignature);
        }

        // and the candy guard and candy machine must be linked
        if !cmp_pubkeys(&candy_machine.mint_authority, &candy_guard.key()) {
            return err!(CandyGuardError::InvalidMintAuthority);
        }

        let allocation_id = if let Some(guard_set) = &route_context.guard_set {
            if let Some(allocation) = &guard_set.allocation {
                allocation.id
            } else {
                return err!(CandyGuardError::AllocationGuardNotEnabled);
            }
        } else {
            return err!(CandyGuardError::AllocationGuardNotEnabled);
        };

        let candy_guard_key = &ctx.accounts.candy_guard.key();
        let candy_machine_key = &ctx.accounts.candy_machine.key();

        let seeds = [
            b"allocation".as_ref(),
            &[allocation_id],
            candy_guard_key.as_ref(),
            candy_machine_key.as_ref(),
        ];
        let (pda, bump) = Pubkey::find_program_address(&seeds, &crate::ID);

        assert_keys_equal(allocation.key, &pda)?;

        if allocation.data_is_empty() {
            let signer = [
                b"allocation".as_ref(),
                &[allocation_id],
                candy_guard_key.as_ref(),
                candy_machine_key.as_ref(),
                &[bump],
            ];
            let rent = Rent::get()?;

            invoke_signed(
                &system_instruction::create_account(
                    &ctx.accounts.payer.key(),
                    &pda,
                    rent.minimum_balance(std::mem::size_of::<u32>()),
                    std::mem::size_of::<u32>() as u64,
                    &crate::ID,
                ),
                &[
                    ctx.accounts.payer.to_account_info(),
                    allocation.to_account_info(),
                ],
                &[&signer],
            )?;
        } else {
            // if it an existing account, make sure it has the correct ownwer
            assert_owned_by(allocation, &crate::ID)?;
        }

        let mut account_data = allocation.try_borrow_mut_data()?;
        let mut mint_tracker = MintTracker::try_from_slice(&account_data)?;
        // initial count is always zero
        mint_tracker.count = 0;
        // saves the changes back to the pda
        let data = &mut mint_tracker.try_to_vec().unwrap();
        account_data[0..data.len()].copy_from_slice(data);

        Ok(())
    }
}

impl Condition for Allocation {
    fn validate<'info>(
        &self,
        ctx: &mut EvaluationContext,
        _guard_set: &GuardSet,
        _mint_args: &[u8],
    ) -> Result<()> {
        let allocation = try_get_account_info(ctx.accounts.remaining, ctx.account_cursor)?;
        ctx.indices.insert("allocation_index", ctx.account_cursor);
        ctx.account_cursor += 1;

        let candy_guard_key = &ctx.accounts.candy_guard.key();
        let candy_machine_key = &ctx.accounts.candy_machine.key();

        let seeds = [
            b"allocation".as_ref(),
            &[self.id],
            candy_guard_key.as_ref(),
            candy_machine_key.as_ref(),
        ];
        let (pda, _) = Pubkey::find_program_address(&seeds, &crate::ID);

        assert_keys_equal(allocation.key, &pda)?;

        if allocation.data_is_empty() {
            // sanity check: if the limit is set to less than 1 we cannot proceed
            return err!(CandyGuardError::AllocationNotInitialized);
        } else {
            // make sure the account has the correct owner
            assert_owned_by(allocation, &crate::ID)?;
        }

        let account_data = allocation.try_borrow_data()?;
        let mint_tracker = MintTracker::try_from_slice(&account_data)?;

        if mint_tracker.count >= self.size {
            return err!(CandyGuardError::AllocationLimitReached);
        }

        Ok(())
    }

    fn pre_actions<'info>(
        &self,
        ctx: &mut EvaluationContext,
        _guard_set: &GuardSet,
        _mint_args: &[u8],
    ) -> Result<()> {
        let allocation =
            try_get_account_info(ctx.accounts.remaining, ctx.indices["allocation_index"])?;
        let mut account_data = allocation.try_borrow_mut_data()?;
        let mut mint_tracker = MintTracker::try_from_slice(&account_data)?;

        mint_tracker.count += 1;
        // saves the changes back to the pda
        let data = &mut mint_tracker.try_to_vec().unwrap();
        account_data[0..data.len()].copy_from_slice(data);

        Ok(())
    }
}
