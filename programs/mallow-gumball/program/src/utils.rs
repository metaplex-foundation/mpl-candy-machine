use anchor_lang::prelude::*;
use arrayref::array_ref;
use mpl_core::{types::UpdateAuthority, Asset, Collection};
use solana_program::{
    account_info::AccountInfo,
    program_memory::sol_memcmp,
    pubkey::{Pubkey, PUBKEY_BYTES},
};
use utils::{assert_keys_equal, verify_proof};

use crate::{
    constants::{CONFIG_LINE_SIZE, GUMBALL_MACHINE_SIZE},
    ConfigLine, GumballError, GumballMachine, SellerHistory,
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

pub fn assert_can_add_item(
    gumball_machine: &mut Box<Account<GumballMachine>>,
    seller_history: &mut Box<Account<SellerHistory>>,
    seller_proof_path: Option<Vec<[u8; 32]>>,
) -> Result<()> {
    let seller = seller_history.seller;

    if seller == gumball_machine.authority {
        return Ok(());
    }

    if seller_history.item_count >= gumball_machine.settings.items_per_seller as u64 {
        return err!(GumballError::SellerTooManyItems);
    }

    if seller_proof_path.is_none() || gumball_machine.settings.sellers_merkle_root.is_none() {
        return err!(GumballError::InvalidProofPath);
    }

    let leaf = solana_program::keccak::hashv(&[seller.to_string().as_bytes()]);
    require!(
        verify_proof(
            &seller_proof_path.unwrap()[..],
            &gumball_machine.settings.sellers_merkle_root.unwrap(),
            &leaf.0,
        ),
        GumballError::InvalidProofPath
    );

    Ok(())
}

pub fn assert_config_line(
    gumball_machine: &Box<Account<GumballMachine>>,
    index: u32,
    config_line: ConfigLine,
) -> Result<()> {
    let account_info = gumball_machine.to_account_info();
    let data = account_info.data.borrow();
    let count = get_config_count(&data)?;

    if index >= count as u32 {
        return err!(GumballError::IndexGreaterThanLength);
    }

    let config_line_position = GUMBALL_MACHINE_SIZE + 4 + (index as usize) * CONFIG_LINE_SIZE;

    let mint = Pubkey::try_from(&data[config_line_position..config_line_position + 32]).unwrap();
    require!(config_line.mint == mint, GumballError::InvalidMint);

    let seller =
        Pubkey::try_from(&data[config_line_position + 32..config_line_position + 64]).unwrap();
    // Only the gumball machine authority or the seller can remove a config line
    require!(config_line.seller == seller, GumballError::InvalidSeller);

    let buyer =
        Pubkey::try_from(&data[config_line_position + 64..config_line_position + 96]).unwrap();
    require!(config_line.buyer == buyer, GumballError::InvalidBuyer);

    let token_standard = u8::from_le_bytes(*array_ref![data, config_line_position + 96, 1]);
    require!(
        config_line.token_standard as u8 == token_standard,
        GumballError::InvalidTokenStandard
    );

    drop(data);

    Ok(())
}

/// Return the current number of lines written to the account.
pub fn get_config_count(data: &[u8]) -> Result<usize> {
    Ok(u32::from_le_bytes(*array_ref![data, GUMBALL_MACHINE_SIZE, 4]) as usize)
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

pub fn get_bit_byte_info(base_position: usize, position: usize) -> Result<(usize, usize, u8)> {
    let byte_position = base_position
        + position
            .checked_div(8)
            .ok_or(GumballError::NumericalOverflowError)?;
    // bit index corresponding to the position of the line
    let bit = 7 - position
        .checked_rem(8)
        .ok_or(GumballError::NumericalOverflowError)?;
    let mask = u8::pow(2, bit as u32);

    return Ok((byte_position, bit, mask));
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
