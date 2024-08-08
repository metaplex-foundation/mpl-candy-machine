use anchor_lang::prelude::*;
use crate::{
    GumballError, GumballMachine, GumballState
};

/// Increments total revenue. This is required as token transfers occur in guard.
#[derive(Accounts)]
pub struct IncrementTotalRevenue<'info> {
    /// Gumball machine account.
    #[account(
        mut, 
        has_one = mint_authority,
        constraint = gumball_machine.state == GumballState::SaleLive @ GumballError::InvalidState
    )]
    gumball_machine: Box<Account<'info, GumballMachine>>,

    /// Gumball machine mint authority (mint only allowed for the mint_authority).
    mint_authority: Signer<'info>,
}

pub fn increment_total_revenue<'info>(ctx: Context<'_, '_, '_, 'info, IncrementTotalRevenue<'info>>, revenue: u64) -> Result<()> {
    ctx.accounts.gumball_machine.total_revenue = ctx.accounts.gumball_machine.total_revenue
        .checked_add(revenue).ok_or(GumballError::NumericalOverflowError)?;
    
    Ok(())
}