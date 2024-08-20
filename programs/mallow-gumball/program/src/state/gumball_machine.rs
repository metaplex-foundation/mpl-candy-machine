use anchor_lang::prelude::*;

use crate::{
    constants::{CONFIG_LINE_SIZE, GUMBALL_MACHINE_SIZE},
    GumballError,
};

/// Gumball machine state and config data.
#[account]
#[derive(Debug)]
pub struct GumballMachine {
    /// Version of the account.
    pub version: u8,
    /// Authority address.
    pub authority: Pubkey,
    /// Authority address allowed to mint from the gumball machine.
    pub mint_authority: Pubkey,
    /// Fee config for the marketplace this gumball is listed on
    pub marketplace_fee_config: Option<FeeConfig>,
    /// Number of assets redeemed.
    pub items_redeemed: u64,
    /// Number of assets settled after sale.
    pub items_settled: u64,
    /// Amount of lamports/tokens received from purchases.
    pub total_revenue: u64,
    /// True if the authority has finalized details, which prevents adding more nfts.
    pub state: GumballState,
    /// User-defined settings
    pub settings: GumballSettings,
    // hidden data section to avoid deserialisation:
    //
    // - (u32) how many actual lines of data there are currently (eventually
    //   equals item_capacity)
    // - (CONFIG_LINE_SIZE * item_capacity)
    // - (item_capacity / 8) + 1 bit mask to keep track of which items have been claimed
    // - (item_capacity / 8) + 1 bit mask to keep track of which items have been settled
    // - (u32 * item_capacity) mint indices
}

impl GumballMachine {
    /// Gets the size of the gumball machine given the number of items.
    pub fn get_size(item_count: u64) -> usize {
        GUMBALL_MACHINE_SIZE
            + 4 // number of items inserted
            + (CONFIG_LINE_SIZE * item_count as usize) // config lines
            + (item_count as usize / 8) + 1 // bit mask tracking claimed items
            + (item_count as usize / 8) + 1 // bit mask tracking settled items
            + 4 + (4 * item_count as usize) // mint indices
    }

    pub fn get_claimed_items_bit_mask_position(&self) -> usize {
        GUMBALL_MACHINE_SIZE + 4 + (self.settings.item_capacity as usize) * CONFIG_LINE_SIZE
    }

    pub fn get_settled_items_bit_mask_position(&self) -> Result<usize> {
        let mask_size = (self.settings.item_capacity)
            .checked_div(8)
            .ok_or(GumballError::NumericalOverflowError)? as usize;
        let position = self.get_claimed_items_bit_mask_position() + mask_size + 1;
        Ok(position)
    }

    pub fn get_mint_indices_position(&self) -> Result<usize> {
        let mask_size = (self.settings.item_capacity)
            .checked_div(8)
            .ok_or(GumballError::NumericalOverflowError)? as usize;
        let position = self.get_settled_items_bit_mask_position()? + mask_size + 1;
        Ok(position)
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug)]
pub struct FeeConfig {
    /// Where fees will go
    pub fee_account: Pubkey,
    /// Sale basis points for fees
    pub fee_bps: u16,
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
    /// Payment token for the mint
    pub payment_mint: Pubkey,
}
