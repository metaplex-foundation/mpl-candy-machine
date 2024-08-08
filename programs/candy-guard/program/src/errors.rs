use anchor_lang::error_code;

#[error_code]
pub enum GumballGuardError {
    #[msg("Could not save guard to account")]
    InvalidAccountSize,

    #[msg("Could not deserialize guard")]
    DeserializationError,

    #[msg("Public key mismatch")]
    PublicKeyMismatch,

    #[msg("Exceeded account increase limit")]
    DataIncrementLimitExceeded,

    #[msg("Account does not have correct owner")]
    IncorrectOwner,

    #[msg("Account is not initialized")]
    Uninitialized,

    #[msg("Missing expected remaining account")]
    MissingRemainingAccount,

    #[msg("Numerical overflow error")]
    NumericalOverflowError,

    #[msg("Missing required group label")]
    RequiredGroupLabelNotFound,

    #[msg("Group not found")]
    GroupNotFound,

    #[msg("Value exceeded maximum length")]
    ExceededLength,

    #[msg("Gumball machine is empty")]
    GumballMachineEmpty,

    #[msg("No instruction was found")]
    InstructionNotFound,

    #[msg("Collection public key mismatch")]
    CollectionKeyMismatch,

    #[msg("Missing collection accounts")]
    MissingCollectionAccounts,

    #[msg("Collection update authority public key mismatch")]
    CollectionUpdateAuthorityKeyMismatch,

    #[msg("Mint must be the last instructions of the transaction")]
    MintNotLastTransaction,

    #[msg("Mint is not live")]
    MintNotLive,

    #[msg("Not enough SOL to pay for the mint")]
    NotEnoughSOL,

    #[msg("Token burn failed")]
    TokenBurnFailed,

    #[msg("Not enough tokens on the account")]
    NotEnoughTokens,

    #[msg("Token transfer failed")]
    TokenTransferFailed,

    #[msg("A signature was required but not found")]
    MissingRequiredSignature,

    #[msg("Gateway token is not valid")]
    GatewayTokenInvalid,

    #[msg("Current time is after the set end date")]
    AfterEndDate,

    #[msg("Current time is not within the allowed mint time")]
    InvalidMintTime,

    #[msg("Address not found on the allowed list")]
    AddressNotFoundInAllowedList,

    #[msg("Missing allowed list proof")]
    MissingAllowedListProof,

    #[msg("Allow list guard is not enabled")]
    AllowedListNotEnabled,

    #[msg("The maximum number of allowed mints was reached")]
    AllowedMintLimitReached,

    #[msg("Invalid NFT collection")]
    InvalidNftCollection,

    #[msg("Missing NFT on the account")]
    MissingNft,

    #[msg("Current redemeed items is at the set maximum amount")]
    MaximumRedeemedAmount,

    #[msg("Address not authorized")]
    AddressNotAuthorized,

    #[msg("Missing freeze instruction data")]
    MissingFreezeInstruction,

    #[msg("Freeze guard must be enabled")]
    FreezeGuardNotEnabled,

    #[msg("Freeze must be initialized")]
    FreezeNotInitialized,

    #[msg("Missing freeze period")]
    MissingFreezePeriod,

    #[msg("The freeze escrow account already exists")]
    FreezeEscrowAlreadyExists,

    #[msg("Maximum freeze period exceeded")]
    ExceededMaximumFreezePeriod,

    #[msg("Thaw is not enabled")]
    ThawNotEnabled,

    #[msg("Unlock is not enabled (not all NFTs are thawed)")]
    UnlockNotEnabled,

    #[msg("Duplicated group label")]
    DuplicatedGroupLabel,

    #[msg("Duplicated mint limit id")]
    DuplicatedMintLimitId,

    #[msg("An unauthorized program was found in the transaction")]
    UnauthorizedProgramFound,

    #[msg("Exceeded the maximum number of programs in the additional list")]
    ExceededProgramListSize,

    #[msg("Allocation PDA not initialized")]
    AllocationNotInitialized,

    #[msg("Allocation limit was reached")]
    AllocationLimitReached,

    #[msg("Allocation guard must be enabled")]
    AllocationGuardNotEnabled,

    #[msg("Gumball machine has an invalid mint authority")]
    InvalidMintAuthority,

    #[msg("Instruction could not be created")]
    InstructionBuilderFailed,

    #[msg("Invalid account version")]
    InvalidAccountVersion,

    #[msg("Invalid PDA")]
    InvalidPDA,

    #[msg("Invalid payment mint")]
    InvalidPaymentMint,

    #[msg("Invalid gumball machine state")]
    InvalidGumballMachineState,
}
