use anchor_lang::prelude::*;
use mpl_candy_machine_core::constants::{FEE_RECIPIENT_1, FEE_RECIPIENT_2};
use solana_program::rent::Rent;

use crate::{errors::CandyGuardError, state::CandyGuard};

/// Collect accumulated protocol fees from a candy guard account.
///
/// Fees are split evenly between two recipients. Any lamports above the rent-exempt
/// minimum are considered fees and can be collected.
pub fn collect(ctx: Context<Collect>) -> Result<()> {
    let candy_guard_info = ctx.accounts.candy_guard.to_account_info();
    let recipient1_info = ctx.accounts.recipient1.to_account_info();
    let recipient2_info = ctx.accounts.recipient2.to_account_info();

    // Calculate rent-exempt minimum for the candy guard account
    let rent = Rent::get()?;
    let rent_exempt_minimum = rent.minimum_balance(candy_guard_info.data_len());

    // Calculate available fees (lamports above rent-exempt minimum)
    let current_lamports = candy_guard_info.lamports();
    let fee_amount = current_lamports
        .checked_sub(rent_exempt_minimum)
        .ok_or(CandyGuardError::NumericalOverflowError)?;

    // Nothing to collect if no fees accumulated
    if fee_amount == 0 {
        return Ok(());
    }

    // Split fees between two recipients (50% each)
    let recipient1_share = fee_amount / 2;
    let recipient2_share = fee_amount
        .checked_sub(recipient1_share)
        .ok_or(CandyGuardError::NumericalOverflowError)?;

    // Transfer fees from candy guard to recipients
    **candy_guard_info.try_borrow_mut_lamports()? = rent_exempt_minimum;
    **recipient1_info.try_borrow_mut_lamports()? = recipient1_info
        .lamports()
        .checked_add(recipient1_share)
        .ok_or(CandyGuardError::NumericalOverflowError)?;
    **recipient2_info.try_borrow_mut_lamports()? = recipient2_info
        .lamports()
        .checked_add(recipient2_share)
        .ok_or(CandyGuardError::NumericalOverflowError)?;

    Ok(())
}

/// Collect accumulated protocol fees from the candy guard.
#[derive(Accounts)]
pub struct Collect<'info> {
    /// Candy Guard account.
    #[account(mut)]
    candy_guard: Account<'info, CandyGuard>,

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
