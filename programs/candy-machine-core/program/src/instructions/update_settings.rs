use anchor_lang::prelude::*;

use crate::{get_config_count, state::CandyMachine, CandyError, GumballSettings, GumballState};

pub fn update_settings(ctx: Context<UpdateSettings>, settings: GumballSettings) -> Result<()> {
    let candy_machine = &mut ctx.accounts.candy_machine;
    let account_info = candy_machine.to_account_info();
    let account_data = account_info.data.borrow_mut();
    let config_count = get_config_count(&account_data)? as u64;

    // uri and sellers_merkle_root can always be changed

    // TODO: Allow decreasing capacity
    if settings.item_capacity != candy_machine.settings.item_capacity {
        return err!(CandyError::InvalidSettingUpdate);
    }

    // Limit the possible updates when details are finalized or there are already items loaded
    if candy_machine.state == GumballState::DetailsFinalized || config_count > 0 {
        // Can only increase items_per_seller
        if settings.items_per_seller < candy_machine.settings.items_per_seller {
            return err!(CandyError::InvalidSettingUpdate);
        }
        // Can only decrease curator fee bps
        if settings.curator_fee_bps > candy_machine.settings.curator_fee_bps {
            return err!(CandyError::InvalidSettingUpdate);
        }
        // Cannot change hide_sold_items
        if settings.hide_sold_items != candy_machine.settings.hide_sold_items {
            return err!(CandyError::InvalidSettingUpdate);
        }
    }

    candy_machine.settings = settings.clone();

    // Details are considered finalized once sellers are invited
    if settings.sellers_merkle_root.is_some() {
        candy_machine.state = GumballState::DetailsFinalized;
    }

    Ok(())
}

/// Initializes a new candy machine.
#[derive(Accounts)]
pub struct UpdateSettings<'info> {
    /// Candy machine account.
    #[account(
        mut, 
        has_one = authority,
        constraint = candy_machine.state != GumballState::SaleStarted @ CandyError::InvalidState
    )]
    candy_machine: Box<Account<'info, CandyMachine>>,

    /// Candy Machine authority. This is the address that controls the upate of the candy machine.
    #[account(mut)]
    authority: Signer<'info>,
}
