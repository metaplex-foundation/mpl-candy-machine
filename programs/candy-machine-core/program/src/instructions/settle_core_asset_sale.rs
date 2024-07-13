use anchor_lang::prelude::*;

use crate::{state::CandyMachine, CandyError, GumballState};

/// Disables minting and allows sales to be settled
#[derive(Accounts)]
pub struct SettleCoreAssetSale<'info> {
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

pub fn settle_core_asset_sale(ctx: Context<SettleCoreAssetSale>) -> Result<()> {
    Ok(())
}
