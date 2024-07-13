use anchor_lang::prelude::*;

use crate::{state::CandyMachine, CandyError, GumballState};

/// Disables minting and allows sales to be settled
#[derive(Accounts)]
pub struct SettleNftSale<'info> {
    /// Candy machine account.
    #[account(
        mut,
        constraint = candy_machine.state == GumballState::SaleEnded @ CandyError::InvalidState
    )]
    candy_machine: Box<Account<'info, CandyMachine>>,

    /// Anyone can settle the sale
    #[account(mut)]
    payer: Signer<'info>,
}

pub fn settle_nft_sale(ctx: Context<SettleNftSale>) -> Result<()> {
    Ok(())
}
