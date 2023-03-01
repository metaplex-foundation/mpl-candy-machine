use super::*;

use crate::{
    errors::CandyGuardError,
    state::GuardType,
    utils::{
        assert_initialized, assert_is_ata, assert_keys_equal, spl_token_transfer,
        TokenTransferParams,
    },
};

/// Guard that charges an amount in a specified spl-token as payment for the mint.
///
/// List of accounts required:
///
///   0. `[writable]` Token account holding the required amount.
///   1. `[writable]` Address of the ATA to receive the tokens.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct TokenPayment {
    pub amount: u64,
    pub mint: Pubkey,
    pub destination_ata: Pubkey,
}

impl Guard for TokenPayment {
    fn size() -> usize {
        8    // amount
        + 32 // token mint
        + 32 // destination ata
    }

    fn mask() -> u64 {
        GuardType::as_mask(GuardType::TokenPayment)
    }
}

impl Condition for TokenPayment {
    fn validate<'info>(
        &self,
        ctx: &Context<'_, '_, '_, 'info, Mint<'info>>,
        _mint_args: &[u8],
        _guard_set: &GuardSet,
        evaluation_context: &mut EvaluationContext,
    ) -> Result<()> {
        // token
        let token_account_index = evaluation_context.account_cursor;
        let token_account_info = try_get_account_info(ctx, token_account_index)?;
        let destination_ata = try_get_account_info(ctx, token_account_index + 1)?;
        evaluation_context.account_cursor += 2;

        assert_keys_equal(destination_ata.key, &self.destination_ata)?;
        let ata_account: spl_token::state::Account = assert_initialized(destination_ata)?;
        assert_keys_equal(&ata_account.mint, &self.mint)?;

        let token_account =
            assert_is_ata(token_account_info, &ctx.accounts.payer.key(), &self.mint)?;

        if token_account.amount < self.amount {
            return err!(CandyGuardError::NotEnoughTokens);
        }

        evaluation_context
            .indices
            .insert("token_payment_index", token_account_index);

        Ok(())
    }

    fn pre_actions<'info>(
        &self,
        ctx: &Context<'_, '_, '_, 'info, Mint<'info>>,
        _mint_args: &[u8],
        _guard_set: &GuardSet,
        evaluation_context: &mut EvaluationContext,
    ) -> Result<()> {
        let index = evaluation_context.indices["token_payment_index"];
        // the accounts have already been validated
        let token_account_info = try_get_account_info(ctx, index)?;
        let destination_ata = try_get_account_info(ctx, index + 1)?;

        spl_token_transfer(TokenTransferParams {
            source: token_account_info.to_account_info(),
            destination: destination_ata.to_account_info(),
            authority: ctx.accounts.payer.to_account_info(),
            authority_signer_seeds: &[],
            token_program: ctx.accounts.token_program.to_account_info(),
            amount: self.amount,
        })?;

        Ok(())
    }
}
