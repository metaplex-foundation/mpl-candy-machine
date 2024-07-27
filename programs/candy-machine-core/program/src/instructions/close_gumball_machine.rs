use anchor_lang::prelude::*;
use solana_program::program::invoke_signed;
use spl_token::instruction::close_account;
use utils::{assert_is_ata, is_native_mint};

use crate::{constants::AUTHORITY_SEED, get_config_count, CandyError, CandyMachine, Token};

/// Withdraw the rent SOL from the candy machine account.
#[derive(Accounts)]
pub struct CloseGumballMachine<'info> {
    /// Candy Machine acccount.
    #[account(
        mut, 
        close = authority, 
        has_one = authority, 
    )]
    candy_machine: Account<'info, CandyMachine>,

    /// Authority of the candy machine.
    #[account(mut)]
    authority: Signer<'info>,

    /// CHECK: Safe due to seeds constraint
    #[account(
        mut,
        seeds = [
            AUTHORITY_SEED.as_bytes(), 
            candy_machine.key().as_ref()
        ],
        bump
    )]
    authority_pda: UncheckedAccount<'info>,

    /// Payment account for authority pda if using token payment
    /// CHECK: Safe due to ata check in processor
    #[account(mut)]
    authority_pda_payment_account: Option<UncheckedAccount<'info>>,

    token_program: Program<'info, Token>,
}

pub fn close_gumball_machine(ctx: Context<CloseGumballMachine>) -> Result<()> {
    let account_info = ctx.accounts.candy_machine.to_account_info();
    let account_data = account_info.data.borrow();
    let config_count = get_config_count(&account_data)? as u64;

    // No items added so it's safe to close the account
    if config_count == 0 {
        return Ok(());
    }

    // Ensure all items have been settled/claimed
    require!(
        config_count == ctx.accounts.candy_machine.items_settled,
        CandyError::NotAllSettled
    );

    let token_program = &ctx.accounts.token_program.to_account_info();
    let authority = &ctx.accounts.authority.to_account_info();
    let authority_pda = &ctx.accounts.authority_pda.to_account_info();
    let payment_mint = ctx.accounts.candy_machine.settings.payment_mint;

    let auth_seeds = [
        AUTHORITY_SEED.as_bytes(),
        ctx.accounts.candy_machine.to_account_info().key.as_ref(),
        &[ctx.bumps.authority_pda],
    ];

    // Close payment account if using payment token
    if !is_native_mint(payment_mint) {
        let authority_pda_payment_account = &ctx.accounts.authority_pda_payment_account.as_ref().unwrap().to_account_info();

        if !authority_pda_payment_account.data_is_empty() {
            assert_is_ata(authority_pda_payment_account, authority_pda.key, &payment_mint)?;

            let close_ix = close_account(
                token_program.key, 
                authority_pda_payment_account.key,
                authority.key, 
                authority_pda.key, 
                &[]
            )?;

            invoke_signed(
                &close_ix,
                &[
                    token_program.to_account_info(),
                    authority_pda_payment_account.to_account_info(),
                    authority_pda.to_account_info(),
                    authority.to_account_info(),
                ],
                &[&auth_seeds]
            )?;
        }
    }

    Ok(())
}
