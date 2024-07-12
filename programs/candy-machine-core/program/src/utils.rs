use anchor_lang::prelude::*;
use arrayref::array_ref;
use mpl_core::{types::UpdateAuthority, Asset, Collection};
use mpl_token_metadata::{
    accounts::{Edition, MasterEdition},
    types::Key,
};
use solana_program::{
    account_info::AccountInfo,
    program_memory::sol_memcmp,
    program_pack::{IsInitialized, Pack},
    pubkey::{Pubkey, PUBKEY_BYTES},
};

use crate::{constants::CANDY_MACHINE_SIZE, CandyError};

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

pub fn assert_initialized<T: Pack + IsInitialized>(account_info: &AccountInfo) -> Result<T> {
    let account: T = T::unpack_unchecked(&account_info.data.borrow())?;
    if !account.is_initialized() {
        Err(CandyError::Uninitialized.into())
    } else {
        Ok(account)
    }
}

pub fn assert_is_non_printable_edition(account: &AccountInfo) -> Result<()> {
    // Make sure we're listing a printed edition or a 1/1 master edition
    let edition = Edition::try_from(account);

    if edition.is_err() {
        return err!(CandyError::InvalidEditionAccount);
    }

    if edition.unwrap().key != Key::EditionV1 {
        let master_edition = MasterEdition::try_from(account);
        if master_edition.is_err() {
            return err!(CandyError::InvalidEditionAccount);
        }

        let master_edition_unwrapped = master_edition.unwrap();
        require!(
            master_edition_unwrapped.max_supply.is_some()
                && master_edition_unwrapped.max_supply.unwrap() == 0,
            CandyError::InvalidMasterEditionSupply
        );
    }

    Ok(())
}

pub fn assert_keys_equal(key1: Pubkey, key2: Pubkey, error_message: &str) -> Result<()> {
    if key1 != key2 {
        msg!("{}: actual: {} expected: {}", error_message, key1, key2);
        return err!(CandyError::PublicKeyMismatch);
    }

    Ok(())
}

/// Return the current number of lines written to the account.
pub fn get_config_count(data: &[u8]) -> Result<usize> {
    Ok(u32::from_le_bytes(*array_ref![data, CANDY_MACHINE_SIZE, 4]) as usize)
}

pub fn cmp_pubkeys(a: &Pubkey, b: &Pubkey) -> bool {
    sol_memcmp(a.as_ref(), b.as_ref(), PUBKEY_BYTES) == 0
}

pub fn get_core_asset_update_authority<'info>(
    asset_info: &AccountInfo<'info>,
    collection_info: Option<&AccountInfo<'info>>,
) -> Result<(Option<Pubkey>, Box<Asset>)> {
    // Considered a primary sale if owner is the update authority (most likely creator)
    let asset = Box::<Asset>::try_from(asset_info)?;
    match asset.base.update_authority {
        UpdateAuthority::Address(address) => {
            return Ok((Some(address), asset));
        }
        UpdateAuthority::Collection(collection_key) => {
            if let Some(collection_info) = collection_info {
                assert_keys_equal(
                    *collection_info.key,
                    collection_key,
                    "Invalid collection key",
                )?;
                let collection = Box::<Collection>::try_from(collection_info)?;
                return Ok((Some(collection.base.update_authority), asset));
            } else {
                return Ok((None, asset));
            }
        }
        UpdateAuthority::None => return Ok((None, asset)),
    }
}

pub fn verify_proof(proof: &[[u8; 32]], root: &[u8; 32], leaf: &[u8; 32]) -> bool {
    let mut computed_hash = *leaf;
    for proof_element in proof.iter() {
        if computed_hash <= *proof_element {
            // hash (current computed hash + current element of the proof)
            computed_hash = solana_program::keccak::hashv(&[&computed_hash, proof_element]).0
        } else {
            // hash (current element of the proof + current computed hash)
            computed_hash = solana_program::keccak::hashv(&[proof_element, &computed_hash]).0;
        }
    }
    // check if the computed hash (root) is equal to the provided root
    computed_hash == *root
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
