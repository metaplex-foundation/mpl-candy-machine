use super::*;

use mpl_candy_machine_core::AccountVersion;
use mpl_token_metadata::{
    instruction::{builders::BurnBuilder, burn_nft, BurnArgs, InstructionBuilder},
    pda::find_token_record_account,
    state::{Metadata, TokenMetadataAccount, TokenStandard},
};
use solana_program::program::invoke;

use crate::{state::GuardType, utils::assert_keys_equal};

/// Guard that requires another NFT (token) from a specific collection to be burned.
///
/// List of accounts required:
///
///   0. `[writeable]` Token account of the NFT.
///   1. `[writeable]` Metadata account of the NFT.
///   2. `[writeable]` Master Edition account of the NFT.
///   3. `[writeable]` Mint account of the NFT.
///   4. `[writeable]` Collection metadata account of the NFT.
///   5. `[writeable]` Token Record of the NFT (pNFT).
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct NftBurn {
    pub required_collection: Pubkey,
}

impl Guard for NftBurn {
    fn size() -> usize {
        32 // required_collection
    }

    fn mask() -> u64 {
        GuardType::as_mask(GuardType::NftBurn)
    }
}

impl Condition for NftBurn {
    fn validate<'info>(
        &self,
        ctx: &mut EvaluationContext,
        _guard_set: &GuardSet,
        _mint_args: &[u8],
    ) -> Result<()> {
        let index = ctx.account_cursor;
        // validates that we received all required accounts
        let nft_account = try_get_account_info(ctx.accounts.remaining, index)?;
        let nft_metadata = try_get_account_info(ctx.accounts.remaining, index + 1)?;
        ctx.account_cursor += 2;

        NftGate::verify_collection(
            nft_account,
            nft_metadata,
            &self.required_collection,
            ctx.accounts.minter.key,
        )?;

        let _token_edition = try_get_account_info(ctx.accounts.remaining, index + 2)?;
        let nft_mint_account = try_get_account_info(ctx.accounts.remaining, index + 3)?;
        let _nft_mint_collection_metadata =
            try_get_account_info(ctx.accounts.remaining, index + 4)?;
        ctx.account_cursor += 3;

        let metadata: Metadata = Metadata::from_account_info(nft_metadata)?;
        // validates the account information
        assert_keys_equal(nft_metadata.owner, &mpl_token_metadata::id())?;
        assert_keys_equal(&metadata.mint, nft_mint_account.key)?;

        if matches!(
            metadata.token_standard,
            Some(TokenStandard::ProgrammableNonFungible)
        ) {
            let token_record_info = try_get_account_info(ctx.accounts.remaining, index + 5)?;
            ctx.account_cursor += 1;

            let (token_record_key, _) =
                find_token_record_account(nft_mint_account.key, nft_account.key);
            assert_keys_equal(&token_record_key, token_record_info.key)?;
        }

        ctx.indices.insert("nft_burn_index", index);

        Ok(())
    }

    fn pre_actions<'info>(
        &self,
        ctx: &mut EvaluationContext,
        _guard_set: &GuardSet,
        _mint_args: &[u8],
    ) -> Result<()> {
        let index = ctx.indices["nft_burn_index"];
        let nft_account = try_get_account_info(ctx.accounts.remaining, index)?;

        let nft_metadata = try_get_account_info(ctx.accounts.remaining, index + 1)?;
        let nft_edition = try_get_account_info(ctx.accounts.remaining, index + 2)?;
        let nft_mint_account = try_get_account_info(ctx.accounts.remaining, index + 3)?;
        let nft_mint_collection_metadata = try_get_account_info(ctx.accounts.remaining, index + 4)?;

        if matches!(ctx.accounts.candy_machine.version, AccountVersion::V2) {
            let mut builder = BurnBuilder::new();
            builder
                .authority(ctx.accounts.minter.key())
                .metadata(nft_metadata.key())
                .edition(nft_edition.key())
                .mint(nft_mint_account.key())
                .token(nft_account.key())
                .collection_metadata(nft_mint_collection_metadata.key());

            let mut burn_infos = vec![
                ctx.accounts.minter.to_account_info(),
                nft_metadata.to_account_info(),
                nft_edition.to_account_info(),
                nft_mint_account.to_account_info(),
                nft_account.to_account_info(),
                nft_mint_collection_metadata.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
                ctx.accounts.sysvar_instructions.to_account_info(),
                ctx.accounts.spl_token_program.to_account_info(),
            ];

            let metadata: Metadata = Metadata::from_account_info(nft_metadata)?;

            if matches!(
                metadata.token_standard,
                Some(TokenStandard::ProgrammableNonFungible)
            ) {
                let token_record_info = try_get_account_info(ctx.accounts.remaining, index + 5)?;
                builder.token_record(token_record_info.key());
                burn_infos.push(token_record_info.to_account_info());
            }

            let burn_ix = builder
                .build(BurnArgs::V1 { amount: 1 })
                .map_err(|_| CandyGuardError::InstructionBuilderFailed)?
                .instruction();

            invoke(&burn_ix, &burn_infos)?;
        } else {
            let burn_nft_infos = vec![
                nft_metadata.to_account_info(),
                ctx.accounts.payer.to_account_info(),
                nft_mint_account.to_account_info(),
                nft_account.to_account_info(),
                nft_edition.to_account_info(),
                ctx.accounts.spl_token_program.to_account_info(),
                nft_mint_collection_metadata.to_account_info(),
            ];

            invoke(
                &burn_nft(
                    mpl_token_metadata::ID,
                    nft_metadata.key(),
                    ctx.accounts.payer.key(),
                    nft_mint_account.key(),
                    nft_account.key(),
                    nft_edition.key(),
                    ::spl_token::ID,
                    Some(nft_mint_collection_metadata.key()),
                ),
                burn_nft_infos.as_slice(),
            )?;
        }

        Ok(())
    }
}
