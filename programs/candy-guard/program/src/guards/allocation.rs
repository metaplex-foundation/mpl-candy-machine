use super::*;
use crate::{
    state::GuardType,
    utils::{assert_keys_equal, assert_owned_by, cmp_pubkeys},
};
use solana_program::{program::invoke_signed, system_instruction};

/// Gaurd to specify the maximum number of mints in a guard set.
///
/// List of accounts required:
///
///   0. `[writable]` Allocation tracker PDA. The PDA is derived
///                   using the seed `["allocation", allocation id,
///                   gumball guard pubkey, gumball machine pubkey]`.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct Allocation {
    /// Unique identifier of the allocation.
    pub id: u8,
    /// The limit of the allocation.
    pub limit: u32,
}

/// PDA to track the number of mints.
#[derive(AnchorDeserialize, AnchorSerialize)]
pub struct AllocationTracker {
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
    ///                   gumball guard pubkey, gumball machine pubkey]`).
    ///   1. `[signer]` Gumball Guard authority.
    ///   2. `[]` System program account.
    fn instruction<'c: 'info, 'info>(
        ctx: &Context<'_, '_, 'c, 'info, Route<'info>>,
        route_context: RouteContext<'info>,
        _data: Vec<u8>,
    ) -> Result<()> {
        msg!("Instruction: Initialize (Allocation guard)");

        let allocation = try_get_account_info(ctx.remaining_accounts, 0)?;
        let authority = try_get_account_info(ctx.remaining_accounts, 1)?;
        let _system_program = try_get_account_info(ctx.remaining_accounts, 2)?;

        let gumball_guard = route_context
            .gumball_guard
            .as_ref()
            .ok_or(GumballGuardError::Uninitialized)?;

        let gumball_machine = route_context
            .gumball_machine
            .as_ref()
            .ok_or(GumballGuardError::Uninitialized)?;

        // only the authority can initialize the allocation
        if !(cmp_pubkeys(authority.key, &gumball_guard.authority) && authority.is_signer) {
            return err!(GumballGuardError::MissingRequiredSignature);
        }

        // and the gumball guard and gumball machine must be linked
        if !cmp_pubkeys(&gumball_machine.mint_authority, &gumball_guard.key()) {
            return err!(GumballGuardError::InvalidMintAuthority);
        }

        let allocation_id = if let Some(guard_set) = &route_context.guard_set {
            if let Some(allocation) = &guard_set.allocation {
                allocation.id
            } else {
                return err!(GumballGuardError::AllocationGuardNotEnabled);
            }
        } else {
            return err!(GumballGuardError::AllocationGuardNotEnabled);
        };

        let gumball_guard_key = &ctx.accounts.gumball_guard.key();
        let gumball_machine_key = &ctx.accounts.gumball_machine.key();

        let seeds = [
            b"allocation".as_ref(),
            &[allocation_id],
            gumball_guard_key.as_ref(),
            gumball_machine_key.as_ref(),
        ];
        let (pda, bump) = Pubkey::find_program_address(&seeds, &crate::ID);

        assert_keys_equal(allocation.key, &pda)?;

        if allocation.data_is_empty() {
            let signer = [
                b"allocation".as_ref(),
                &[allocation_id],
                gumball_guard_key.as_ref(),
                gumball_machine_key.as_ref(),
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
        let mut mint_tracker = AllocationTracker::try_from_slice(&account_data)?;
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

        let gumball_guard_key = &ctx.accounts.gumball_guard.key();
        let gumball_machine_key = &ctx.accounts.gumball_machine.key();

        let seeds = [
            b"allocation".as_ref(),
            &[self.id],
            gumball_guard_key.as_ref(),
            gumball_machine_key.as_ref(),
        ];
        let (pda, _) = Pubkey::find_program_address(&seeds, &crate::ID);

        assert_keys_equal(allocation.key, &pda)?;

        if allocation.data_is_empty() {
            // sanity check: if the limit is set to less than 1 we cannot proceed
            return err!(GumballGuardError::AllocationNotInitialized);
        } else {
            // make sure the account has the correct owner
            assert_owned_by(allocation, &crate::ID)?;
        }

        let account_data = allocation.try_borrow_data()?;
        let mint_tracker = AllocationTracker::try_from_slice(&account_data)?;

        if mint_tracker.count >= self.limit {
            return err!(GumballGuardError::AllocationLimitReached);
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
        let mut mint_tracker = AllocationTracker::try_from_slice(&account_data)?;

        mint_tracker.count += 1;
        // saves the changes back to the pda
        let data = &mut mint_tracker.try_to_vec().unwrap();
        account_data[0..data.len()].copy_from_slice(data);

        Ok(())
    }
}
