use anchor_lang::prelude::*;
use solana_program::pubkey::Pubkey;

use crate::FeeConfig;

#[event]
pub struct SettleItemSaleEvent {
    pub mint: Pubkey,
    pub authority: Pubkey,
    pub seller: Pubkey,
    pub buyer: Pubkey,
    pub total_proceeds: u64,
    pub payment_mint: Pubkey,
    pub fee_config: Option<FeeConfig>,
    pub curator_fee_bps: u16,
}
