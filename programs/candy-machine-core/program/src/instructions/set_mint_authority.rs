use anchor_lang::prelude::*;

use crate::GumballMachine;

/// Sets a new gumball machine authority.
#[derive(Accounts)]
pub struct SetMintAuthority<'info> {
    /// Gumball Machine account.
    #[account(mut, has_one = authority)]
    gumball_machine: Account<'info, GumballMachine>,

    /// Gumball Machine authority
    authority: Signer<'info>,

    /// New gumball machine authority
    mint_authority: Signer<'info>,
}

pub fn set_mint_authority(ctx: Context<SetMintAuthority>) -> Result<()> {
    let gumball_machine = &mut ctx.accounts.gumball_machine;

    gumball_machine.mint_authority = ctx.accounts.mint_authority.key();

    Ok(())
}
