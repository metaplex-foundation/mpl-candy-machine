use super::*;

use mpl_token_metadata::{
    instruction::burn_nft,
    state::{Metadata, TokenMetadataAccount},
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
        ctx: &Context<'_, '_, '_, 'info, Mint<'info>>,
        _mint_args: &[u8],
        _guard_set: &GuardSet,
        evaluation_context: &mut EvaluationContext,
    ) -> Result<()> {
        let index = evaluation_context.account_cursor;
        // validates that we received all required accounts
        let nft_account = try_get_account_info(ctx, index)?;
        let nft_metadata = try_get_account_info(ctx, index + 1)?;
        evaluation_context.account_cursor += 2;

        NftGate::verify_collection(
            nft_account,
            nft_metadata,
            &self.required_collection,
            ctx.accounts.payer.key,
        )?;

        let _token_edition = try_get_account_info(ctx, index + 2)?;
        let nft_mint_account = try_get_account_info(ctx, index + 3)?;
        let _nft_mint_collection_metadata = try_get_account_info(ctx, index + 4)?;
        evaluation_context.account_cursor += 3;

        let metadata: Metadata = Metadata::from_account_info(nft_metadata)?;
        // validates the account information
        assert_keys_equal(nft_metadata.owner, &mpl_token_metadata::id())?;
        assert_keys_equal(&metadata.mint, nft_mint_account.key)?;

        evaluation_context.indices.insert("nft_burn_index", index);

        Ok(())
    }

    fn pre_actions<'info>(
        &self,
        ctx: &Context<'_, '_, '_, 'info, Mint<'info>>,
        _mint_args: &[u8],
        _guard_set: &GuardSet,
        evaluation_context: &mut EvaluationContext,
    ) -> Result<()> {
        let index = evaluation_context.indices["nft_burn_index"];
        let nft_account = try_get_account_info(ctx, index)?;

        let nft_metadata = try_get_account_info(ctx, index + 1)?;
        let nft_edition = try_get_account_info(ctx, index + 2)?;
        let nft_mint_account = try_get_account_info(ctx, index + 3)?;
        let nft_mint_collection_metadata = try_get_account_info(ctx, index + 4)?;

        let burn_nft_infos = vec![
            nft_metadata.to_account_info(),
            ctx.accounts.payer.to_account_info(),
            nft_mint_account.to_account_info(),
            nft_account.to_account_info(),
            nft_edition.to_account_info(),
            ctx.accounts.token_program.to_account_info(),
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

        Ok(())
    }
}
