use std::collections::BTreeMap;

use anchor_lang::{prelude::*, solana_program::sysvar, Discriminator};
use mpl_candy_machine_core::CandyMachine;
use solana_program::{instruction::Instruction, program::invoke_signed};

use crate::{
    guards::EvaluationContext,
    state::{CandyGuard, CandyGuardData, GuardSet, DATA_OFFSET, SEED},
};

use super::{MintAccounts, Token};

pub fn mint_v2<'c: 'info, 'info>(
    ctx: Context<'_, '_, 'c, 'info, MintV2<'info>>,
    mint_args: Vec<u8>,
    label: Option<String>,
) -> Result<()> {
    let accounts = MintAccounts {
        candy_guard: &ctx.accounts.candy_guard,
        candy_machine: &ctx.accounts.candy_machine,
        _candy_machine_program: ctx.accounts.candy_machine_program.to_account_info(),
        payer: ctx.accounts.payer.to_account_info(),
        buyer: ctx.accounts.buyer.to_account_info(),
        recent_slothashes: ctx.accounts.recent_slothashes.to_account_info(),
        spl_token_program: ctx.accounts.spl_token_program.to_account_info(),
        system_program: ctx.accounts.system_program.to_account_info(),
        sysvar_instructions: ctx.accounts.sysvar_instructions.to_account_info(),
        token_metadata_program: ctx.accounts.token_metadata_program.to_account_info(),
        remaining: ctx.remaining_accounts,
    };

    // evaluation context for this transaction
    let mut ctx = EvaluationContext {
        accounts,
        account_cursor: 0,
        args_cursor: 0,
        indices: BTreeMap::new(),
    };

    process_mint(&mut ctx, mint_args, label)
}

pub fn process_mint(
    ctx: &mut EvaluationContext<'_, '_, '_>,
    mint_args: Vec<u8>,
    label: Option<String>,
) -> Result<()> {
    let account_info = ctx.accounts.candy_guard.to_account_info();
    let account_data = account_info.data.borrow();
    // loads the active guard set
    let guard_set = match CandyGuardData::active_set(&account_data[DATA_OFFSET..], label) {
        Ok(guard_set) => guard_set,
        Err(error) => {
            // load the default guard set to look for the bot_tax since errors only occur
            // when trying to load guard set groups
            let guard_set = CandyGuardData::load(&account_data[DATA_OFFSET..])?;
            return process_error(ctx, &guard_set.default, error);
        }
    };

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

    cpi_mint(ctx)?;

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

/// Send a mint transaction to the candy machine.
fn cpi_mint(ctx: &EvaluationContext) -> Result<()> {
    let candy_guard = &ctx.accounts.candy_guard;

    // candy machine mint instruction accounts
    let mint_accounts = Box::new(mpl_candy_machine_core::cpi::accounts::MintV2 {
        candy_machine: ctx.accounts.candy_machine.to_account_info(),
        mint_authority: candy_guard.to_account_info(),
        payer: ctx.accounts.payer.clone(),
        buyer: ctx.accounts.buyer.clone(),
        system_program: ctx.accounts.system_program.clone(),
        recent_slothashes: ctx.accounts.recent_slothashes.clone(),
    });

    let mint_infos = mint_accounts.to_account_infos();
    let mint_metas = mint_accounts.to_account_metas(None);

    let mint_ix = Instruction {
        program_id: mpl_candy_machine_core::ID,
        accounts: mint_metas,
        data: mpl_candy_machine_core::instruction::MintV2::DISCRIMINATOR.to_vec(),
    };

    // PDA signer for the transaction
    let seeds = [SEED, &candy_guard.base.to_bytes(), &[candy_guard.bump]];
    let signer = [&seeds[..]];

    invoke_signed(&mint_ix, &mint_infos, &signer)?;

    Ok(())
}

/// Mint an NFT.
#[derive(Accounts)]
pub struct MintV2<'info> {
    /// Candy Guard account.
    #[account(seeds = [SEED, candy_guard.base.key().as_ref()], bump = candy_guard.bump)]
    candy_guard: Account<'info, CandyGuard>,

    /// Candy Machine program account.
    ///
    /// CHECK: account constraints checked in account trait
    #[account(address = mpl_candy_machine_core::id())]
    candy_machine_program: AccountInfo<'info>,

    /// Candy machine account.
    #[account(mut, constraint = candy_guard.key() == candy_machine.mint_authority)]
    candy_machine: Box<Account<'info, CandyMachine>>,

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
}
