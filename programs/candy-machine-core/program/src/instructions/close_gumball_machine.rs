use anchor_lang::prelude::*;

use crate::{get_config_count, CandyError, CandyMachine};

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
        CandyError::InvalidState
    );

    // TODO: close payment account if using payment token
    // token::close_account(
    //     CpiContext::new(
    //         token_program.to_account_info(),
    //         CloseAccount {
    //             account: escrow_currency_account.to_account_info(),
    //             destination: seller.to_account_info(),
    //             authority: auction_config.to_account_info(),
    //         },
    //     )
    //     .with_signer(&[&auth_seeds[..]]),
    // )?;

    Ok(())
}
