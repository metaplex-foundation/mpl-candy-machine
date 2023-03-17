use std::collections::BTreeMap;

use anchor_lang::{prelude::*, solana_program::sysvar, Discriminator};
use mpl_candy_machine_core::CandyMachine;
use solana_program::{instruction::Instruction, program::invoke_signed};

use crate::{
    guards::{CandyGuardError, EvaluationContext},
    state::{CandyGuard, CandyGuardData, GuardSet, DATA_OFFSET, SEED},
    utils::cmp_pubkeys,
};

use super::{AssociatedToken, MintAccounts, Token};

pub fn mint_v2<'info>(
    ctx: Context<'_, '_, '_, 'info, MintV2<'info>>,
    mint_args: Vec<u8>,
    label: Option<String>,
) -> Result<()> {
    let accounts = MintAccounts {
        candy_guard: &ctx.accounts.candy_guard,
        candy_machine: &ctx.accounts.candy_machine,
        candy_machine_authority_pda: ctx.accounts.candy_machine_authority_pda.to_account_info(),
        _candy_machine_program: ctx.accounts.candy_machine_program.to_account_info(),
        collection_delegate_record: ctx.accounts.collection_delegate_record.to_account_info(),
        collection_master_edition: ctx.accounts.collection_master_edition.to_account_info(),
        collection_metadata: ctx.accounts.collection_metadata.to_account_info(),
        collection_mint: ctx.accounts.collection_mint.to_account_info(),
        collection_update_authority: ctx.accounts.collection_update_authority.to_account_info(),
        nft_master_edition: ctx.accounts.nft_master_edition.to_account_info(),
        nft_metadata: ctx.accounts.nft_metadata.to_account_info(),
        nft_mint: ctx.accounts.nft_mint.to_account_info(),
        nft_mint_authority: ctx.accounts.nft_mint_authority.to_account_info(),
        payer: ctx.accounts.payer.to_account_info(),
        minter: ctx.accounts.minter.to_account_info(),
        recent_slothashes: ctx.accounts.recent_slothashes.to_account_info(),
        spl_ata_program: ctx
            .accounts
            .spl_ata_program
            .as_ref()
            .map(|spl_ata_program| spl_ata_program.to_account_info()),
        spl_token_program: ctx.accounts.spl_token_program.to_account_info(),
        system_program: ctx.accounts.system_program.to_account_info(),
        sysvar_instructions: ctx.accounts.sysvar_instructions.to_account_info(),
        token: ctx
            .accounts
            .token
            .as_ref()
            .map(|token| token.to_account_info()),
        token_metadata_program: ctx.accounts.token_metadata_program.to_account_info(),
        token_record: ctx
            .accounts
            .token_record
            .as_ref()
            .map(|token_record| token_record.to_account_info()),
        remaining: ctx.remaining_accounts,
        authorization_rules_program: ctx
            .accounts
            .authorization_rules_program
            .as_ref()
            .map(|authorization_rules_program| authorization_rules_program.to_account_info()),
        authorization_rules: ctx
            .accounts
            .authorization_rules
            .as_ref()
            .map(|authorization_rules| authorization_rules.to_account_info()),
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

pub fn process_mint<'info>(
    ctx: &mut EvaluationContext<'_, '_, 'info>,
    mint_args: Vec<u8>,
    label: Option<String>,
) -> Result<()> {
    let candy_guard = &ctx.accounts.candy_guard;
    let account_info = &candy_guard.to_account_info();
    let account_data = account_info.data.borrow();
    // loads the active guard set
    let guard_set = match CandyGuardData::active_set(&account_data[DATA_OFFSET..], label) {
        Ok(guard_set) => guard_set,
        Err(error) => {
            // load the default guard set to look for the bot_tax since errors only occur
            // when trying to load guard set groups
            let (default, _) = GuardSet::from_data(&account_data[DATA_OFFSET..])?;
            return process_error(ctx, &default, error);
        }
    };

    let conditions = guard_set.enabled_conditions();

    // validates the required transaction data

    if let Err(error) = validate(ctx) {
        return process_error(ctx, &guard_set, error);
    }

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

/// Performs a validation of the transaction before executing the guards.
fn validate(ctx: &EvaluationContext) -> Result<()> {
    if !cmp_pubkeys(
        &ctx.accounts.collection_mint.key(),
        &ctx.accounts.candy_machine.collection_mint,
    ) {
        return err!(CandyGuardError::CollectionKeyMismatch);
    }
    if !cmp_pubkeys(
        ctx.accounts.collection_metadata.owner,
        &mpl_token_metadata::id(),
    ) {
        return err!(CandyGuardError::IncorrectOwner);
    }

    Ok(())
}

/// Send a mint transaction to the candy machine.
fn cpi_mint(ctx: &EvaluationContext) -> Result<()> {
    let candy_guard = &ctx.accounts.candy_guard;

    // candy machine mint instruction accounts
    let mint_accounts = Box::new(mpl_candy_machine_core::cpi::accounts::MintV2 {
        candy_machine: ctx.accounts.candy_machine.to_account_info(),
        authority_pda: ctx.accounts.candy_machine_authority_pda.clone(),
        mint_authority: candy_guard.to_account_info(),
        payer: ctx.accounts.payer.clone(),
        nft_owner: ctx.accounts.minter.clone(),
        nft_mint: ctx.accounts.nft_mint.clone(),
        nft_mint_authority: ctx.accounts.nft_mint_authority.clone(),
        nft_metadata: ctx.accounts.nft_metadata.clone(),
        nft_master_edition: ctx.accounts.nft_master_edition.clone(),
        token: ctx.accounts.token.clone(),
        token_record: ctx.accounts.token_record.clone(),
        collection_delegate_record: ctx.accounts.collection_delegate_record.clone(),
        collection_mint: ctx.accounts.collection_mint.clone(),
        collection_metadata: ctx.accounts.collection_metadata.clone(),
        collection_master_edition: ctx.accounts.collection_master_edition.clone(),
        collection_update_authority: ctx.accounts.collection_update_authority.clone(),
        token_metadata_program: ctx.accounts.token_metadata_program.clone(),
        spl_token_program: ctx.accounts.spl_token_program.clone(),
        spl_ata_program: ctx.accounts.spl_ata_program.clone(),
        system_program: ctx.accounts.system_program.clone(),
        sysvar_instructions: Some(ctx.accounts.sysvar_instructions.to_owned()),
        recent_slothashes: ctx.accounts.recent_slothashes.clone(),
        authorization_rules_program: ctx.accounts.authorization_rules_program.clone(),
        authorization_rules: ctx.accounts.authorization_rules.clone(),
    });

    let mint_infos = mint_accounts.to_account_infos();
    let mut mint_metas = mint_accounts.to_account_metas(None);

    mint_metas.iter_mut().for_each(|account_meta| {
        if account_meta.pubkey == ctx.accounts.nft_mint.key() {
            account_meta.is_signer = ctx.accounts.nft_mint.is_signer;
        }
    });

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

    /// Candy Machine authority account.
    ///
    /// CHECK: account constraints checked in CPI
    #[account(mut)]
    candy_machine_authority_pda: UncheckedAccount<'info>,

    /// Payer for the mint (SOL) fees.
    #[account(mut)]
    payer: Signer<'info>,

    /// Minter account for validation and non-SOL fees.
    minter: Signer<'info>,

    /// Mint account of the NFT. The account will be initialized if necessary.
    ///
    /// Must be a signer if:
    ///   * the nft_mint account does not exist.
    ///
    /// CHECK: account checked in CPI
    #[account(mut)]
    nft_mint: UncheckedAccount<'info>,

    /// Mint authority of the NFT before the authority gets transfer to the master edition account.
    ///
    /// If nft_mint account exists:
    ///   * it must match the mint authority of nft_mint.
    nft_mint_authority: Signer<'info>,

    /// Metadata account of the NFT. This account must be uninitialized.
    ///
    /// CHECK: account checked in CPI
    #[account(mut)]
    nft_metadata: UncheckedAccount<'info>,

    /// Master edition account of the NFT. The account will be initialized if necessary.
    ///
    /// CHECK: account checked in CPI
    #[account(mut)]
    nft_master_edition: UncheckedAccount<'info>,

    /// Destination token account (required for pNFT).
    ///
    /// CHECK: account checked in CPI
    #[account(mut)]
    token: Option<UncheckedAccount<'info>>,

    /// Token record (required for pNFT).
    ///
    /// CHECK: account checked in CPI
    #[account(mut)]
    token_record: Option<UncheckedAccount<'info>>,

    /// Collection authority or metadata delegate record.
    ///
    /// CHECK: account checked in CPI
    collection_delegate_record: UncheckedAccount<'info>,

    /// Mint account of the collection NFT.
    ///
    /// CHECK: account checked in CPI
    collection_mint: UncheckedAccount<'info>,

    /// Metadata account of the collection NFT.
    ///
    /// CHECK: account checked in CPI
    #[account(mut)]
    collection_metadata: UncheckedAccount<'info>,

    /// Master edition account of the collection NFT.
    ///
    /// CHECK: account checked in CPI
    collection_master_edition: UncheckedAccount<'info>,

    /// Update authority of the collection NFT.
    ///
    /// CHECK: account checked in CPI
    collection_update_authority: UncheckedAccount<'info>,

    /// Token Metadata program.
    ///
    /// CHECK: account checked in CPI
    #[account(address = mpl_token_metadata::id())]
    token_metadata_program: UncheckedAccount<'info>,

    /// SPL Token program.
    spl_token_program: Program<'info, Token>,

    /// SPL Associated Token program.
    spl_ata_program: Option<Program<'info, AssociatedToken>>,

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

    /// Token Authorization Rules program.
    ///
    /// CHECK: account checked in CPI
    #[account(address = mpl_token_auth_rules::id())]
    authorization_rules_program: Option<UncheckedAccount<'info>>,

    /// Token Authorization rules account for the collection metadata (if any).
    ///
    /// CHECK: account constraints checked in account trait
    #[account(owner = mpl_token_auth_rules::id())]
    authorization_rules: Option<UncheckedAccount<'info>>,
}
