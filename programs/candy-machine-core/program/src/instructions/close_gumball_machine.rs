use anchor_lang::prelude::*;

use crate::{CandyError, CandyMachine, GumballState};

/// Withdraw the rent SOL from the candy machine account.
#[derive(Accounts)]
pub struct CloseGumballMachine<'info> {
    /// Candy Machine acccount.
    #[account(
        mut, 
        close = authority, 
        has_one = authority, 
        constraint = candy_machine.state == GumballState::AllSettled @ CandyError::InvalidState
    )]
    candy_machine: Account<'info, CandyMachine>,

    /// Authority of the candy machine.
    #[account(mut)]
    authority: Signer<'info>,
}

pub fn close_gumball_machine(_ctx: Context<CloseGumballMachine>) -> Result<()> {
    Ok(())
}
