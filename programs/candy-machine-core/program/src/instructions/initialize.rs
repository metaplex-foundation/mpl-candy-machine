use crate::{
    constants::{AUTHORITY_SEED, CANDY_MACHINE_SIZE}, state::CandyMachine, CandyError, FeeConfig, GumballSettings,
    GumballState,
};
use anchor_lang::{prelude::*, Discriminator};
use mpl_token_metadata::MAX_URI_LENGTH;

/// Initializes a new candy machine.
#[derive(Accounts)]
#[instruction(settings: GumballSettings)]
pub struct Initialize<'info> {
    /// Candy Machine account. The account space must be allocated to allow accounts larger
    /// than 10kb.
    ///
    /// CHECK: account constraints checked in account trait
    #[account(
        zero,
        rent_exempt = skip,
        constraint = candy_machine.to_account_info().owner == __program_id && candy_machine.to_account_info().data_len() >= CandyMachine::get_size(settings.item_capacity)
    )]
    candy_machine: UncheckedAccount<'info>,

    /// Candy Machine authority. This is the address that controls the upate of the candy machine.
    ///
    /// CHECK: authority can be any account and is not written to or read
    authority: UncheckedAccount<'info>,

    /// CHECK: Safe due to seeds constraint
    #[account(
        init,
        payer = payer,
        space = 0,
        seeds = [
            AUTHORITY_SEED.as_bytes(), 
            candy_machine.key().as_ref()
        ],
        bump
    )]
    authority_pda: UncheckedAccount<'info>,

    /// Payer of the transaction.
    #[account(mut)]
    payer: Signer<'info>,

    system_program: Program<'info, System>,
}

pub fn initialize(
    ctx: Context<Initialize>,
    settings: GumballSettings,
    fee_config: Option<FeeConfig>,
) -> Result<()> {
    let candy_machine_account = &mut ctx.accounts.candy_machine;

    if settings.uri.len() >= MAX_URI_LENGTH - 4 {
        return err!(CandyError::UriTooLong);
    }

    // Details are considered finalized once sellers are invited
    let state = if settings.sellers_merkle_root.is_some() {
        GumballState::DetailsFinalized
    } else {
        GumballState::None
    };

    let candy_machine = CandyMachine {
        version: 0,
        authority: ctx.accounts.authority.key(),
        mint_authority: ctx.accounts.authority.key(),
        marketplace_fee_config: fee_config,
        items_redeemed: 0,
        finalized_items_count: 0,
        items_settled: 0,
        state,
        settings,
    };

    let mut struct_data = CandyMachine::discriminator().try_to_vec().unwrap();
    struct_data.append(&mut candy_machine.try_to_vec().unwrap());

    let mut account_data = candy_machine_account.data.borrow_mut();
    account_data[0..struct_data.len()].copy_from_slice(&struct_data);
    // set the initial number of config lines
    account_data[CANDY_MACHINE_SIZE..CANDY_MACHINE_SIZE + 4]
        .copy_from_slice(&u32::MIN.to_le_bytes());

    Ok(())
}
