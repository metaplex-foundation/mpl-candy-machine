use anchor_lang::prelude::*;

use crate::{get_config_count, state::GumballMachine, GumballError, GumballSettings, GumballState};

/// Initializes a new gumball machine.
#[derive(Accounts)]
pub struct UpdateSettings<'info> {
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

pub fn update_settings(ctx: Context<UpdateSettings>, settings: GumballSettings) -> Result<()> {
    let gumball_machine = &mut ctx.accounts.gumball_machine;
    let account_info = gumball_machine.to_account_info();
    let account_data = account_info.data.borrow_mut();
    let items_loaded = get_config_count(&account_data)? as u64;

    // uri and sellers_merkle_root can always be changed

    // TODO: Allow decreasing capacity
    if settings.item_capacity != gumball_machine.settings.item_capacity {
        msg!("Cannot update item capacity");
        return err!(GumballError::InvalidSettingUpdate);
    }

    // Limit the possible updates when details are finalized or there are already items loaded
    if gumball_machine.state == GumballState::DetailsFinalized || items_loaded > 0 {
        // Can only increase items_per_seller
        if settings.items_per_seller < gumball_machine.settings.items_per_seller {
            msg!("Cannot decrease items_per_seller");
            return err!(GumballError::InvalidSettingUpdate);
        }
        // Can only decrease curator fee bps
        if settings.curator_fee_bps > gumball_machine.settings.curator_fee_bps {
            msg!("Cannot increase curator_fee_bps");
            return err!(GumballError::InvalidSettingUpdate);
        }

        // Cannot change hide_sold_items if others have been invited
        if gumball_machine.settings.sellers_merkle_root.is_some() &&
            settings.hide_sold_items != gumball_machine.settings.hide_sold_items {
            msg!("Cannot change hide_sold_items");
            return err!(GumballError::InvalidSettingUpdate);
        }
    }

    gumball_machine.settings = settings.clone();

    // Details are considered finalized once sellers are invited
    if settings.sellers_merkle_root.is_some() {
        gumball_machine.state = GumballState::DetailsFinalized;
    }

    Ok(())
}
