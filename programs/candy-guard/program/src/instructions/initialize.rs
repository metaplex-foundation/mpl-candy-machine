use anchor_lang::prelude::*;

use crate::state::{CandyGuard, CandyGuardData, DATA_OFFSET, SEED};

pub fn initialize(ctx: Context<Initialize>, data: Vec<u8>) -> Result<()> {
    // deserializes the candy guard data
    let data = CandyGuardData::load(&data)?;
    // validates guard settings
    data.verify()?;

    let candy_guard = &mut ctx.accounts.candy_guard;
    candy_guard.base = ctx.accounts.base.key();
    candy_guard.bump = *ctx.bumps.get("candy_guard").unwrap();
    candy_guard.authority = ctx.accounts.authority.key();

    let account_info = candy_guard.to_account_info();
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
    pub candy_guard: Account<'info, CandyGuard>,
    // Base key of the candy guard PDA
    pub base: Signer<'info>,
    /// CHECK: authority can be any account and is not written to or read
    authority: UncheckedAccount<'info>,
    #[account(mut)]
    payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}
