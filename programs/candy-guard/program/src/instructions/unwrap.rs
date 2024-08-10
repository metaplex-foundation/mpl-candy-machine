use crate::state::GumballGuard;
use anchor_lang::prelude::*;
use mallow_gumball::{
    cpi::{accounts::SetMintAuthority, set_mint_authority},
    GumballMachine,
};

pub fn unwrap(ctx: Context<Unwrap>) -> Result<()> {
    let gumball_machine_program = ctx.accounts.gumball_machine_program.to_account_info();
    let gumball_machine_authority = &ctx.accounts.gumball_machine_authority;

    let update_ix = SetMintAuthority {
        gumball_machine: ctx.accounts.gumball_machine.to_account_info(),
        authority: gumball_machine_authority.to_account_info(),
        mint_authority: gumball_machine_authority.to_account_info(),
    };
    let cpi_ctx = CpiContext::new(gumball_machine_program, update_ix);
    // gumball machine set_mint_authority CPI
    set_mint_authority(cpi_ctx)?;

    Ok(())
}

#[derive(Accounts)]
pub struct Unwrap<'info> {
    #[account(
        has_one = authority,
        constraint = gumball_guard.key() == gumball_machine.mint_authority
    )]
    pub gumball_guard: Account<'info, GumballGuard>,
    // gumball guard authority
    pub authority: Signer<'info>,
    #[account(
        mut,
        constraint = gumball_machine.authority == gumball_machine_authority.key()
    )]
    pub gumball_machine: Account<'info, GumballMachine>,
    // gumball machine authority
    pub gumball_machine_authority: Signer<'info>,
    /// CHECK: account constraints checked in account trait
    #[account(address = mallow_gumball::id())]
    pub gumball_machine_program: AccountInfo<'info>,
}
