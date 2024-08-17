use crate::state::GumballGuard;
use anchor_lang::prelude::*;
pub use close_gumball_machine::*;
pub use draw::*;
pub use initialize::*;
use mallow_gumball::GumballMachine;
pub use route::*;
pub use set_authority::*;
pub use unwrap::*;
pub use update::*;
pub use wrap::*;

pub mod close_gumball_machine;
pub mod draw;
pub mod initialize;
pub mod route;
pub mod set_authority;
pub mod unwrap;
pub mod update;
pub mod wrap;

/// Accounts to mint an NFT.
pub(crate) struct DrawAccounts<'b, 'c, 'info> {
    pub(crate) gumball_guard: &'b Account<'info, GumballGuard>,
    pub(crate) gumball_machine: &'b Account<'info, GumballMachine>,
    pub(crate) payer: AccountInfo<'info>,
    pub(crate) buyer: AccountInfo<'info>,
    pub(crate) _gumball_machine_program: AccountInfo<'info>,
    pub(crate) token_metadata_program: AccountInfo<'info>,
    pub(crate) spl_token_program: AccountInfo<'info>,
    pub(crate) system_program: AccountInfo<'info>,
    pub(crate) sysvar_instructions: AccountInfo<'info>,
    pub(crate) recent_slothashes: AccountInfo<'info>,
    pub(crate) remaining: &'c [AccountInfo<'info>],
    pub(crate) gumball_event_authority: AccountInfo<'info>,
}

#[derive(Debug, Clone)]
pub struct Token;

impl anchor_lang::Id for Token {
    fn id() -> Pubkey {
        spl_token::ID
    }
}

#[derive(Debug, Clone)]
pub struct AssociatedToken;

impl anchor_lang::Id for AssociatedToken {
    fn id() -> Pubkey {
        spl_associated_token_account::ID
    }
}
