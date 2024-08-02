#![allow(clippy::result_large_err)]

use anchor_lang::prelude::*;

use instructions::*;

pub mod errors;
pub mod guards;
pub mod instructions;
pub mod state;
pub mod utils;

declare_id!("GGRDy4ieS7ExrUu313QkszyuT9o3BvDLuc3H5VLgCpSF");

#[program]
pub mod candy_guard {
    use super::*;

    /// Create a new candy guard account.
    pub fn initialize(ctx: Context<Initialize>, data: Vec<u8>) -> Result<()> {
        instructions::initialize(ctx, data)
    }

    /// Mint an NFT from a candy machine wrapped in the candy guard.
    pub fn draw<'c: 'info, 'info>(
        ctx: Context<'_, '_, 'c, 'info, Draw<'info>>,
        mint_args: Vec<u8>,
        label: Option<String>,
    ) -> Result<()> {
        instructions::draw(ctx, mint_args, label)
    }

    /// Route the transaction to a guard instruction.
    pub fn route<'c: 'info, 'info>(
        ctx: Context<'_, '_, 'c, 'info, Route<'info>>,
        args: RouteArgs,
        label: Option<String>,
    ) -> Result<()> {
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
