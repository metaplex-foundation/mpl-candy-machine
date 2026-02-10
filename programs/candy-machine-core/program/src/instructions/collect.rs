use anchor_lang::prelude::*;
use solana_program::rent::Rent;

use crate::{
    constants::{FEE_RECIPIENT_1, FEE_RECIPIENT_2},
    state::CandyMachine,
    CandyError,
};

/// Collect accumulated protocol fees from a candy machine account.
///
/// Fees are split evenly between two recipients. Any lamports above the rent-exempt
/// minimum are considered fees and can be collected.
pub fn collect(ctx: Context<Collect>) -> Result<()> {
    let candy_machine_info = ctx.accounts.candy_machine.to_account_info();
    let recipient1_info = ctx.accounts.recipient1.to_account_info();
    let recipient2_info = ctx.accounts.recipient2.to_account_info();

    // Calculate rent-exempt minimum for the candy machine account
    let rent = Rent::get()?;
    let rent_exempt_minimum = rent.minimum_balance(candy_machine_info.data_len());

    // Calculate available fees (lamports above rent-exempt minimum)
    let current_lamports = candy_machine_info.lamports();
    let fee_amount = current_lamports
        .checked_sub(rent_exempt_minimum)
        .ok_or(CandyError::NumericalOverflowError)?;

    // Nothing to collect if no fees accumulated
    if fee_amount == 0 {
        return Ok(());
    }

    // Split fees between two recipients (50% each)
    let recipient1_share = fee_amount / 2;
    let recipient2_share = fee_amount
        .checked_sub(recipient1_share)
        .ok_or(CandyError::NumericalOverflowError)?;

    // Transfer fees from candy machine to recipients
    **candy_machine_info.try_borrow_mut_lamports()? = rent_exempt_minimum;
    **recipient1_info.try_borrow_mut_lamports()? = recipient1_info
        .lamports()
        .checked_add(recipient1_share)
        .ok_or(CandyError::NumericalOverflowError)?;
    **recipient2_info.try_borrow_mut_lamports()? = recipient2_info
        .lamports()
        .checked_add(recipient2_share)
        .ok_or(CandyError::NumericalOverflowError)?;

    Ok(())
}

/// Collect accumulated protocol fees from the candy machine.
#[derive(Accounts)]
pub struct Collect<'info> {
    /// Candy Machine account.
    #[account(mut)]
    candy_machine: Account<'info, CandyMachine>,

    /// First fee recipient account.
    ///
    /// CHECK: validated against constant
    #[account(mut, address = FEE_RECIPIENT_1)]
    recipient1: UncheckedAccount<'info>,

    /// Second fee recipient account.
    ///
    /// CHECK: validated against constant
    #[account(mut, address = FEE_RECIPIENT_2)]
    recipient2: UncheckedAccount<'info>,
}
