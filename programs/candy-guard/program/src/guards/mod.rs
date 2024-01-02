use std::collections::BTreeMap;

pub use anchor_lang::prelude::*;

pub use crate::{errors::CandyGuardError, instructions::mint::*, state::GuardSet};
use crate::{
    instructions::{MintAccounts, Route, RouteContext},
    state::CandyGuardData,
};

pub use address_gate::AddressGate;
pub use allocation::Allocation;
pub use allow_list::AllowList;
pub use bot_tax::BotTax;
pub use end_date::EndDate;
pub use freeze_sol_payment::{FreezeEscrow, FreezeInstruction, FreezeSolPayment};
pub use freeze_token_payment::FreezeTokenPayment;
pub use gatekeeper::Gatekeeper;
pub use mint_limit::{MintCounter, MintLimit};
pub use nft_burn::NftBurn;
pub use nft_gate::NftGate;
pub use nft_payment::NftPayment;
pub use program_gate::ProgramGate;
pub use redeemed_amount::RedeemedAmount;
pub use sol_payment::SolPayment;
pub use start_date::StartDate;
pub use third_party_signer::ThirdPartySigner;
pub use token2022_payment::Token2022Payment;
pub use token_burn::TokenBurn;
pub use token_gate::TokenGate;
pub use token_payment::TokenPayment;

mod address_gate;
mod allocation;
mod allow_list;
mod bot_tax;
mod end_date;
mod freeze_sol_payment;
mod freeze_token_payment;
mod gatekeeper;
mod inscription;
mod mint_limit;
mod nft_burn;
mod nft_gate;
mod nft_payment;
mod program_gate;
mod redeemed_amount;
mod sol_payment;
mod start_date;
mod third_party_signer;
mod token2022_payment;
mod token_burn;
mod token_gate;
mod token_payment;

pub trait Condition {
    /// Validate the condition of the guard. When the guard condition is
    /// not satisfied, it will return an error.
    ///
    /// This function should not perform any modification to accounts, since
    /// other guards might fail, causing the transaction to be aborted.
    ///
    /// Intermediary evaluation data can be stored in the `evaluation_context`,
    /// which will be shared with other guards and reused in the `actions` step
    /// of the process.
    fn validate(
        &self,
        ctx: &mut EvaluationContext,
        guard_set: &GuardSet,
        mint_args: &[u8],
    ) -> Result<()>;

    /// Perform the action associated with the guard before the CPI `mint` instruction.
    ///
    /// This function only gets called when all guards have been successfuly validated.
    /// Any error generated will make the transaction to fail.
    fn pre_actions(
        &self,
        _ctx: &mut EvaluationContext,
        _guard_set: &GuardSet,
        _mint_args: &[u8],
    ) -> Result<()> {
        Ok(())
    }

    /// Perform the action associated with the guard after the CPI `mint` instruction.
    ///
    /// This function only gets called when all guards have been successfuly validated.
    /// Any error generated will make the transaction to fail.
    fn post_actions(
        &self,
        _ctx: &mut EvaluationContext,
        _guard_set: &GuardSet,
        _mint_args: &[u8],
    ) -> Result<()> {
        Ok(())
    }
}

pub trait Guard: Condition + AnchorSerialize + AnchorDeserialize {
    /// Returns the number of bytes used by the guard configuration.
    fn size() -> usize;

    /// Returns the feature mask for the guard.
    fn mask() -> u64;

    /// Executes an instruction. This function is called from the `route` instruction
    /// handler.
    fn instruction<'info>(
        _ctx: &Context<'_, '_, '_, 'info, Route<'info>>,
        _route_context: RouteContext<'info>,
        _data: Vec<u8>,
    ) -> Result<()> {
        err!(CandyGuardError::InstructionNotFound)
    }

    /// Returns whether the guards is enabled or not on the specified features.
    fn is_enabled(features: u64) -> bool {
        features & Self::mask() > 0
    }

    /// Enables the guard on the specified `features` value.
    fn enable(features: u64) -> u64 {
        features | Self::mask()
    }

    /// Disables the guard on the specified `features` value.
    fn disable(features: u64) -> u64 {
        features & !Self::mask()
    }

    /// Serializes the guard into the specified data array.
    fn save(&self, data: &mut [u8], offset: usize) -> Result<()> {
        let mut result = Vec::with_capacity(Self::size());
        self.serialize(&mut result)?;

        data[offset..(result.len() + offset)].copy_from_slice(&result[..]);

        Ok(())
    }

    /// Deserializes the guard from a slice of data. Only attempts the deserialization
    /// if the data slice is large enough.
    fn load(data: &[u8], offset: usize) -> Result<Option<Self>> {
        if offset <= data.len() {
            let mut slice = &data[offset - Self::size()..offset];
            let guard = Self::deserialize(&mut slice)?;
            Ok(Some(guard))
        } else {
            Ok(None)
        }
    }

    /// Verifies that the candy guard configuration is valid according to the rules
    /// of the guard.
    fn verify(_data: &CandyGuardData) -> Result<()> {
        Ok(())
    }
}
pub struct EvaluationContext<'b, 'c, 'info> {
    /// Accounts required to mint an NFT.
    pub(crate) accounts: MintAccounts<'b, 'c, 'info>,

    /// The cursor for the remaining account list. When a guard "consumes" one of the
    /// remaining accounts, it should increment the cursor.
    pub account_cursor: usize,

    /// The cursor for the remaining bytes on the mint args. When a guard "consumes" one
    /// argument, it should increment the number of bytes read.
    pub args_cursor: usize,

    /// Convenience mapping of remaining account indices.
    pub indices: BTreeMap<&'info str, usize>,
}

/// Utility function to try to get the account from the remaining accounts
/// array at the specified index.
pub fn try_get_account_info<T>(remaining_accounts: &[T], index: usize) -> Result<&T> {
    if index < remaining_accounts.len() {
        Ok(&remaining_accounts[index])
    } else {
        err!(CandyGuardError::MissingRemainingAccount)
    }
}

/// Utility function to try to get the account from the remaining accounts
/// array at the specified index.
pub fn get_account_info<T>(remaining_accounts: &[T], index: usize) -> Option<&T> {
    if index < remaining_accounts.len() {
        Some(&remaining_accounts[index])
    } else {
        None
    }
}
