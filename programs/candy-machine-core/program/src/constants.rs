pub use mpl_token_metadata::{
    MAX_CREATOR_LEN, MAX_CREATOR_LIMIT, MAX_NAME_LENGTH, MAX_SYMBOL_LENGTH, MAX_URI_LENGTH,
};
use solana_program::{pubkey, pubkey::Pubkey};

pub const MPL_TOKEN_AUTH_RULES_PROGRAM: Pubkey =
    pubkey!("auth9SigNpDKz4sJJ1DfCTuZrZNSAgh9sFD3rboVmgg");

// Seed used to derive the authority PDA address.
pub const AUTHORITY_SEED: &str = "candy_machine";

// Determine the start of the account hidden section.
pub const CANDY_MACHINE_SIZE: usize = 8           // discriminator
    + 2                                       // version
    + 6                                       // features
    + 32                                      // authority
    + 32                                      // mint authority
    + 8                                       // items redeemed
    + 8; // items available

pub const CONFIG_LINE_SIZE: usize = 32// mint
    + 32 // seller
    + 32; // winner
