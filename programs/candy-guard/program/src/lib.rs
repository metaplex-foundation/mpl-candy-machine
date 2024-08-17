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

    /// Create a new gumball guard account.
    pub fn initialize(ctx: Context<Initialize>, data: Vec<u8>) -> Result<()> {
        instructions::initialize(ctx, data)
    }

    /// Mint an NFT from a gumball machine wrapped in the gumball guard.
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

    /// Set a new authority of the gumball guard.
    pub fn set_authority(ctx: Context<SetAuthority>, new_authority: Pubkey) -> Result<()> {
        instructions::set_authority(ctx, new_authority)
    }

    /// Remove a gumball guard from a gumball machine, setting the authority to the
    /// gumball guard authority.
    pub fn unwrap(ctx: Context<Unwrap>) -> Result<()> {
        instructions::unwrap(ctx)
    }

    /// Update the gumball guard configuration.
    pub fn update(ctx: Context<Update>, data: Vec<u8>) -> Result<()> {
        instructions::update(ctx, data)
    }

    /// Withdraw the rent SOL from the gumball guard account.
    pub fn withdraw<'info>(ctx: Context<'_, '_, '_, 'info, Withdraw<'info>>) -> Result<()> {
        instructions::withdraw(ctx)
    }

    /// Add a gumball guard to a gumball machine. After the guard is added, mint
    /// is only allowed through the gumball guard.
    pub fn wrap(ctx: Context<Wrap>) -> Result<()> {
        instructions::wrap(ctx)
    }
}
