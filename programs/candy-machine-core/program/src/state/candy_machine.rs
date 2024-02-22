use anchor_lang::prelude::*;

use crate::constants::{CANDY_MACHINE_SIZE, CONFIG_LINE_SIZE};

/// Candy machine state and config data.
#[account]
#[derive(Default, Debug)]
pub struct CandyMachine {
    /// Version of the account.
    pub version: u8,
    /// Features flags.
    pub features: [u8; 6],
    /// Authority address.
    pub authority: Pubkey,
    /// Authority address allowed to mint from the candy machine.
    pub mint_authority: Pubkey,
    /// Number of assets redeemed.
    pub items_redeemed: u64,
    /// Number of assets available.
    pub items_available: u64,
    // hidden data section to avoid deserialisation:
    //
    // - (u32) how many actual lines of data there are currently (eventually
    //   equals items available)
    // - (CONFIG_LINE_SIZE * items_available)
    // - (item_available / 8) + 1 bit mask to keep track of which ConfigLines
    //   have been added
    // - (u32 * items_available) mint indices
}

impl CandyMachine {
    /// Gets the size of the candy machine given the number of items.
    pub fn get_size(item_count: u64) -> usize {
        CANDY_MACHINE_SIZE
            + 4
            + (CONFIG_LINE_SIZE * item_count as usize)
            + (item_count as usize / 8)
            + 1
            + (4 * item_count as usize)
    }
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
}
