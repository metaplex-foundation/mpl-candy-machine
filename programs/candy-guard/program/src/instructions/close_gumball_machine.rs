use super::Token;
use crate::state::{GumballGuard, SEED};
use anchor_lang::prelude::*;
use mallow_gumball::cpi::{accounts::CloseGumballMachine, withdraw as withdraw_cpi};

/// Withdraw the rent SOL from the gumball guard account, ensuring that Gumball Machine can also be closed.
#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(mut, close = authority, has_one = authority)]
    pub gumball_guard: Account<'info, GumballGuard>,
    #[account(mut)]
    pub authority: Signer<'info>,
    /// CHECK: Checked in gumball machine ix
    #[account(mut)]
    pub gumball_machine: UncheckedAccount<'info>,
    /// CHECK: Checked in gumball machine ix
    #[account(mut)]
    pub authority_pda: UncheckedAccount<'info>,
    /// Payment account for authority pda if using token payment
    /// CHECK: Checked in gumball machine ix
    #[account(mut)]
    pub authority_pda_payment_account: Option<UncheckedAccount<'info>>,

    /// CHECK: account constraints checked in account trait
    #[account(address = mallow_gumball::id())]
    pub gumball_machine_program: AccountInfo<'info>,

    pub token_program: Program<'info, Token>,
}

pub fn withdraw<'info>(ctx: Context<'_, '_, '_, 'info, Withdraw<'info>>) -> Result<()> {
    let gumball_guard = &ctx.accounts.gumball_guard;

    // PDA signer for the transaction
    let seeds = [SEED, &gumball_guard.base.to_bytes(), &[gumball_guard.bump]];
    let signer = [&seeds[..]];

    let gumball_machine_program = ctx.accounts.gumball_machine_program.to_account_info();
    let withdraw_ix = CloseGumballMachine {
        gumball_machine: ctx.accounts.gumball_machine.to_account_info(),
        authority: ctx.accounts.authority.to_account_info(),
        mint_authority: gumball_guard.to_account_info(),
        authority_pda: ctx.accounts.authority_pda.to_account_info(),
        authority_pda_payment_account: if let Some(authority_pda_payment_account) =
            &ctx.accounts.authority_pda_payment_account
        {
            Some(authority_pda_payment_account.to_account_info())
        } else {
            None
        },
        token_program: ctx.accounts.token_program.to_account_info(),
    };

    let cpi_ctx = CpiContext::new_with_signer(gumball_machine_program, withdraw_ix, &signer);
    withdraw_cpi(cpi_ctx)?;

    Ok(())
}
