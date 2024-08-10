use anchor_lang::prelude::*;

use crate::{get_config_count, state::GumballMachine, GumballError, GumballState};

/// Manually starts a sale.
#[derive(Accounts)]
pub struct StartSale<'info> {
    /// Gumball machine account.
    #[account(
        mut, 
        has_one = authority,
        constraint = gumball_machine.state != GumballState::SaleLive @ GumballError::InvalidState
    )]
    gumball_machine: Box<Account<'info, GumballMachine>>,

    /// Gumball Machine authority. This is the address that controls the upate of the gumball machine.
    #[account(mut)]
    authority: Signer<'info>,
}

pub fn start_sale(ctx: Context<StartSale>) -> Result<()> {
    let gumball_machine = &mut ctx.accounts.gumball_machine;
    let account_info = gumball_machine.to_account_info();
    let data = account_info.data.borrow_mut();
    let count = get_config_count(&data)?;

    require!(count > 0, GumballError::GumballMachineEmpty);

    gumball_machine.state = GumballState::SaleLive;
    gumball_machine.finalized_items_count = count as u64;

    Ok(())
}