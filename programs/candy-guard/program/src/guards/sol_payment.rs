use super::*;

use solana_program::{program::invoke, system_instruction};

use crate::{errors::CandyGuardError, state::GuardType, utils::assert_keys_equal};

/// Guard that charges an amount in SOL (lamports) for the mint.
///
/// List of accounts required:
///
///   0. `[]` Account to receive the funds.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct SolPayment {
    pub lamports: u64,
    pub destination: Pubkey,
}

impl Guard for SolPayment {
    fn size() -> usize {
        8    // lamports
        + 32 // destination
    }

    fn mask() -> u64 {
        GuardType::as_mask(GuardType::SolPayment)
    }
}

impl Condition for SolPayment {
    fn validate<'info>(
        &self,
        ctx: &mut EvaluationContext,
        _guard_set: &GuardSet,
        _mint_args: &[u8],
    ) -> Result<()> {
        let index = ctx.account_cursor;
        // validates that we received all required accounts
        let destination = try_get_account_info(ctx.accounts.remaining, index)?;
        ctx.account_cursor += 1;
        // validates the account information
        assert_keys_equal(destination.key, &self.destination)?;

        ctx.indices.insert("lamports_destination", index);

        if ctx.accounts.payer.lamports() < self.lamports {
            msg!(
                "Require {} lamports, accounts has {} lamports",
                self.lamports,
                ctx.accounts.payer.lamports(),
            );
            return err!(CandyGuardError::NotEnoughSOL);
        }

        Ok(())
    }

    fn pre_actions<'info>(
        &self,
        ctx: &mut EvaluationContext,
        _guard_set: &GuardSet,
        _mint_args: &[u8],
    ) -> Result<()> {
        let destination =
            try_get_account_info(ctx.accounts.remaining, ctx.indices["lamports_destination"])?;

        invoke(
            &system_instruction::transfer(
                &ctx.accounts.payer.key(),
                &destination.key(),
                self.lamports,
            ),
            &[
                ctx.accounts.payer.to_account_info(),
                destination.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
        )?;

        Ok(())
    }
}
