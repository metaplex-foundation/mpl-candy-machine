use anchor_lang::prelude::*;

use crate::state::CandyGuard;

pub fn withdraw(_ctx: Context<Withdraw<'_>>) -> Result<()> {
    Ok(())
}

/// Withdraw the rent SOL from the candy guard account.
#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(mut, close = authority, has_one = authority)]
    candy_guard: Account<'info, CandyGuard>,
    #[account(mut)]
    authority: Signer<'info>,
}
