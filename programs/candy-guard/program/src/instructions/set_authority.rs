use anchor_lang::prelude::*;

use crate::state::CandyGuard;

pub fn set_authority(ctx: Context<SetAuthority>, new_authority: Pubkey) -> Result<()> {
    let candy_guard = &mut ctx.accounts.candy_guard;

    candy_guard.authority = new_authority;

    Ok(())
}

#[derive(Accounts)]
pub struct SetAuthority<'info> {
    #[account(mut, has_one = authority)]
    candy_guard: Account<'info, CandyGuard>,
    authority: Signer<'info>,
}
