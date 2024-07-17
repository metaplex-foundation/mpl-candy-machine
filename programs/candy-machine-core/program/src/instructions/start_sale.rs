use anchor_lang::prelude::*;

use crate::{get_config_count, state::CandyMachine, CandyError, GumballState};

pub fn start_sale(ctx: Context<StartSale>) -> Result<()> {
    let candy_machine = &mut ctx.accounts.candy_machine;
    let account_info = candy_machine.to_account_info();
    let data = account_info.data.borrow_mut();
    let count = get_config_count(&data)?;

    require!(count > 0, CandyError::CandyMachineEmpty);

    candy_machine.state = GumballState::SaleLive;
    candy_machine.finalized_items_count = count as u64;

    // TODO: initialize payment token account if using payment token

    Ok(())
}

/// Allows sales to start.
#[derive(Accounts)]
pub struct StartSale<'info> {
    /// Candy machine account.
    #[account(
        mut, 
        has_one = authority,
        constraint = candy_machine.state != GumballState::SaleLive @ CandyError::InvalidState
    )]
    candy_machine: Box<Account<'info, CandyMachine>>,

    /// Candy Machine authority. This is the address that controls the upate of the candy machine.
    #[account(mut)]
    authority: Signer<'info>,
}
