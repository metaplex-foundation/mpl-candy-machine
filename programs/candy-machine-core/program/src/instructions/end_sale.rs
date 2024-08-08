use anchor_lang::prelude::*;

use crate::{state::GumballMachine, GumballError, GumballState};

/// Disables minting and allows sales to be settled
#[derive(Accounts)]
pub struct EndSale<'info> {
    /// Gumball machine account.
    #[account(
        mut, 
        has_one = authority,
        constraint = gumball_machine.state != GumballState::SaleEnded @ GumballError::InvalidState
    )]
    gumball_machine: Box<Account<'info, GumballMachine>>,

    /// Gumball Machine authority. This is the address that controls the upate of the gumball machine.
    #[account(mut)]
    authority: Signer<'info>,
}


pub fn end_sale(ctx: Context<EndSale>) -> Result<()> {
    ctx.accounts.gumball_machine.state = GumballState::SaleEnded;

    Ok(())
}