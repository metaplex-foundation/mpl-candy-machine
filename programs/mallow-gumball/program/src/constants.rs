pub use mpl_token_metadata::MAX_URI_LENGTH;
use solana_program::{pubkey, pubkey::Pubkey};

pub const MPL_TOKEN_AUTH_RULES_PROGRAM: Pubkey =
    pubkey!("auth9SigNpDKz4sJJ1DfCTuZrZNSAgh9sFD3rboVmgg");

// Seed used to derive the authority PDA address.
pub const AUTHORITY_SEED: &str = "gumball_machine";

// Seed used to derive the seller history PDA address.
pub const SELLER_HISTORY_SEED: &str = "seller_history";

pub const GUMBALL_SETTINGS_BYTE_INDEX: usize = 8 // discriminator
    + 1                                       // version
    + 32                                      // authority
    + 32                                      // mint authority
    + FEE_CONFIG_SIZE + 1                     // marketplace fee config (+1 for optional)
    + 8                                       // items redeemed
    + 8                                       // finalized items count
    + 8                                       // items settled
    + 8                                       // total revenue
    + 1; // state

pub const FEE_CONFIG_SIZE: usize = 32 // fee account
    + 2; // bps

// Determine the start of the account hidden section.
pub const GUMBALL_MACHINE_SIZE: usize = GUMBALL_SETTINGS_BYTE_INDEX
    + MAX_URI_LENGTH                        // uri
    + 8                                     // item capacity
    + 2                                     // items per seller
    + 33                                    // add items merkle root
    + 2                                     // curator fee bps
    + 1                                     // hide sold items
    + 32; // payment token

pub const CONFIG_LINE_SIZE: usize = 32// mint
    + 32 // seller
    + 32 // buyer
    +1; // token standard
