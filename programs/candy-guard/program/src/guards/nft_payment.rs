use mallow_gumball::constants::MPL_TOKEN_AUTH_RULES_PROGRAM;
use mpl_token_metadata::{
    accounts::{MasterEdition, Metadata, TokenRecord},
    instructions::TransferV1CpiBuilder,
    types::{ProgrammableConfig, TokenStandard},
};

use super::*;
use crate::{state::GuardType, utils::assert_keys_equal};

/// Guard that charges another NFT (token) from a specific collection as payment
/// for the mint.
///
/// List of accounts required:
///
///   0. `[writeable]` Token account of the NFT.
///   1. `[writeable]` Metadata account of the NFT.
///   2. `[]` Mint account of the NFT.
///   3. `[]` Account to receive the NFT.
///   4. `[writeable]` Destination PDA key (seeds [destination pubkey, token program id, nft mint pubkey]).
///   5. `[]` spl-associate-token program ID.
///   6. `[]` Master edition (pNFT)
///   7. `[writable]` Owner token record (pNFT)
///   8. `[writable]` Destination token record (pNFT)
///   9. `[]` Token Authorization Rules program (pNFT)
///   10. `[]` Token Authorization Rules account (pNFT)
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct NftPayment {
    pub required_collection: Pubkey,
    pub destination: Pubkey,
}

impl Guard for NftPayment {
    fn size() -> usize {
        32   // required_collection
        + 32 // destination
    }

    fn mask() -> u64 {
        GuardType::as_mask(GuardType::NftPayment)
    }
}

impl Condition for NftPayment {
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
        let nft_mint = try_get_account_info(ctx.accounts.remaining, index + 2)?;
        ctx.account_cursor += 3;

        NftGate::verify_collection(
            nft_account,
            nft_metadata,
            &self.required_collection,
            ctx.accounts.buyer.key,
        )?;

        let metadata: Metadata = Metadata::try_from(nft_metadata)?;
        assert_keys_equal(&metadata.mint, nft_mint.key)?;

        let destination = try_get_account_info(ctx.accounts.remaining, index + 3)?;
        let destination_ata = try_get_account_info(ctx.accounts.remaining, index + 4)?;

        let spl_ata_program = try_get_account_info(ctx.accounts.remaining, index + 5)?;
        assert_keys_equal(spl_ata_program.key, &spl_associated_token_account::ID)?;

        ctx.account_cursor += 3;

        assert_keys_equal(destination.key, &self.destination)?;

        let (ata, _) = Pubkey::find_program_address(
            &[
                destination.key.as_ref(),
                spl_token::ID.as_ref(),
                nft_mint.key.as_ref(),
            ],
            &spl_associated_token_account::ID,
        );

        assert_keys_equal(destination_ata.key, &ata)?;

        if matches!(
            metadata.token_standard,
            Some(TokenStandard::ProgrammableNonFungible)
        ) {
            let nft_master_edition = try_get_account_info(ctx.accounts.remaining, index + 6)?;
            let (nft_master_edition_key, _) = MasterEdition::find_pda(nft_mint.key);
            assert_keys_equal(&nft_master_edition_key, nft_master_edition.key)?;

            let owner_token_record = try_get_account_info(ctx.accounts.remaining, index + 7)?;
            let (owner_token_record_key, _) = TokenRecord::find_pda(nft_mint.key, nft_account.key);
            assert_keys_equal(&owner_token_record_key, owner_token_record.key)?;

            let destination_token_record = try_get_account_info(ctx.accounts.remaining, index + 8)?;
            let (destination_token_record_key, _) =
                TokenRecord::find_pda(nft_mint.key, destination_ata.key);
            assert_keys_equal(&destination_token_record_key, destination_token_record.key)?;

            ctx.account_cursor += 3;

            if let Some(ProgrammableConfig::V1 {
                rule_set: Some(rule_set),
            }) = metadata.programmable_config
            {
                let auth_rules_program = try_get_account_info(ctx.accounts.remaining, index + 9)?;
                assert_keys_equal(auth_rules_program.key, &MPL_TOKEN_AUTH_RULES_PROGRAM)?;

                let auth_rules = try_get_account_info(ctx.accounts.remaining, index + 10)?;
                assert_keys_equal(&rule_set, auth_rules.key)?;

                ctx.account_cursor += 2;
            }
        }

        ctx.indices.insert("nft_payment_index", index);

        Ok(())
    }

    fn pre_actions<'info>(
        &self,
        ctx: &mut EvaluationContext,
        _guard_set: &GuardSet,
        _mint_args: &[u8],
    ) -> Result<()> {
        let index = ctx.indices["nft_payment_index"];
        let nft_account = try_get_account_info(ctx.accounts.remaining, index)?;
        let nft_metadata = try_get_account_info(ctx.accounts.remaining, index + 1)?;
        let nft_mint = try_get_account_info(ctx.accounts.remaining, index + 2)?;
        let destination = try_get_account_info(ctx.accounts.remaining, index + 3)?;
        let destination_ata = try_get_account_info(ctx.accounts.remaining, index + 4)?;
        let spl_ata_program = try_get_account_info(ctx.accounts.remaining, index + 5)?;

        let mut transfer_cpi = TransferV1CpiBuilder::new(&ctx.accounts.token_metadata_program);
        transfer_cpi
            .token(nft_account)
            .token_owner(&ctx.accounts.buyer)
            .destination_token(destination_ata)
            .destination_owner(destination)
            .mint(nft_mint)
            .metadata(nft_metadata)
            .authority(&ctx.accounts.buyer)
            .payer(&ctx.accounts.payer)
            .system_program(&ctx.accounts.system_program)
            .sysvar_instructions(&ctx.accounts.sysvar_instructions)
            .spl_token_program(&ctx.accounts.spl_token_program)
            .spl_ata_program(spl_ata_program)
            .amount(1);

        let metadata: Metadata = Metadata::try_from(nft_metadata)?;

        if matches!(
            metadata.token_standard,
            Some(TokenStandard::ProgrammableNonFungible)
        ) {
            let nft_master_edition = try_get_account_info(ctx.accounts.remaining, index + 6)?;
            let owner_token_record = try_get_account_info(ctx.accounts.remaining, index + 7)?;
            let destination_token_record = try_get_account_info(ctx.accounts.remaining, index + 8)?;

            transfer_cpi
                .edition(Some(nft_master_edition))
                .token_record(Some(owner_token_record))
                .destination_token_record(Some(destination_token_record));

            if let Some(ProgrammableConfig::V1 { rule_set: Some(_) }) = metadata.programmable_config
            {
                let auth_rules_program = try_get_account_info(ctx.accounts.remaining, index + 9)?;
                let auth_rules = try_get_account_info(ctx.accounts.remaining, index + 10)?;

                transfer_cpi
                    .authorization_rules_program(Some(auth_rules_program))
                    .authorization_rules(Some(auth_rules));
            }
        }

        transfer_cpi.invoke()?;

        Ok(())
    }
}
