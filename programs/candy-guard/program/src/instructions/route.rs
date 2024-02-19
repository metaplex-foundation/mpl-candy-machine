use anchor_lang::prelude::*;
use mpl_candy_machine_core::CandyMachine;

use crate::{
    state::{CandyGuard, CandyGuardData, GuardSet, GuardType, DATA_OFFSET},
    try_from,
};

/// Route the transaction to the specified guard. This instruction allows the use of
/// empty candy guard and candy machine accounts and it is up to individual guard
/// instructions to validate whether the instruction can be executed or not.
pub fn route<'c: 'info, 'info>(
    ctx: Context<'_, '_, 'c, 'info, Route<'info>>,
    args: RouteArgs,
    label: Option<String>,
) -> Result<()> {
    // checks if the candy guard account is not empty
    let candy_guard_account = if ctx.accounts.candy_guard.data_is_empty() {
        None
    } else {
        let account = try_from!(Account::<CandyGuard>, ctx.accounts.candy_guard)?;
        Some(account)
    };

    // checks if the candy machine account is not empty

    let candy_machine = &ctx.accounts.candy_machine;
    let candy_machine_account = if candy_machine.to_account_info().data_is_empty() {
        None
    } else {
        let account = try_from!(Account::<CandyMachine>, ctx.accounts.candy_machine)?;
        Some(Box::new(account))
    };

    // retrieve the active guard set

    let guard_set = if let Some(account) = &candy_guard_account {
        let account_info = account.to_account_info();
        let data = account_info.data.borrow();
        // loads the active guard set
        let guard_set = CandyGuardData::active_set(&data[DATA_OFFSET..], label)?;

        Some(guard_set)
    } else {
        None
    };

    let route_context = RouteContext {
        candy_guard: candy_guard_account,
        candy_machine: candy_machine_account,
        guard_set,
    };

    GuardSet::route(ctx, route_context, args)
}

/// Withdraw the rent SOL from the candy guard account.
#[derive(Accounts)]
#[instruction(args: RouteArgs)]
pub struct Route<'info> {
    /// CHECK: account constraints checked in instruction
    pub candy_guard: UncheckedAccount<'info>,
    /// CHECK: account constraints checked in instruction
    #[account(mut)]
    pub candy_machine: UncheckedAccount<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
}

/// Arguments for a route transaction.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct RouteArgs {
    /// The target guard type.
    pub guard: GuardType,
    /// Arguments for the guard instruction.
    pub data: Vec<u8>,
}

/// Struct to hold references to candy guard and candy machine
/// accounts, if present.
pub struct RouteContext<'info> {
    /// The candy guard account.
    pub candy_guard: Option<Account<'info, CandyGuard>>,
    /// The candy machine account.
    pub candy_machine: Option<Box<Account<'info, CandyMachine>>>,
    // The active guard set.
    pub guard_set: Option<Box<GuardSet>>,
}
