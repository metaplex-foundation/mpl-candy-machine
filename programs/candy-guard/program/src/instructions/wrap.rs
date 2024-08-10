use crate::state::{GumballGuard, SEED};
use anchor_lang::prelude::*;
use mallow_gumball::{
    cpi::{accounts::SetMintAuthority, set_mint_authority},
    GumballMachine,
};

pub fn wrap(ctx: Context<Wrap>) -> Result<()> {
    let gumball_guard = &ctx.accounts.gumball_guard;

    // PDA signer for the transaction
    let seeds = [SEED, &gumball_guard.base.to_bytes(), &[gumball_guard.bump]];
    let signer = [&seeds[..]];

    let gumball_machine_program = ctx.accounts.gumball_machine_program.to_account_info();
    let update_ix = SetMintAuthority {
        gumball_machine: ctx.accounts.gumball_machine.to_account_info(),
        authority: ctx.accounts.gumball_machine_authority.to_account_info(),
        mint_authority: gumball_guard.to_account_info(),
    };
    let cpi_ctx = CpiContext::new_with_signer(gumball_machine_program, update_ix, &signer);
    // gumball machine set_mint_authority CPI
    set_mint_authority(cpi_ctx)?;

    Ok(())
}

#[derive(Accounts)]
pub struct Wrap<'info> {
    #[account(has_one = authority)]
    pub gumball_guard: Account<'info, GumballGuard>,
    // gumball guard authority
    pub authority: Signer<'info>,
    #[account(
        mut,
        constraint = gumball_machine.authority == gumball_machine_authority.key(),
        owner = mallow_gumball::id()
    )]
    pub gumball_machine: Account<'info, GumballMachine>,
    /// CHECK: account constraints checked in account trait
    #[account(address = mallow_gumball::id())]
    pub gumball_machine_program: AccountInfo<'info>,
    // gumball machine authority
    pub gumball_machine_authority: Signer<'info>,
}
