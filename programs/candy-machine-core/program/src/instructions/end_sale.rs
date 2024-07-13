use anchor_lang::prelude::*;

use crate::{state::CandyMachine, CandyError, GumballState};

/// Disables minting and allows sales to be settled
#[derive(Accounts)]
pub struct EndSale<'info> {
    /// Candy machine account.
    #[account(
        mut, 
        has_one = authority,
        constraint = candy_machine.state != GumballState::AllSettled @ CandyError::InvalidState
    )]
    candy_machine: Box<Account<'info, CandyMachine>>,

    /// Candy Machine authority. This is the address that controls the upate of the candy machine.
    #[account(mut)]
    authority: Signer<'info>,
}


pub fn end_sale(ctx: Context<EndSale>) -> Result<()> {
    let candy_machine = &mut ctx.accounts.candy_machine;

    // The machine is settled if there were no sales
    candy_machine.state = if candy_machine.items_redeemed == 0 { 
        GumballState::AllSettled 
    } else {
        GumballState::SaleEnded
    };

    Ok(())
}