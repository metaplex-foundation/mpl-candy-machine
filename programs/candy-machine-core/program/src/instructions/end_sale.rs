use anchor_lang::prelude::*;

use crate::{state::CandyMachine, CandyError, GumballState};

/// Disables minting and allows sales to be settled
#[derive(Accounts)]
pub struct EndSale<'info> {
    /// Candy machine account.
    #[account(
        mut, 
        has_one = authority,
        constraint = candy_machine.state != GumballState::SaleEnded @ CandyError::InvalidState
    )]
    candy_machine: Box<Account<'info, CandyMachine>>,

    /// Candy Machine authority. This is the address that controls the upate of the candy machine.
    #[account(mut)]
    authority: Signer<'info>,
}


pub fn end_sale(ctx: Context<EndSale>) -> Result<()> {
    ctx.accounts.candy_machine.state = GumballState::SaleEnded;

    Ok(())
}