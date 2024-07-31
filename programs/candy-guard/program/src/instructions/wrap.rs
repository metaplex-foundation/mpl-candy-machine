use anchor_lang::prelude::*;
use mpl_candy_machine_core::{
    cpi::{accounts::SetMintAuthority, set_mint_authority},
    CandyMachine,
};

use crate::state::{CandyGuard, SEED};

pub fn wrap(ctx: Context<Wrap>) -> Result<()> {
    let candy_guard = &ctx.accounts.candy_guard;

    // PDA signer for the transaction
    let seeds = [SEED, &candy_guard.base.to_bytes(), &[candy_guard.bump]];
    let signer = [&seeds[..]];

    let candy_machine_program = ctx.accounts.candy_machine_program.to_account_info();
    let update_ix = SetMintAuthority {
        candy_machine: ctx.accounts.candy_machine.to_account_info(),
        authority: ctx.accounts.candy_machine_authority.to_account_info(),
        mint_authority: candy_guard.to_account_info(),
    };
    let cpi_ctx = CpiContext::new_with_signer(candy_machine_program, update_ix, &signer);
    // candy machine set_mint_authority CPI
    set_mint_authority(cpi_ctx)?;

    Ok(())
}

#[derive(Accounts)]
pub struct Wrap<'info> {
    #[account(has_one = authority)]
    pub candy_guard: Account<'info, CandyGuard>,
    // candy guard authority
    pub authority: Signer<'info>,
    #[account(
        mut,
        constraint = candy_machine.authority == candy_machine_authority.key(),
        owner = mpl_candy_machine_core::id()
    )]
    pub candy_machine: Account<'info, CandyMachine>,
    /// CHECK: account constraints checked in account trait
    #[account(address = mpl_candy_machine_core::id())]
    pub candy_machine_program: AccountInfo<'info>,
    // candy machine authority
    pub candy_machine_authority: Signer<'info>,
}
