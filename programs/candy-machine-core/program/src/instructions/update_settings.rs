use anchor_lang::prelude::*;

use crate::{state::CandyMachine, CandyError, GumballSettings, GumballState};

pub fn update_settings(ctx: Context<UpdateSettings>, mut settings: GumballSettings) -> Result<()> {
    // TODO: Allow decreasing capacity
    settings.item_capacity = ctx.accounts.candy_machine.settings.item_capacity;

    match ctx.accounts.candy_machine.state {
        GumballState::None => {
            // Can update all settings initially
            ctx.accounts.candy_machine.settings = settings.clone();

            // Details are considered finalized once sellers are invited
            if settings.sellers_merkle_root.is_some() {
                ctx.accounts.candy_machine.state = GumballState::DetailsFinalized;
            }
        }

        GumballState::DetailsFinalized => {
            // Can only update sellers once details are finalized
            ctx.accounts.candy_machine.settings.sellers_merkle_root = settings.sellers_merkle_root;
        }

        _ => return err!(CandyError::InvalidState),
    }
    
    Ok(())
}

/// Initializes a new candy machine.
#[derive(Accounts)]
#[instruction(item_count: u64)]
pub struct UpdateSettings<'info> {
    /// Candy machine account.
    #[account(
        mut, 
        has_one = authority
    )]
    candy_machine: Box<Account<'info, CandyMachine>>,

    /// Candy Machine authority. This is the address that controls the upate of the candy machine.
    ///
    /// CHECK: authority can be any account and is not written to or read
    authority: UncheckedAccount<'info>,

    /// Payer of the transaction.
    #[account(mut)]
    payer: Signer<'info>,
}
