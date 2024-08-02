use anchor_lang::prelude::*;
use crate::{
    CandyError, CandyMachine, GumballState
};

/// Increments total revenue. This is required as token transfers occur in guard.
#[derive(Accounts)]
pub struct IncrementTotalRevenue<'info> {
    /// Candy machine account.
    #[account(
        mut, 
        has_one = mint_authority,
        constraint = candy_machine.state == GumballState::SaleLive @ CandyError::InvalidState
    )]
    candy_machine: Box<Account<'info, CandyMachine>>,

    /// Candy machine mint authority (mint only allowed for the mint_authority).
    mint_authority: Signer<'info>,
}

pub fn increment_total_revenue<'info>(ctx: Context<'_, '_, '_, 'info, IncrementTotalRevenue<'info>>, revenue: u64) -> Result<()> {
    ctx.accounts.candy_machine.total_revenue = ctx.accounts.candy_machine.total_revenue
        .checked_add(revenue).ok_or(CandyError::NumericalOverflowError)?;
    
    Ok(())
}