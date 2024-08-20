use anchor_lang::prelude::*;

use crate::{get_config_count, state::GumballMachine, GumballError, GumballState};

/// Manually starts a sale.
#[derive(Accounts)]
pub struct StartSale<'info> {
    /// Gumball machine account.
    #[account(
        mut, 
        constraint = authority.key() == gumball_machine.authority || authority.key() == gumball_machine.mint_authority @ GumballError::InvalidAuthority,
        constraint = gumball_machine.state != GumballState::SaleLive && gumball_machine.state != GumballState::SaleEnded @ GumballError::InvalidState
    )]
    gumball_machine: Box<Account<'info, GumballMachine>>,

    /// Gumball Machine authority. This can be the mint authority or the authority.
    authority: Signer<'info>,
}

pub fn start_sale(ctx: Context<StartSale>) -> Result<()> {
    let gumball_machine = &mut ctx.accounts.gumball_machine;
    let account_info = gumball_machine.to_account_info();
    let data = account_info.data.borrow_mut();
    let count = get_config_count(&data)?;

    require!(count > 0, GumballError::GumballMachineEmpty);

    gumball_machine.state = GumballState::SaleLive;

    Ok(())
}