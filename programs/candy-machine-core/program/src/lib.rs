#![allow(clippy::result_large_err)]

use anchor_lang::prelude::*;

pub use errors::CandyError;
use instructions::*;
pub use state::*;
pub use utils::*;

pub mod constants;
pub mod errors;
mod instructions;
mod state;
mod utils;

declare_id!("CndyV3LdqHUfDLmE5naZjVN8rBZz4tqhdefbAnjHG3JR");

#[program]
pub mod candy_machine_core {
    use super::*;

    /// Add the configuration (name + uri) of each NFT to the account data.
    ///
    /// # Accounts
    ///
    ///   0. `[writable]` Candy Machine account
    ///   1. `[signer]` Candy Machine authority
    pub fn add_config_lines(
        ctx: Context<AddConfigLines>,
        index: u32,
        config_lines: Vec<ConfigLine>,
    ) -> Result<()> {
        instructions::add_config_lines(ctx, index, config_lines)
    }

    /// Initialize the candy machine account with the specified data.
    ///
    /// # Accounts
    ///
    ///   0. `[writable]` Candy Machine account (must be pre-allocated but zero content)
    ///   2. `[]` Candy Machine authority
    ///   3. `[signer]` Payer
    pub fn initialize_v2(ctx: Context<InitializeV2>, item_count: u64) -> Result<()> {
        instructions::initialize_v2(ctx, item_count)
    }

    /// Mint an NFT.
    ///
    /// Only the candy machine mint authority is allowed to mint. This handler mints both
    /// NFTs and Programmable NFTs.
    ///
    /// # Accounts
    ///
    ///   0. `[writable]` Candy Machine account (must be pre-allocated but zero content)
    ///   2. `[signer]` Candy Machine mint authority
    ///   3. `[signer]` Payer
    ///   4. `[writable]` Mint account of the NFT
    ///   18. `[]` System program
    ///   20. `[]` SlotHashes sysvar cluster data.
    pub fn mint_v2<'info>(ctx: Context<'_, '_, '_, 'info, MintV2<'info>>) -> Result<()> {
        instructions::mint_v2(ctx)
    }

    /// Set a new authority of the candy machine.
    ///
    /// # Accounts
    ///
    ///   0. `[writable]` Candy Machine account
    ///   1. `[signer]` Candy Machine authority
    pub fn set_authority(ctx: Context<SetAuthority>, new_authority: Pubkey) -> Result<()> {
        instructions::set_authority(ctx, new_authority)
    }

    /// Set a new mint authority of the candy machine.
    ///
    /// # Accounts
    ///
    ///   0. `[writable]` Candy Machine account
    ///   1. `[signer]` Candy Machine authority
    ///   1. `[signer]` New candy machine authority
    pub fn set_mint_authority(ctx: Context<SetMintAuthority>) -> Result<()> {
        instructions::set_mint_authority(ctx)
    }

    /// Withdraw the rent lamports and send them to the authority address.
    ///
    /// # Accounts
    ///
    ///   0. `[writable]` Candy Machine account
    ///   1. `[signer]` Candy Machine authority
    pub fn withdraw(ctx: Context<Withdraw>) -> Result<()> {
        instructions::withdraw(ctx)
    }
}
