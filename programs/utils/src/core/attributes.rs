use crate::assert_keys_equal;
use anchor_lang::prelude::*;
use mpl_core::types::UpdateAuthority;
use mpl_core::{Asset, Collection};

pub fn is_primary_sale<'info>(seller: Pubkey, update_authority: Option<Pubkey>) -> Result<bool> {
    if update_authority.is_none() {
        return Ok(false);
    }

    // Considered a primary sale if seller is the update authority (most likely creator)
    Ok(seller == update_authority.unwrap())
}

pub fn get_update_authority<'info>(
    asset_info: &AccountInfo<'info>,
    collection_info: Option<&AccountInfo<'info>>,
) -> Result<Option<Pubkey>> {
    // Considered a primary sale if owner is the update authority (most likely creator)
    let asset = Box::<Asset>::try_from(asset_info)?;
    match asset.base.update_authority {
        UpdateAuthority::Address(address) => {
            return Ok(Some(address));
        }
        UpdateAuthority::Collection(collection_key) => {
            if let Some(collection_info) = collection_info {
                assert_keys_equal(
                    collection_info.key(),
                    collection_key,
                    "Invalid collection key",
                )?;
                let collection = Box::<Collection>::try_from(collection_info)?;
                return Ok(Some(collection.base.update_authority));
            } else {
                return Ok(None);
            }
        }
        UpdateAuthority::None => return Ok(None),
    }
}
