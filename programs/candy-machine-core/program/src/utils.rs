use anchor_lang::prelude::*;
use arrayref::array_ref;
use mpl_token_metadata::{
    accounts::Metadata,
    instructions::{
        ApproveCollectionAuthorityCpiBuilder, DelegateCollectionV1CpiBuilder,
        RevokeCollectionAuthorityCpiBuilder, RevokeCollectionV1CpiBuilder,
    },
    types::TokenStandard,
};
use solana_program::{
    account_info::AccountInfo,
    entrypoint::ProgramResult,
    program::invoke,
    program_memory::sol_memcmp,
    program_pack::{IsInitialized, Pack},
    pubkey::{Pubkey, PUBKEY_BYTES},
    system_instruction,
};

use crate::{
    constants::{
        AUTHORITY_SEED, HIDDEN_SECTION, NULL_STRING, REPLACEMENT_INDEX, REPLACEMENT_INDEX_INCREMENT,
    },
    CandyError,
};

/// Anchor wrapper for Token program.
#[derive(Debug, Clone)]
pub struct Token;

impl anchor_lang::Id for Token {
    fn id() -> Pubkey {
        spl_token::id()
    }
}

/// Anchor wrapper for Associated Token program.
#[derive(Debug, Clone)]
pub struct AssociatedToken;

impl anchor_lang::Id for AssociatedToken {
    fn id() -> Pubkey {
        spl_associated_token_account::id()
    }
}

pub struct ApproveCollectionAuthorityHelperAccounts<'info> {
    /// CHECK: account checked in CPI
    pub payer: AccountInfo<'info>,
    /// CHECK: account checked in CPI
    pub authority_pda: AccountInfo<'info>,
    /// CHECK: account checked in CPI
    pub collection_update_authority: AccountInfo<'info>,
    /// CHECK: account checked in CPI
    pub collection_mint: AccountInfo<'info>,
    /// CHECK: account checked in CPI
    pub collection_metadata: AccountInfo<'info>,
    /// CHECK: account checked in CPI
    pub collection_authority_record: AccountInfo<'info>,
    /// CHECK: account checked in CPI
    pub token_metadata_program: AccountInfo<'info>,
    /// CHECK: account checked in CPI
    pub system_program: AccountInfo<'info>,
}

pub struct RevokeCollectionAuthorityHelperAccounts<'info> {
    /// CHECK: account checked in CPI
    pub authority_pda: AccountInfo<'info>,
    /// CHECK: account checked in CPI
    pub collection_mint: AccountInfo<'info>,
    /// CHECK: account checked in CPI
    pub collection_metadata: AccountInfo<'info>,
    /// CHECK: account checked in CPI
    pub collection_authority_record: AccountInfo<'info>,
    /// CHECK: account checked in CPI
    pub token_metadata_program: AccountInfo<'info>,
}

pub struct ApproveMetadataDelegateHelperAccounts<'info> {
    /// CHECK: account checked in CPI
    pub delegate_record: AccountInfo<'info>,
    /// CHECK: account checked in CPI
    pub authority_pda: AccountInfo<'info>,
    /// CHECK: account checked in CPI
    pub collection_metadata: AccountInfo<'info>,
    /// CHECK: account checked in CPI
    pub collection_mint: AccountInfo<'info>,
    /// CHECK: account checked in CPI
    pub collection_update_authority: AccountInfo<'info>,
    /// CHECK: account checked in CPI
    pub payer: AccountInfo<'info>,
    /// CHECK: account checked in CPI
    pub system_program: AccountInfo<'info>,
    /// CHECK: account checked in CPI
    pub sysvar_instructions: AccountInfo<'info>,
    /// CHECK: account checked in CPI
    pub authorization_rules_program: Option<AccountInfo<'info>>,
    /// CHECK: account checked in CPI
    pub authorization_rules: Option<AccountInfo<'info>>,
    /// CHECK: account checked in CPI
    pub token_metadata_program: AccountInfo<'info>,
}

