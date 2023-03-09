use mpl_candy_machine_core::{assert_edition_from_mint, AccountVersion};
use mpl_token_metadata::{
    instruction::{builders::TransferBuilder, InstructionBuilder, TransferArgs},
    pda::find_token_record_account,
    state::{Metadata, ProgrammableConfig, TokenMetadataAccount, TokenStandard},
};
use solana_program::program::invoke;
use spl_associated_token_account::instruction::create_associated_token_account;

use super::*;
use crate::{
    state::GuardType,
    utils::{assert_keys_equal, spl_token_transfer, TokenTransferParams},
};

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
            ctx.accounts.minter.key,
        )?;

        let metadata: Metadata = Metadata::from_account_info(nft_metadata)?;
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
            assert_edition_from_mint(nft_master_edition, nft_mint)?;

            let owner_token_record = try_get_account_info(ctx.accounts.remaining, index + 7)?;
            let (owner_token_record_key, _) =
                find_token_record_account(nft_mint.key, nft_account.key);
            assert_keys_equal(&owner_token_record_key, owner_token_record.key)?;

            let destination_token_record = try_get_account_info(ctx.accounts.remaining, index + 8)?;
            let (destination_token_record_key, _) =
                find_token_record_account(nft_mint.key, destination_ata.key);
            assert_keys_equal(&destination_token_record_key, destination_token_record.key)?;

            ctx.account_cursor += 3;

            if let Some(ProgrammableConfig::V1 {
                rule_set: Some(rule_set),
            }) = metadata.programmable_config
            {
                let auth_rules_program = try_get_account_info(ctx.accounts.remaining, index + 9)?;
                assert_keys_equal(auth_rules_program.key, &mpl_token_auth_rules::ID)?;

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

        if matches!(ctx.accounts.candy_machine.version, AccountVersion::V2) {
            let mut transfer_builder = TransferBuilder::new();

            transfer_builder
                .token(nft_account.key())
                .token_owner(ctx.accounts.minter.key())
                .destination(destination_ata.key())
                .destination_owner(destination.key())
                .mint(nft_mint.key())
                .metadata(nft_metadata.key())
                .authority(ctx.accounts.minter.key())
                .payer(ctx.accounts.payer.key());

            let mut transfer_infos = vec![
                nft_account.to_account_info(),
                ctx.accounts.minter.to_account_info(),
                ctx.accounts.payer.to_account_info(),
                destination_ata.to_account_info(),
                destination.to_account_info(),
                nft_mint.to_account_info(),
                nft_metadata.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
                ctx.accounts.sysvar_instructions.to_account_info(),
                ctx.accounts.spl_token_program.to_account_info(),
                spl_ata_program.to_account_info(),
            ];

            let metadata: Metadata = Metadata::from_account_info(nft_metadata)?;

            if matches!(
                metadata.token_standard,
                Some(TokenStandard::ProgrammableNonFungible)
            ) {
                let nft_master_edition = try_get_account_info(ctx.accounts.remaining, index + 6)?;
                let owner_token_record = try_get_account_info(ctx.accounts.remaining, index + 7)?;
                let destination_token_record =
                    try_get_account_info(ctx.accounts.remaining, index + 8)?;

                transfer_builder
                    .edition(nft_master_edition.key())
                    .owner_token_record(owner_token_record.key())
                    .destination_token_record(destination_token_record.key());

                transfer_infos.push(nft_master_edition.to_account_info());
                transfer_infos.push(owner_token_record.to_account_info());
                transfer_infos.push(destination_token_record.to_account_info());

                if let Some(ProgrammableConfig::V1 { rule_set: Some(_) }) =
                    metadata.programmable_config
                {
                    let auth_rules_program =
                        try_get_account_info(ctx.accounts.remaining, index + 9)?;
                    let auth_rules = try_get_account_info(ctx.accounts.remaining, index + 10)?;

                    transfer_builder
                        .authorization_rules_program(auth_rules_program.key())
                        .authorization_rules(auth_rules.key());
                    transfer_infos.push(auth_rules_program.to_account_info());
                    transfer_infos.push(auth_rules.to_account_info());
                }
            }

            let transfer_ix = transfer_builder
                .build(TransferArgs::V1 {
                    amount: 1,
                    authorization_data: None,
                })
                .map_err(|_| CandyGuardError::InstructionBuilderFailed)?
                .instruction();

            invoke(&transfer_ix, &transfer_infos)?;
        } else {
            // creates the ATA to receive the NFT

            invoke(
                &create_associated_token_account(
                    ctx.accounts.payer.key,
                    &self.destination,
                    nft_mint.key,
                    &spl_token::ID,
                ),
                &[
                    ctx.accounts.payer.to_account_info(),
                    destination_ata.to_account_info(),
                    destination.to_account_info(),
                    nft_mint.to_account_info(),
                    ctx.accounts.system_program.to_account_info(),
                ],
            )?;

            // transfers the NFT

            spl_token_transfer(TokenTransferParams {
                source: nft_account.to_account_info(),
                destination: destination_ata.to_account_info(),
                authority: ctx.accounts.payer.to_account_info(),
                authority_signer_seeds: &[],
                token_program: ctx.accounts.spl_token_program.to_account_info(),
                // fixed to always require 1 NFT
                amount: 1,
            })?;
        }

        Ok(())
    }
}
