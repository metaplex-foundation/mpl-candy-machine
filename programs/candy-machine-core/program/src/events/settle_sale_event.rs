use anchor_lang::prelude::*;
use solana_program::pubkey::Pubkey;

use crate::FeeConfig;

#[event]
pub struct SettleSaleEvent {
    pub mint: Pubkey,
    pub authority: Pubkey,
    pub seller: Pubkey,
    pub buyer: Pubkey,
    pub amount: u64,
    pub payment_mint: Pubkey,
    pub fee_config: Option<FeeConfig>,
    pub curator_fee_bps: u16,
}
