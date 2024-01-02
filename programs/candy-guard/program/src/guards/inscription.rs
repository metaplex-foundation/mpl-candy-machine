use mpl_inscription::{
    accounts::{InscriptionMetadata, InscriptionShard},
    instructions::{InitializeFromMintCpi, InitializeFromMintCpiAccounts},
};

use super::*;

use crate::{
    state::{GuardType, SEED},
    utils::*,
};

/// Guard inscribes the NFT data in the pre and post steps.
///
/// List of accounts required:
///
///   0. `[writable]` The Mint Inscription PDA.
///   1. `[writable]` The Mint Inscription Metadata PDA.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct Inscription {}

impl Guard for Inscription {
    fn size() -> usize {
        0
    }

    fn mask() -> u64 {
        GuardType::as_mask(GuardType::Inscription)
    }
}

impl Condition for Inscription {
    fn validate<'info>(
        &self,
        ctx: &mut EvaluationContext,
        _guard_set: &GuardSet,
        mint_args: &[u8],
    ) -> Result<()> {
        // required accounts
        let inscription_account_index = ctx.account_cursor;
        let nft_ata = try_get_account_info(ctx.accounts.remaining, inscription_account_index)?;
        let inscription_account_info =
            try_get_account_info(ctx.accounts.remaining, inscription_account_index + 1)?;
        let inscription_metadata_account_info =
            try_get_account_info(ctx.accounts.remaining, inscription_account_index + 2)?;
        let inscription_shard_account_info =
            try_get_account_info(ctx.accounts.remaining, inscription_account_index + 3)?;
        let inscription_program_info =
            try_get_account_info(ctx.accounts.remaining, inscription_account_index + 4)?;
        ctx.account_cursor += 5;

        if nft_ata.data_is_empty() {
            // for unitialized accounts, we need to check the derivation since the
            // account will be created during mint only if it is an ATA

            let (derivation, _) = Pubkey::find_program_address(
                &[
                    ctx.accounts.minter.key.as_ref(),
                    spl_token::id().as_ref(),
                    ctx.accounts.nft_mint.key.as_ref(),
                ],
                &spl_associated_token_account::id(),
            );

            assert_keys_equal(&derivation, nft_ata.key)?;
        } else {
            // validates if the existing account is a token account
            assert_is_token_account(nft_ata, ctx.accounts.minter.key, ctx.accounts.nft_mint.key)?;
        }

        // Validate the inscription account PDA.
        let mint_inscription_seeds = [
            "Inscription".as_bytes(),
            mpl_inscription::ID.as_ref(),
            ctx.accounts.nft_mint.key.as_ref(),
        ];

        let (mint_inscription_pda, _mint_inscription_bump) =
            Pubkey::find_program_address(&mint_inscription_seeds, &mpl_inscription::ID);

        assert_keys_equal(&mint_inscription_pda, inscription_account_info.key)?;

        // Validate the inscription metadata account PDA.
        let (inscription_metadata_pda, _inscription_metadata_bump) =
            InscriptionMetadata::find_pda(&mint_inscription_pda);

        assert_keys_equal(
            &inscription_metadata_pda,
            inscription_metadata_account_info.key,
        )?;

        // Validate the inscription shard account PDA.
        let (inscription_shard_pda, _inscription_shard_bump) =
            InscriptionShard::find_pda(mint_args[0]);

        assert_keys_equal(&inscription_shard_pda, inscription_shard_account_info.key)?;

        // Validate the inscription program account.
        assert_keys_equal(inscription_program_info.key, &mpl_inscription::ID)?;

        ctx.indices
            .insert("inscription_index", inscription_account_index);

        Ok(())
    }

    fn post_actions<'info>(
        &self,
        ctx: &mut EvaluationContext,
        _guard_set: &GuardSet,
        _mint_args: &[u8],
    ) -> Result<()> {
        let index = ctx.indices["inscription_index"];
        // the accounts have already been validated
        let nft_ata = try_get_account_info(ctx.accounts.remaining, index)?;
        let inscription_account_info = try_get_account_info(ctx.accounts.remaining, index + 1)?;
        let inscription_metadata_account_info =
            try_get_account_info(ctx.accounts.remaining, index + 2)?;
        let inscription_shard_account_info =
            try_get_account_info(ctx.accounts.remaining, index + 3)?;
        let inscription_program_info = try_get_account_info(ctx.accounts.remaining, index + 4)?;

        let init_cpi = InitializeFromMintCpi::new(
            inscription_program_info,
            InitializeFromMintCpiAccounts {
                mint_inscription_account: inscription_account_info,
                metadata_account: inscription_metadata_account_info,
                mint_account: &ctx.accounts.nft_mint,
                token_metadata_account: &ctx.accounts.nft_metadata,
                token_account: nft_ata,
                inscription_shard_account: inscription_shard_account_info,
                payer: &ctx.accounts.payer,
                system_program: &ctx.accounts.system_program,
            },
        );

        // PDA signer for the transaction
        let seeds = [
            SEED,
            &ctx.accounts.candy_guard.base.to_bytes(),
            &[ctx.accounts.candy_guard.bump],
        ];
        let signer = [&seeds[..]];

        init_cpi.invoke_signed(&signer)?;

        Ok(())
    }
}
