pub mod add_config_lines;
pub mod initialize;
pub mod initialize_v2;
pub mod mint;
pub mod mint_v2;
pub mod set_authority;
pub mod set_collection;
pub mod set_collection_v2;
pub mod set_mint_authority;
pub mod set_token_standard;
pub mod update;
pub mod withdraw;

pub use add_config_lines::*;
pub use initialize::*;
pub use initialize_v2::*;
pub use mint::*;
pub use mint_v2::*;
pub use set_authority::*;
pub use set_collection::*;
pub use set_collection_v2::*;
pub use set_mint_authority::*;
pub use set_token_standard::*;
pub use update::*;
pub use withdraw::*;

use solana_program::{pubkey, pubkey::Pubkey};

pub(crate) const MPL_TOKEN_AUTH_RULES_PROGRAM: Pubkey =
    pubkey!("auth9SigNpDKz4sJJ1DfCTuZrZNSAgh9sFD3rboVmgg");
