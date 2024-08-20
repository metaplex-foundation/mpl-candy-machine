use std::collections::BTreeMap;

use anchor_lang::{prelude::*, solana_program::sysvar, Discriminator};
use mallow_gumball::GumballMachine;
use solana_program::{instruction::Instruction, program::invoke_signed};

use crate::{
    guards::EvaluationContext,
    state::{GuardSet, GumballGuard, GumballGuardData, DATA_OFFSET, SEED},
};

use super::{DrawAccounts, Token};

pub fn draw<'c: 'info, 'info>(
    ctx: Context<'_, '_, 'c, 'info, Draw<'info>>,
    mint_args: Vec<u8>,
    label: Option<String>,
) -> Result<()> {
    let accounts = DrawAccounts {
        gumball_guard: &ctx.accounts.gumball_guard,
        gumball_machine: &ctx.accounts.gumball_machine,
        _gumball_machine_program: ctx.accounts.gumball_machine_program.to_account_info(),
        payer: ctx.accounts.payer.to_account_info(),
        buyer: ctx.accounts.buyer.to_account_info(),
        recent_slothashes: ctx.accounts.recent_slothashes.to_account_info(),
        spl_token_program: ctx.accounts.spl_token_program.to_account_info(),
        system_program: ctx.accounts.system_program.to_account_info(),
        sysvar_instructions: ctx.accounts.sysvar_instructions.to_account_info(),
        token_metadata_program: ctx.accounts.token_metadata_program.to_account_info(),
        remaining: ctx.remaining_accounts,
        gumball_event_authority: ctx.accounts.gumball_event_authority.to_account_info(),
    };

    // evaluation context for this transaction
    let mut ctx = EvaluationContext {
        accounts,
        account_cursor: 0,
        args_cursor: 0,
        indices: BTreeMap::new(),
    };

    process_draw(&mut ctx, mint_args, label)
}

pub fn process_draw(
    ctx: &mut EvaluationContext<'_, '_, '_>,
    mint_args: Vec<u8>,
    label: Option<String>,
) -> Result<()> {
    let account_info = ctx.accounts.gumball_guard.to_account_info();
    let account_data = account_info.data.borrow();
    // loads the active guard set
    let guard_set = match GumballGuardData::active_set(&account_data[DATA_OFFSET..], label) {
        Ok(guard_set) => guard_set,
        Err(error) => {
            // load the default guard set to look for the bot_tax since errors only occur
            // when trying to load guard set groups
            let guard_set = GumballGuardData::load(&account_data[DATA_OFFSET..])?;
            return process_error(ctx, &guard_set.default, error);
        }
    };
    drop(account_data);

    let conditions = guard_set.enabled_conditions();

    // validates enabled guards (any error at this point is subject to bot tax)

    for condition in &conditions {
        if let Err(error) = condition.validate(ctx, &guard_set, &mint_args) {
            return process_error(ctx, &guard_set, error);
        }
    }

    // after this point, errors might occur, which will cause the transaction to fail
    // no bot tax from this point since the actions must be reverted in case of an error

    for condition in &conditions {
        condition.pre_actions(ctx, &guard_set, &mint_args)?;
    }

    cpi_draw(ctx)?;

    for condition in &conditions {
        condition.post_actions(ctx, &guard_set, &mint_args)?;
    }

    Ok(())
}

// Handles errors + bot tax charge.
fn process_error(ctx: &EvaluationContext, guard_set: &GuardSet, error: Error) -> Result<()> {
    if let Some(bot_tax) = &guard_set.bot_tax {
        bot_tax.punish_bots(ctx, error)?;
        Ok(())
    } else {
        Err(error)
    }
}

/// Send a mint transaction to the gumball machine.
fn cpi_draw(ctx: &EvaluationContext) -> Result<()> {
    let gumball_guard = &ctx.accounts.gumball_guard;

    // gumball machine mint instruction accounts
    let mint_accounts = Box::new(mallow_gumball::cpi::accounts::Draw {
        gumball_machine: ctx.accounts.gumball_machine.to_account_info(),
        mint_authority: gumball_guard.to_account_info(),
        payer: ctx.accounts.payer.clone(),
        buyer: ctx.accounts.buyer.clone(),
        system_program: ctx.accounts.system_program.clone(),
        recent_slothashes: ctx.accounts.recent_slothashes.clone(),
        event_authority: ctx.accounts.gumball_event_authority.clone(),
        program: ctx.accounts._gumball_machine_program.clone(),
    });

    let mint_infos = mint_accounts.to_account_infos();
    let mint_metas = mint_accounts.to_account_metas(None);

    let mint_ix = Instruction {
        program_id: mallow_gumball::ID,
        accounts: mint_metas,
        data: mallow_gumball::instruction::Draw::DISCRIMINATOR.to_vec(),
    };

    // PDA signer for the transaction
    let seeds = [SEED, &gumball_guard.base.to_bytes(), &[gumball_guard.bump]];
    let signer = [&seeds[..]];

    invoke_signed(&mint_ix, &mint_infos, &signer)?;

    Ok(())
}

/// Mint an NFT.
#[derive(Accounts)]
pub struct Draw<'info> {
    /// Gumball Guard account.
    #[account(seeds = [SEED, gumball_guard.base.key().as_ref()], bump = gumball_guard.bump)]
    gumball_guard: Account<'info, GumballGuard>,

    /// Gumball Machine program account.
    ///
    /// CHECK: account constraints checked in account trait
    #[account(address = mallow_gumball::id())]
    gumball_machine_program: AccountInfo<'info>,

    /// Gumball machine account.
    #[account(mut, constraint = gumball_guard.key() == gumball_machine.mint_authority)]
    gumball_machine: Box<Account<'info, GumballMachine>>,

    /// Payer for the mint (SOL) fees.
    #[account(mut)]
    payer: Signer<'info>,

    /// Minter account for validation and non-SOL fees.
    #[account(mut)]
    buyer: Signer<'info>,

    /// Token Metadata program.
    ///
    /// CHECK: account checked in CPI
    #[account(address = mpl_token_metadata::ID)]
    token_metadata_program: UncheckedAccount<'info>,

    /// SPL Token program.
    spl_token_program: Program<'info, Token>,

    /// System program.
    system_program: Program<'info, System>,

    /// Instructions sysvar account.
    ///
    /// CHECK: account constraints checked in account trait
    #[account(address = sysvar::instructions::id())]
    sysvar_instructions: UncheckedAccount<'info>,

    /// SlotHashes sysvar cluster data.
    ///
    /// CHECK: account constraints checked in account trait
    #[account(address = sysvar::slot_hashes::id())]
    recent_slothashes: UncheckedAccount<'info>,

    /// CHECK: safe due to check in gumball machine
    gumball_event_authority: UncheckedAccount<'info>,
}