pub struct RevokeMetadataDelegateHelperAccounts<'info> {
    /// CHECK: account checked in CPI
    pub delegate_record: AccountInfo<'info>,
    /// CHECK: account checked in CPI
    pub authority_pda: AccountInfo<'info>,
    /// CHECK: account checked in CPI
    pub collection_metadata: AccountInfo<'info>,
    /// CHECK: account checked in CPI
    pub collection_mint: AccountInfo<'info>,
    /// CHECK: account checked in CPI
    pub collection_update_authority: AccountInfo<'info>,
    /// CHECK: account checked in CPI
    pub payer: AccountInfo<'info>,
    /// CHECK: account checked in CPI
    pub system_program: AccountInfo<'info>,
    /// CHECK: account checked in CPI
    pub sysvar_instructions: AccountInfo<'info>,
    /// CHECK: account checked in CPI
    pub authorization_rules_program: Option<AccountInfo<'info>>,
    /// CHECK: account checked in CPI
    pub authorization_rules: Option<AccountInfo<'info>>,
    /// CHECK: account checked in CPI
    pub token_metadata_program: AccountInfo<'info>,
}

pub fn assert_initialized<T: Pack + IsInitialized>(account_info: &AccountInfo) -> Result<T> {
    let account: T = T::unpack_unchecked(&account_info.data.borrow())?;
    if !account.is_initialized() {
        Err(CandyError::Uninitialized.into())
    } else {
        Ok(account)
    }
}

/// Return the current number of lines written to the account.
pub fn get_config_count(data: &[u8]) -> Result<usize> {
    Ok(u32::from_le_bytes(*array_ref![data, HIDDEN_SECTION, 4]) as usize)
}

pub fn cmp_pubkeys(a: &Pubkey, b: &Pubkey) -> bool {
    sol_memcmp(a.as_ref(), b.as_ref(), PUBKEY_BYTES) == 0
}

/// Return a padded string up to the specified length. If the specified
/// string `value` is longer than the allowed `length`, return an error.
pub fn fixed_length_string(value: String, length: usize) -> Result<String> {
    if length < value.len() {
        // the value is larger than the allowed length
        return err!(CandyError::ExceededLengthError);
    }

    let padding = NULL_STRING.repeat(length - value.len());
    Ok(value + &padding)
}

/// Replace the index pattern variables on the specified string.
pub fn replace_patterns(value: String, index: usize) -> String {
    let mut mutable = value;
    // check for pattern $ID+1$
    if mutable.contains(REPLACEMENT_INDEX_INCREMENT) {
        mutable = mutable.replace(REPLACEMENT_INDEX_INCREMENT, &(index + 1).to_string());
    }
    // check for pattern $ID$
    if mutable.contains(REPLACEMENT_INDEX) {
        mutable = mutable.replace(REPLACEMENT_INDEX, &index.to_string());
    }

    mutable
}

pub fn approve_collection_authority_helper(
    accounts: ApproveCollectionAuthorityHelperAccounts,
) -> Result<()> {
    let ApproveCollectionAuthorityHelperAccounts {
        payer,
        authority_pda,
        collection_update_authority,
        collection_mint,
        collection_metadata,
        collection_authority_record,
        token_metadata_program,
        system_program,
    } = accounts;

    let collection_data: Metadata = Metadata::try_from(&collection_metadata)?;

    if !cmp_pubkeys(
        &collection_data.update_authority,
        &collection_update_authority.key(),
    ) {
        return err!(CandyError::IncorrectCollectionAuthority);
    }

    if !cmp_pubkeys(&collection_data.mint, &collection_mint.key()) {
        return err!(CandyError::MintMismatch);
    }

    // only approves a new delegate if the delegate account is empty
    // (i.e., it does not exist yet)
    if collection_authority_record.data_is_empty() {
        ApproveCollectionAuthorityCpiBuilder::new(&token_metadata_program)
            .collection_authority_record(&collection_authority_record)
            .new_collection_authority(&authority_pda)
            .metadata(&collection_metadata)
            .mint(&collection_mint)
            .update_authority(&collection_update_authority)
            .payer(&payer)
            .system_program(&system_program)
            .invoke()?;
    }

    Ok(())
}

