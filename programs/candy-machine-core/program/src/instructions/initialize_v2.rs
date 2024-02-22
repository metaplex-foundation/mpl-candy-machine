use anchor_lang::{prelude::*, Discriminator};

use crate::{constants::CANDY_MACHINE_SIZE, state::CandyMachine};

pub fn initialize_v2(ctx: Context<InitializeV2>, item_count: u64) -> Result<()> {
    let candy_machine_account = &mut ctx.accounts.candy_machine;

    let candy_machine = CandyMachine {
        version: 0,
        features: [0u8; 6],
        authority: ctx.accounts.authority.key(),
        mint_authority: ctx.accounts.authority.key(),
        items_redeemed: 0,
        items_available: item_count,
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

/// Initializes a new candy machine.
#[derive(Accounts)]
#[instruction(item_count: u64)]
pub struct InitializeV2<'info> {
    /// Candy Machine account. The account space must be allocated to allow accounts larger
    /// than 10kb.
    ///
    /// CHECK: account constraints checked in account trait
    #[account(
        zero,
        rent_exempt = skip,
        constraint = candy_machine.to_account_info().owner == __program_id && candy_machine.to_account_info().data_len() >= CandyMachine::get_size(item_count)
    )]
    candy_machine: UncheckedAccount<'info>,

    /// Candy Machine authority. This is the address that controls the upate of the candy machine.
    ///
    /// CHECK: authority can be any account and is not written to or read
    authority: UncheckedAccount<'info>,

    /// Payer of the transaction.
    #[account(mut)]
    payer: Signer<'info>,
}
