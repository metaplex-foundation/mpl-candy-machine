use solana_program::{program::invoke, program_pack::Pack};

use super::*;

use crate::{
    errors::CandyGuardError,
    state::GuardType,
    utils::{assert_initialized, assert_keys_equal, assert_owned_by},
};

/// Guard that charges an amount in a specified spl-token as payment for the mint.
///
/// List of accounts required:
///
///   0. `[writable]` Token account holding the required amount.
///   1. `[writable]` Address of the ATA to receive the tokens.
///   2. `[]` Mint account.
///   3. `[]` SPL token2022 program account.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct Token2022Payment {
    pub amount: u64,
    pub mint: Pubkey,
    pub destination_ata: Pubkey,
}

impl Guard for Token2022Payment {
    fn size() -> usize {
        8    // amount
        + 32 // token mint
        + 32 // destination ata
    }

    fn mask() -> u64 {
        GuardType::as_mask(GuardType::Token2022Payment)
    }
}

impl Condition for Token2022Payment {
    fn validate<'info>(
        &self,
        ctx: &mut EvaluationContext,
        _guard_set: &GuardSet,
        _mint_args: &[u8],
    ) -> Result<()> {
        // required accounts
        let token_account_index = ctx.account_cursor;
        let token_account_info = try_get_account_info(ctx.accounts.remaining, token_account_index)?;
        let destination_ata =
            try_get_account_info(ctx.accounts.remaining, token_account_index + 1)?;
        let mint_info = try_get_account_info(ctx.accounts.remaining, token_account_index + 2)?;
        let spl_token_2022_program =
            try_get_account_info(ctx.accounts.remaining, token_account_index + 3)?;
        ctx.account_cursor += 3;

        // destination
        assert_keys_equal(destination_ata.key, &self.destination_ata)?;
        let ata_account: spl_token_2022::state::Account = assert_initialized(destination_ata)?;
        assert_keys_equal(&ata_account.mint, &self.mint)?;

        // token
        assert_owned_by(token_account_info, &spl_token_2022::id())?;
        let token_account: spl_token_2022::state::Account = assert_initialized(token_account_info)?;
        assert_keys_equal(&token_account.owner, ctx.accounts.minter.key)?;
        assert_keys_equal(&token_account.mint, &self.mint)?;

        if token_account.amount < self.amount {
            return err!(CandyGuardError::NotEnoughTokens);
        }

        // mint
        assert_keys_equal(mint_info.key, &self.mint)?;

        // program
        assert_keys_equal(spl_token_2022_program.key, &spl_token_2022::ID)?;

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
        let mint_info = try_get_account_info(ctx.accounts.remaining, index + 2)?;
        let spl_token_2022_program = try_get_account_info(ctx.accounts.remaining, index + 3)?;

        let mint = spl_token_2022::state::Mint::unpack(&mint_info.data.borrow())?;

        invoke(
            &spl_token_2022::instruction::transfer_checked(
                spl_token_2022_program.key,
                token_account_info.key,
                &self.mint,
                destination_ata.key,
                ctx.accounts.minter.key,
                &[],
                self.amount,
                mint.decimals,
            )?,
            &[
                token_account_info.clone(),
                destination_ata.clone(),
                ctx.accounts.minter.clone(),
                spl_token_2022_program.clone(),
                mint_info.clone(),
            ],
        )?;

        Ok(())
    }
}
