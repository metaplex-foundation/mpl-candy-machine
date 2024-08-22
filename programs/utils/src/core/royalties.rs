use anchor_lang::prelude::*;
use mpl_core::{
    accounts::{BaseAssetV1, BaseCollectionV1},
    fetch_plugin,
    types::{PluginType, Royalties},
    Collection,
};
use mpl_token_metadata::types::Creator;

use crate::RoyaltyInfo;

use super::attributes::{get_update_authority, is_primary_sale};

pub fn get_verified_royalty_info<'a>(
    asset: &AccountInfo<'a>,
    collection: Option<&AccountInfo<'a>>,
    seller: Pubkey,
) -> Result<RoyaltyInfo> {
    let update_authority = get_update_authority(asset, collection)?;
    // TODO: Update this when there's a proper primary sale check
    let is_primary_sale = is_primary_sale(seller, update_authority)?;

    if let Ok(asset_royalties) =
        fetch_plugin::<BaseAssetV1, Royalties>(asset, PluginType::Royalties)
    {
        return Ok(RoyaltyInfo {
            is_primary_sale,
            seller_fee_basis_points: asset_royalties.1.basis_points,
            creators: asset_royalties
                .1
                .creators
                .iter()
                .map(|c| {
                    Some(Creator {
                        address: c.address,
                        verified: if let Some(update_authority) = update_authority {
                            c.address == update_authority
                        } else {
                            false
                        },
                        share: c.percentage,
                    })
                })
                .collect(),
        });
    }

    if let Some(collection) = collection {
        if let Ok(collection_royalties) =
            fetch_plugin::<BaseCollectionV1, Royalties>(collection, PluginType::Royalties)
        {
            return Ok(RoyaltyInfo {
                is_primary_sale,
                seller_fee_basis_points: collection_royalties.1.basis_points,
                creators: collection_royalties
                    .1
                    .creators
                    .iter()
                    .map(|c| {
                        Some(Creator {
                            address: c.address,
                            verified: if let Some(update_authority) = update_authority {
                                c.address == update_authority
                            } else {
                                false
                            },
                            share: c.percentage,
                        })
                    })
                    .collect(),
            });
        }
    }

    Ok(RoyaltyInfo {
        is_primary_sale,
        seller_fee_basis_points: 0,
        creators: None,
    })
}

pub fn get_master_edition_verified_royalty_info<'a>(
    collection: &AccountInfo<'a>,
) -> Result<RoyaltyInfo> {
    let is_primary_sale = true;

    if let Ok(asset_royalties) =
        fetch_plugin::<BaseCollectionV1, Royalties>(collection, PluginType::Royalties)
    {
        let collection = Box::<Collection>::try_from(collection)?;
        return Ok(RoyaltyInfo {
            is_primary_sale,
            seller_fee_basis_points: asset_royalties.1.basis_points,
            creators: asset_royalties
                .1
                .creators
                .iter()
                .map(|c| {
                    Some(Creator {
                        address: c.address,
                        verified: c.address == collection.base.update_authority,
                        share: c.percentage,
                    })
                })
                .collect(),
        });
    }

    Ok(RoyaltyInfo {
        is_primary_sale,
        seller_fee_basis_points: 0,
        creators: None,
    })
}
