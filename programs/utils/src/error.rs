use anchor_lang::prelude::*;

#[error_code]
pub enum Error {
    /// 7000 - Start at 1000 to separate errors from base program
    #[msg("Invalid public key")]
    PublicKeyMismatch = 1000,
    #[msg("Invalid owner")]
    InvalidOwner,
    #[msg("Account not initialized")]
    UninitializedAccount,
    #[msg("Overflow error")]
    OverflowError,
    #[msg("Collection not set")]
    CollectionNotSet,

    /// 7005
    #[msg("Invalid edition")]
    InvalidEdition,
    #[msg("Invalid edition max supply")]
    InvalidEditionMaxSupply,
    #[msg("Invalid PDA")]
    InvalidPDA,
    #[msg("No supply remaining")]
    NoSupplyRemaining,
    #[msg("Invalid listing")]
    InvalidListing,

    /// 7010
    #[msg("Valid listing")]
    ValidListing,
    #[msg("Invalid collection")]
    InvalidCollection,
}
