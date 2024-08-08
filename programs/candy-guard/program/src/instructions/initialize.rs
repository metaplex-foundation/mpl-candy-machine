use anchor_lang::prelude::*;

use crate::state::{GumballGuard, GumballGuardData, DATA_OFFSET, SEED};

pub fn initialize(ctx: Context<Initialize>, data: Vec<u8>) -> Result<()> {
    // deserializes the gumball guard data
    let data = GumballGuardData::load(&data)?;
    // validates guard settings
    data.verify()?;

    let gumball_guard = &mut ctx.accounts.gumball_guard;
    gumball_guard.base = ctx.accounts.base.key();
    gumball_guard.bump = ctx.bumps.gumball_guard;
    gumball_guard.authority = ctx.accounts.authority.key();

    let account_info = gumball_guard.to_account_info();
    let mut account_data = account_info.data.borrow_mut();

    data.save(&mut account_data[DATA_OFFSET..])
}

#[derive(Accounts)]
#[instruction(data: Vec<u8>)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = payer,
        space = DATA_OFFSET + data.len(),
        seeds = [SEED, base.key().as_ref()],
        bump
    )]
    pub gumball_guard: Account<'info, GumballGuard>,
    // Base key of the gumball guard PDA
    pub base: Signer<'info>,
    /// CHECK: authority can be any account and is not written to or read
    authority: UncheckedAccount<'info>,
    #[account(mut)]
    payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}
