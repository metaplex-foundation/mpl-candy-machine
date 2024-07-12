pub use mpl_token_metadata::MAX_URI_LENGTH;
use solana_program::{pubkey, pubkey::Pubkey};

pub const MPL_TOKEN_AUTH_RULES_PROGRAM: Pubkey =
    pubkey!("auth9SigNpDKz4sJJ1DfCTuZrZNSAgh9sFD3rboVmgg");

// Seed used to derive the authority PDA address.
pub const AUTHORITY_SEED: &str = "candy_machine";

pub const GUMBALL_SETTINGS_BYTE_INDEX: usize = 8 // discriminator
    + 1                                       // version
    + 32                                      // authority
    + 32                                      // mint authority
    + 8                                       // items redeemed
    + 1; // state

// Determine the start of the account hidden section.
pub const CANDY_MACHINE_SIZE: usize = GUMBALL_SETTINGS_BYTE_INDEX
    + MAX_URI_LENGTH                          // uri
    + 8                                       // item capacity
    + 2                                       // items per seller
    + 33                                       // add items merkle root
    + 2                                       // curator fee bps
    + 1; // hide sold items

pub const CONFIG_LINE_SIZE: usize = 32// mint
    + 32 // seller
    + 32 // buyer
    +1; // token standard
