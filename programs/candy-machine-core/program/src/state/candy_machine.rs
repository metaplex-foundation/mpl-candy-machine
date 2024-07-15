use anchor_lang::prelude::*;

use crate::{
    constants::{CANDY_MACHINE_SIZE, CONFIG_LINE_SIZE},
    CandyError,
};

/// Candy machine state and config data.
#[account]
#[derive(Debug)]
pub struct CandyMachine {
    /// Version of the account.
    pub version: u8,
    /// Authority address.
    pub authority: Pubkey,
    /// Authority address allowed to mint from the candy machine.
    pub mint_authority: Pubkey,
    /// Number of assets redeemed.
    pub items_redeemed: u64,
    /// Number of assets loaded at the time the sale started.
    pub finalized_items_count: u64,
    /// Number of assets settled after sale.
    pub items_settled: u64,
    /// True if the authority has finalized details, which prevents adding more nfts.
    pub state: GumballState,
    /// User-defined settings
    pub settings: GumballSettings,
    // hidden data section to avoid deserialisation:
    //
    // - (u32) how many actual lines of data there are currently (eventually
    //   equals item_capacity)
    // - (CONFIG_LINE_SIZE * item_capacity)
    // - (item_capacity / 8) + 1 bit mask to keep track of which ConfigLines
    //   have been added
    // - (u32 * item_capacity) mint indices
}

impl CandyMachine {
    /// Gets the size of the candy machine given the number of items.
    pub fn get_size(item_count: u64) -> usize {
        CANDY_MACHINE_SIZE
            + 4 // number of items inserted
            + (CONFIG_LINE_SIZE * item_count as usize) // config lines
            + (item_count as usize / 8) + 1 // bit mask tracking added lines
            + 4 + (4 * item_count as usize) // mint indices
    }

    pub fn get_loaded_items_bit_mask_position(&self) -> usize {
        CANDY_MACHINE_SIZE + 4 + (self.settings.item_capacity as usize) * CONFIG_LINE_SIZE
    }

    pub fn get_mint_indices_position(&self) -> Result<usize> {
        let position = self.get_loaded_items_bit_mask_position()
            + (self
                .settings
                .item_capacity
                .checked_div(8)
                .ok_or(CandyError::NumericalOverflowError)?
                + 1) as usize;

        Ok(position)
    }
}

/// Config line struct for storing asset (NFT) data pre-mint.
#[derive(AnchorSerialize, AnchorDeserialize, Debug)]
pub struct ConfigLineInput {
    /// Mint account of the asset.
    pub mint: Pubkey,
    /// Wallet that submitted the asset for sale.
    pub seller: Pubkey,
}

/// Config line struct for storing asset (NFT) data pre-mint.
#[derive(AnchorSerialize, AnchorDeserialize, Debug)]
pub struct ConfigLine {
    /// Mint account of the asset.
    pub mint: Pubkey,
    /// Wallet that submitted the asset for sale.
    pub seller: Pubkey,
    /// Wallet that will receive the asset upon sale. Empty until drawn.
    pub buyer: Pubkey,
    /// Token standard.
    pub token_standard: TokenStandard,
}

// Need to include this as it doesn't get picked up from mallow-utils by anchor idl generation
#[derive(Copy, AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, Debug)]
pub enum TokenStandard {
    NonFungible,
    Core,
}

#[derive(Copy, AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, Debug)]
pub enum GumballState {
    None,             // Initial state
    DetailsFinalized, // Sellers invited so only some details can be updated
    SaleLive, // Sale started, can now mint items. Cannot no longer update details or add items.
    SaleEnded, // Sale ended, can now settle items
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct GumballSettings {
    /// Uri of off-chain metadata, max length 196
    pub uri: String,
    /// Number of assets that can be added.
    pub item_capacity: u64,
    /// Max number of items that can be added by a single seller.
    pub items_per_seller: u16,
    /// Merkle root hash for sellers who can add items to the machine.
    pub sellers_merkle_root: Option<[u8; 32]>,
    /// Fee basis points paid to the machine authority.
    pub curator_fee_bps: u16,
    /// True if the front end should hide items that have been sold.
    pub hide_sold_items: bool,
}
