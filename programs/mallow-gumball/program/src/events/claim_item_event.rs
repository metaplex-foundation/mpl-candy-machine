use anchor_lang::prelude::*;
use solana_program::pubkey::Pubkey;

#[event]
pub struct ClaimItemEvent {
    pub mint: Pubkey,
    pub authority: Pubkey,
    pub seller: Pubkey,
    pub buyer: Pubkey,
}
