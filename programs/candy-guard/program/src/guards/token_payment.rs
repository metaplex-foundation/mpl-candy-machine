use super::*;

use crate::{
    errors::CandyGuardError,
    state::GuardType,
    utils::{
        assert_initialized, assert_is_token_account, assert_keys_equal, spl_token_transfer,
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
        ctx: &mut EvaluationContext,
        _guard_set: &GuardSet,
        _mint_args: &[u8],
    ) -> Result<()> {
        // token
        let token_account_index = ctx.account_cursor;
        let token_account_info = try_get_account_info(ctx.accounts.remaining, token_account_index)?;
        let destination_ata =
            try_get_account_info(ctx.accounts.remaining, token_account_index + 1)?;
        ctx.account_cursor += 2;

        assert_keys_equal(destination_ata.key, &self.destination_ata)?;
        let ata_account: spl_token::state::Account = assert_initialized(destination_ata)?;
        assert_keys_equal(&ata_account.mint, &self.mint)?;

        let token_account =
            assert_is_token_account(token_account_info, ctx.accounts.buyer.key, &self.mint)?;

        if token_account.amount < self.amount {
            return err!(CandyGuardError::NotEnoughTokens);
        }

        ctx.indices
            .insert("token_payment_index", token_account_index);

        Ok(())
    }

    fn pre_actions<'info>(
        &self,
        ctx: &mut EvaluationContext,
        _guard_set: &GuardSet,
        _mint_args: &[u8],
    ) -> Result<()> {
        let index = ctx.indices["token_payment_index"];
        // the accounts have already been validated
        let token_account_info = try_get_account_info(ctx.accounts.remaining, index)?;
        let destination_ata = try_get_account_info(ctx.accounts.remaining, index + 1)?;

        spl_token_transfer(TokenTransferParams {
            source: token_account_info.to_account_info(),
            destination: destination_ata.to_account_info(),
            authority: ctx.accounts.buyer.to_account_info(),
            authority_signer_seeds: &[],
            token_program: ctx.accounts.spl_token_program.to_account_info(),
            amount: self.amount,
        })?;

        Ok(())
    }
}
