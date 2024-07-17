use anchor_lang::prelude::*;
use arrayref::array_ref;
use mpl_core::{types::UpdateAuthority, Asset, Collection};
use solana_program::{
    account_info::AccountInfo,
    program_memory::sol_memcmp,
    pubkey::{Pubkey, PUBKEY_BYTES},
};
use utils::{assert_keys_equal, verify_proof};

use crate::{constants::CANDY_MACHINE_SIZE, CandyError, CandyMachine, SellerHistory};

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

pub fn assert_can_add_item(
    candy_machine: &mut Box<Account<CandyMachine>>,
    seller_history: &mut Box<Account<SellerHistory>>,
    seller_proof_path: Option<Vec<[u8; 32]>>,
) -> Result<()> {
    let seller = seller_history.seller;

    if seller == candy_machine.authority {
        return Ok(());
    }

    if seller_history.item_count >= candy_machine.settings.items_per_seller as u64 {
        return err!(CandyError::SellerTooManyItems);
    }

    if seller_proof_path.is_none() || candy_machine.settings.sellers_merkle_root.is_none() {
        return err!(CandyError::InvalidProofPath);
    }

    let leaf = solana_program::keccak::hashv(&[seller.to_string().as_bytes()]);
    require!(
        verify_proof(
            &seller_proof_path.unwrap()[..],
            &candy_machine.settings.sellers_merkle_root.unwrap(),
            &leaf.0,
        ),
        CandyError::InvalidProofPath
    );

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
