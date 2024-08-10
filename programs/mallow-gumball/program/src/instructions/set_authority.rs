use anchor_lang::prelude::*;

use crate::GumballMachine;

/// Sets a new gumball machine authority.
#[derive(Accounts)]
pub struct SetAuthority<'info> {
    /// Gumball Machine account.
    #[account(mut, has_one = authority)]
    gumball_machine: Account<'info, GumballMachine>,

    /// Autority of the gumball machine.
    authority: Signer<'info>,
}

pub fn set_authority(ctx: Context<SetAuthority>, new_authority: Pubkey) -> Result<()> {
    let gumball_machine = &mut ctx.accounts.gumball_machine;

    gumball_machine.authority = new_authority;

    Ok(())
}