pub fn revoke_collection_authority_helper(
    accounts: RevokeCollectionAuthorityHelperAccounts,
    candy_machine: Pubkey,
    signer_bump: u8,
    token_standard: Option<TokenStandard>,
) -> Result<()> {
    if matches!(token_standard, Some(TokenStandard::ProgrammableNonFungible)) {
        // pNFTs do not have a "legacy" collection authority, so we do not try to revoke
        // it. This would happen when the migration is completed and the candy machine
        // account version is still V1 - in any case, the "legacy" collection authority
        // is invalid since it does not apply to pNFTs and it will be replace by a
        // metadata delegate.
        Ok(())
    } else {
        RevokeCollectionAuthorityCpiBuilder::new(&accounts.token_metadata_program)
            .collection_authority_record(&accounts.collection_authority_record)
            .delegate_authority(&accounts.authority_pda)
            .revoke_authority(&accounts.authority_pda)
            .metadata(&accounts.collection_metadata)
            .mint(&accounts.collection_mint)
            .invoke_signed(&[&[
                AUTHORITY_SEED.as_bytes(),
                candy_machine.as_ref(),
                &[signer_bump],
            ]])
            .map_err(|error| error.into())
    }
}

pub fn approve_metadata_delegate(accounts: ApproveMetadataDelegateHelperAccounts) -> Result<()> {
    DelegateCollectionV1CpiBuilder::new(&accounts.token_metadata_program)
        .delegate_record(Some(&accounts.delegate_record))
        .delegate(&accounts.authority_pda)
        .mint(&accounts.collection_mint)
        .metadata(&accounts.collection_metadata)
        .payer(&accounts.payer)
        .authority(&accounts.collection_update_authority)
        .system_program(&accounts.system_program)
        .sysvar_instructions(&accounts.sysvar_instructions)
        .authorization_rules(accounts.authorization_rules.as_ref())
        .authorization_rules_program(accounts.authorization_rules_program.as_ref())
        .invoke()
        .map_err(|error| error.into())
}

pub fn revoke_metadata_delegate(
    accounts: RevokeMetadataDelegateHelperAccounts,
    candy_machine: Pubkey,
    signer_bump: u8,
) -> Result<()> {
    RevokeCollectionV1CpiBuilder::new(&accounts.token_metadata_program)
        .delegate_record(Some(&accounts.delegate_record))
        .delegate(&accounts.authority_pda)
        .mint(&accounts.collection_mint)
        .metadata(&accounts.collection_metadata)
        .payer(&accounts.payer)
        .authority(&accounts.authority_pda)
        .system_program(&accounts.system_program)
        .sysvar_instructions(&accounts.sysvar_instructions)
        .authorization_rules(accounts.authorization_rules.as_ref())
        .authorization_rules_program(accounts.authorization_rules_program.as_ref())
        .invoke_signed(&[&[
            AUTHORITY_SEED.as_bytes(),
            candy_machine.as_ref(),
            &[signer_bump],
        ]])
        .map_err(|error| error.into())
}

pub fn assert_token_standard(token_standard: u8) -> Result<()> {
    if token_standard == TokenStandard::NonFungible as u8
        || token_standard == TokenStandard::ProgrammableNonFungible as u8
    {
        Ok(())
    } else {
        err!(CandyError::InvalidTokenStandard)
    }
}

/// Resize an account using realloc, lifted from Solana Cookbook
pub fn resize_or_reallocate_account_raw<'a>(
    target_account: &AccountInfo<'a>,
    funding_account: &AccountInfo<'a>,
    system_program: &AccountInfo<'a>,
    new_size: usize,
) -> ProgramResult {
    let rent = Rent::get()?;
    let new_minimum_balance = rent.minimum_balance(new_size);

    let lamports_diff = new_minimum_balance.saturating_sub(target_account.lamports());
    invoke(
        &system_instruction::transfer(funding_account.key, target_account.key, lamports_diff),
        &[
            funding_account.clone(),
            target_account.clone(),
            system_program.clone(),
        ],
    )?;

    target_account.realloc(new_size, false)?;

    Ok(())
}

#[cfg(test)]
pub mod tests {
    use super::*;

    #[test]
    fn check_keys_equal() {
        let key1 = Pubkey::new_unique();
        assert!(cmp_pubkeys(&key1, &key1));
    }

    #[test]
    fn check_keys_not_equal() {
        let key1 = Pubkey::new_unique();
        let key2 = Pubkey::new_unique();
        assert!(!cmp_pubkeys(&key1, &key2));
    }
}
