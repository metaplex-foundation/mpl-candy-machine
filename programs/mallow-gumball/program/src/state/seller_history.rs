use anchor_lang::prelude::*;

/// Seller history state to track count of items submitted to a gumball machine.
#[account]
#[derive(Debug)]
pub struct SellerHistory {
    /// Gumball machine we're tracking for
    pub gumball_machine: Pubkey,
    /// Seller address
    pub seller: Pubkey,
    /// Item count submitted by this seller
    pub item_count: u64,
}

impl SellerHistory {
    pub const SPACE: usize = 8 //discriminator
    + 32 // gumball machine
    + 32 // seller
    + 8; // item count
}
