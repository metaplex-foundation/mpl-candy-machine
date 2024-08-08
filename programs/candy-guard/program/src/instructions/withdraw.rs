use anchor_lang::prelude::*;

use crate::state::GumballGuard;

pub fn withdraw(_ctx: Context<Withdraw<'_>>) -> Result<()> {
    Ok(())
}

/// Withdraw the rent SOL from the gumball guard account.
#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(mut, close = authority, has_one = authority)]
    gumball_guard: Account<'info, GumballGuard>,
    #[account(mut)]
    authority: Signer<'info>,
}
