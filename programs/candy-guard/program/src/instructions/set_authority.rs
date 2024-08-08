use anchor_lang::prelude::*;

use crate::state::GumballGuard;

pub fn set_authority(ctx: Context<SetAuthority>, new_authority: Pubkey) -> Result<()> {
    let gumball_guard = &mut ctx.accounts.gumball_guard;

    gumball_guard.authority = new_authority;

    Ok(())
}

#[derive(Accounts)]
pub struct SetAuthority<'info> {
    #[account(mut, has_one = authority)]
    gumball_guard: Account<'info, GumballGuard>,
    authority: Signer<'info>,
}
