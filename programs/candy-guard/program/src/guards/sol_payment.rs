use super::*;

use mallow_gumball::constants::AUTHORITY_SEED;
use solana_program::{program::invoke, system_instruction};

use crate::{errors::GumballGuardError, state::GuardType, utils::assert_derivation};

/// Guard that charges an amount in SOL (lamports) for the mint.
///
/// List of accounts required:
///
///   0. `[]` Account to receive the funds.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct SolPayment {
    pub lamports: u64,
}

impl Guard for SolPayment {
    fn size() -> usize {
        8 // lamports
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

        require!(
            ctx.accounts.gumball_machine.settings.payment_mint == spl_token::native_mint::id(),
            GumballGuardError::InvalidPaymentMint
        );

        let seeds = [
            AUTHORITY_SEED.as_bytes(),
            ctx.accounts.gumball_machine.to_account_info().key.as_ref(),
        ];
        assert_derivation(&mallow_gumball::ID, destination, &seeds)?;

        ctx.account_cursor += 1;

        ctx.indices.insert("lamports_destination", index);

        if ctx.accounts.payer.lamports() < self.lamports {
            msg!(
                "Require {} lamports, accounts has {} lamports",
                self.lamports,
                ctx.accounts.payer.lamports(),
            );
            return err!(GumballGuardError::NotEnoughSOL);
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

        cpi_increment_total_revenue(ctx, self.lamports)?;

        Ok(())
    }
}
