#![allow(clippy::result_large_err)]

use anchor_lang::prelude::*;

use instructions::*;

pub mod errors;
pub mod guards;
pub mod instructions;
pub mod state;
pub mod utils;

declare_id!("Guard1JwRhJkVH6XZhzoYxeBVQe872VH6QggF4BWmS9g");

#[program]
pub mod candy_guard {
    use super::*;

    /// Create a new candy guard account.
    pub fn initialize(ctx: Context<Initialize>, data: Vec<u8>) -> Result<()> {
        instructions::initialize(ctx, data)
    }

    /// Mint an NFT from a candy machine wrapped in the candy guard.
    pub fn mint<'c, 'info>(
        ctx: Context<'_, '_, 'c, 'info, Mint<'info>>,
        mint_args: Vec<u8>,
        label: Option<String>,
    ) -> Result<()>
    where
        'c: 'info,
    {
        instructions::mint(ctx, mint_args, label)
    }

    /// Mint an NFT from a candy machine wrapped in the candy guard.
    pub fn mint_v2<'c, 'info>(
        ctx: Context<'_, '_, 'c, 'info, MintV2<'info>>,
        mint_args: Vec<u8>,
        label: Option<String>,
    ) -> Result<()>
    where
        'c: 'info,
    {
        instructions::mint_v2(ctx, mint_args, label)
    }

    /// Route the transaction to a guard instruction.
    pub fn route<'b, 'c, 'info>(
        ctx: Context<'_, 'b, 'c, 'info, Route<'info>>,
        args: RouteArgs,
        label: Option<String>,
    ) -> Result<()>
    where
        'c: 'info,
    {
        instructions::route(ctx, args, label)
    }

    /// Set a new authority of the candy guard.
    pub fn set_authority(ctx: Context<SetAuthority>, new_authority: Pubkey) -> Result<()> {
        instructions::set_authority(ctx, new_authority)
    }

    /// Remove a candy guard from a candy machine, setting the authority to the
    /// candy guard authority.
    pub fn unwrap(ctx: Context<Unwrap>) -> Result<()> {
        instructions::unwrap(ctx)
    }

    /// Update the candy guard configuration.
    pub fn update(ctx: Context<Update>, data: Vec<u8>) -> Result<()> {
        instructions::update(ctx, data)
    }

    /// Withdraw the rent SOL from the candy guard account.
    pub fn withdraw(ctx: Context<Withdraw>) -> Result<()> {
        instructions::withdraw(ctx)
    }

    /// Add a candy guard to a candy machine. After the guard is added, mint
    /// is only allowed through the candy guard.
    pub fn wrap(ctx: Context<Wrap>) -> Result<()> {
        instructions::wrap(ctx)
    }
}
