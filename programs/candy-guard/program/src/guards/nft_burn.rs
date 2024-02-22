use super::*;

use mpl_token_metadata::{
    accounts::{Metadata, TokenRecord},
    instructions::BurnV1CpiBuilder,
    types::TokenStandard,
};

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
            ctx.accounts.buyer.key,
        )?;

        let _token_edition = try_get_account_info(ctx.accounts.remaining, index + 2)?;
        let nft_mint_account = try_get_account_info(ctx.accounts.remaining, index + 3)?;
        let _nft_mint_collection_metadata =
            try_get_account_info(ctx.accounts.remaining, index + 4)?;
        ctx.account_cursor += 3;

        let metadata: Metadata = Metadata::try_from(nft_metadata)?;
        // validates the account information
        assert_keys_equal(nft_metadata.owner, &mpl_token_metadata::ID)?;
        assert_keys_equal(&metadata.mint, nft_mint_account.key)?;

        if matches!(
            metadata.token_standard,
            Some(TokenStandard::ProgrammableNonFungible)
        ) {
            let token_record_info = try_get_account_info(ctx.accounts.remaining, index + 5)?;
            ctx.account_cursor += 1;

            let (token_record_key, _) =
                TokenRecord::find_pda(nft_mint_account.key, nft_account.key);
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

        let metadata: Metadata = Metadata::try_from(nft_metadata)?;
        let mut burn_cpi = BurnV1CpiBuilder::new(&ctx.accounts.token_metadata_program);
        burn_cpi
            .authority(&ctx.accounts.buyer)
            .metadata(nft_metadata)
            .edition(Some(nft_edition))
            .mint(nft_mint_account)
            .token(nft_account)
            .collection_metadata(Some(nft_mint_collection_metadata))
            .system_program(&ctx.accounts.system_program)
            .sysvar_instructions(&ctx.accounts.sysvar_instructions)
            .spl_token_program(&ctx.accounts.spl_token_program)
            .amount(1);

        if matches!(
            metadata.token_standard,
            Some(TokenStandard::ProgrammableNonFungible)
        ) {
            let token_record_info = try_get_account_info(ctx.accounts.remaining, index + 5)?;
            burn_cpi.token_record(Some(token_record_info));
        }

        burn_cpi.invoke()?;

        Ok(())
    }
}
