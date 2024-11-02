use super::*;

use anchor_lang::AccountsClose;
use mpl_candy_machine_core::{AccountVersion, CandyMachine};
use mpl_token_metadata::{
    accounts::{Metadata, TokenRecord},
    instructions::{
        DelegateCpiBuilder, FreezeDelegatedAccountCpiBuilder, LockCpiBuilder,
        ThawDelegatedAccountCpiBuilder, TransferV1CpiBuilder, UnlockV1CpiBuilder,
    },
    types::{DelegateArgs, LockArgs, TokenStandard, TokenState},
    utils::assert_edition_is_programmable,
};
use solana_program::{
    program::{invoke, invoke_signed},
    program_pack::Pack,
    system_instruction, system_program,
};
use spl_token::{
    instruction::{approve, revoke},
    state::Account as TokenAccount,
};

use crate::{
    errors::CandyGuardError,
    state::GuardType,
    utils::{assert_is_token_account, assert_keys_equal, cmp_pubkeys},
};

pub const FREEZE_SOL_FEE: u64 = 10_000;

/// Guard that charges an amount in SOL (lamports) for the mint with a freeze period.
///
/// List of accounts required:
///
///   0. `[writable]` Freeze PDA to receive the funds (seeds `["freeze_escrow",
///           destination pubkey, candy guard pubkey, candy machine pubkey]`).
///   1. `[]` Associate token account of the NFT (seeds `[payer pubkey, token
///           program pubkey, nft mint pubkey]`).
///   2. `[optional]` Authorization rule set for the minted pNFT.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct FreezeSolPayment {
    pub lamports: u64,
    pub destination: Pubkey,
}

impl FreezeSolPayment {
    const fn total_lamports(&self) -> u64 {
        self.lamports + FREEZE_SOL_FEE
    }
}

impl Guard for FreezeSolPayment {
    fn size() -> usize {
        8    // lamports
        + 32 // destination
    }

    fn mask() -> u64 {
        GuardType::as_mask(GuardType::FreezeSolPayment)
    }

    /// Instructions to interact with the freeze feature:
    ///
    ///  * initialize
    ///  * thaw
    ///  * unlock funds
    fn instruction<'c, 'info>(
        ctx: &Context<'_, '_, 'c, 'info, Route<'info>>,
        route_context: RouteContext<'info>,
        data: Vec<u8>,
    ) -> Result<()>
    where
        'c: 'info,
    {
        // determines the instruction to execute
        let instruction: FreezeInstruction =
            if let Ok(instruction) = FreezeInstruction::try_from_slice(&data[0..1]) {
                instruction
            } else {
                return err!(CandyGuardError::MissingFreezeInstruction);
            };

        match instruction {
            // Initializes the freeze escrow PDA.
            //
            // List of accounts required:
            //
            //   0. `[writable]` Freeze PDA to receive the funds (seeds `["freeze_escrow",
            //                   destination pubkey, candy guard pubkey, candy machine pubkey]`).
            //   1. `[signer]` Candy Guard authority.
            //   2. `[]` System program account.
            FreezeInstruction::Initialize => {
                msg!("Instruction: Initialize (FreezeSolPayment guard)");

                if route_context.candy_guard.is_none() || route_context.candy_machine.is_none() {
                    return err!(CandyGuardError::Uninitialized);
                }

                let destination = if let Some(guard_set) = &route_context.guard_set {
                    if let Some(freeze_guard) = &guard_set.freeze_sol_payment {
                        freeze_guard.destination
                    } else {
                        return err!(CandyGuardError::FreezeGuardNotEnabled);
                    }
                } else {
                    return err!(CandyGuardError::FreezeGuardNotEnabled);
                };

                initialize_freeze(ctx, route_context, data, destination)
            }
            // Thaw an eligible NFT.
            //
            // List of accounts required:
            //
            //   0. `[writable]` Freeze PDA to receive the funds (seeds `["freeze_escrow",
            //                   destination pubkey, candy guard pubkey, candy machine pubkey]`).
            //   1. `[]` Mint account for the NFT.
            //   2. `[]` Address of the owner of the NFT.
            //   3. `[writable]` Associate token account of the NFT.
            //   4. `[]` Master Edition account of the NFT.
            //   5. `[]` SPL Token program.
            //   6. `[]` Metaplex Token Metadata program ID.
            //
            // Remaining accounts required for Programmable NFTs:
            //
            //   7. `[writable]` Metadata account of the NFT.
            //   8. `[writable]` Freeze PDA associated token account of the NFT.
            //   9. `[]` System program.
            //   10. `[]` Sysvar instructions account.
            //   11. `[]` SPL Associated Token Account program.
            //   12. `[optional, writable]` Owner token record account.
            //   13. `[optional, writable]` Freeze PDA token record account.
            //   14. `[optional]` Token Authorization Rules program.
            //   15. `[optional]` Token Authorization Rules account.
            FreezeInstruction::Thaw => {
                msg!("Instruction: Thaw (FreezeSolPayment guard)");
                thaw_nft(ctx, route_context, data)
            }
            // Unlocks frozen funds.
            //
            // List of accounts required:
            //
            //   0. `[writable]` Freeze PDA to receive the funds (seeds `["freeze_escrow",
            //                   destination pubkey, candy guard pubkey, candy machine pubkey]`).
            //   1. `[signer]` Candy Guard authority.
            //   2. `[writable]` Address to receive the funds (must match the `destination` address
            //                   of the guard configuration).
            //   3. `[]` System program account.
            FreezeInstruction::UnlockFunds => {
                msg!("Instruction: Unlock Funds (FreezeSolPayment guard)");
                unlock_funds(ctx, route_context, data)
            }
        }
    }
}

impl Condition for FreezeSolPayment {
    fn validate<'info>(
        &self,
        ctx: &mut EvaluationContext,
        _guard_set: &GuardSet,
        _mint_args: &[u8],
    ) -> Result<()> {
        let candy_guard_key = &ctx.accounts.candy_guard.key();
        let candy_machine_key = &ctx.accounts.candy_machine.key();

        // validates the additional accounts

        let index = ctx.account_cursor;
        let freeze_pda = try_get_account_info(ctx.accounts.remaining, index)?;
        ctx.account_cursor += 1;

        let seeds = [
            FreezeEscrow::PREFIX_SEED,
            self.destination.as_ref(),
            candy_guard_key.as_ref(),
            candy_machine_key.as_ref(),
        ];

        let (pda, _) = Pubkey::find_program_address(&seeds, &crate::ID);
        assert_keys_equal(freeze_pda.key, &pda)?;

        if freeze_pda.data_is_empty() {
            return err!(CandyGuardError::FreezeNotInitialized);
        }

        let nft_ata = try_get_account_info(ctx.accounts.remaining, index + 1)?;
        ctx.account_cursor += 1;

        if nft_ata.data_is_empty() {
            // for unitialized accounts, we need to check the derivation since the
            // account will be created during mint only if it is an ATA

            let (derivation, _) = Pubkey::find_program_address(
                &[
                    ctx.accounts.minter.key.as_ref(),
                    spl_token::id().as_ref(),
                    ctx.accounts.nft_mint.key.as_ref(),
                ],
                &spl_associated_token_account::id(),
            );

            assert_keys_equal(&derivation, nft_ata.key)?;
        } else {
            // validates if the existing account is a token account
            assert_is_token_account(nft_ata, ctx.accounts.minter.key, ctx.accounts.nft_mint.key)?;
        }

        // it has to match the 'token' account (if present)
        if let Some(token_info) = &ctx.accounts.token {
            assert_keys_equal(nft_ata.key, token_info.key)?;
        }

        let candy_machine_info = ctx.accounts.candy_machine.to_account_info();
        let account_data = candy_machine_info.data.borrow_mut();

        let collection_metadata =
            Metadata::try_from(&ctx.accounts.collection_metadata.to_account_info())?;

        let rule_set = ctx
            .accounts
            .candy_machine
            .get_rule_set(&account_data, &collection_metadata)?;

        if let Some(rule_set) = rule_set {
            let mint_rule_set = try_get_account_info(ctx.accounts.remaining, index + 2)?;
            assert_keys_equal(mint_rule_set.key, &rule_set)?;
            ctx.account_cursor += 1;
        }

        ctx.indices.insert("freeze_sol_payment", index);

        if ctx.accounts.payer.lamports() < self.total_lamports() {
            msg!(
                "Require {} lamports, accounts has {} lamports",
                self.total_lamports(),
                ctx.accounts.payer.lamports(),
            );
            return err!(CandyGuardError::NotEnoughSOL);
        }

        Ok(())
    }

    fn pre_actions<'info>(
        &self,
        ctx: &mut EvaluationContext,
        _guard_set: &GuardSet,
        _mint_args: &[u8],
    ) -> Result<()> {
        let freeze_pda =
            try_get_account_info(ctx.accounts.remaining, ctx.indices["freeze_sol_payment"])?;

        invoke(
            &system_instruction::transfer(
                &ctx.accounts.payer.key(),
                &freeze_pda.key(),
                self.total_lamports(),
            ),
            &[
                ctx.accounts.payer.to_account_info(),
                freeze_pda.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
        )?;

        Ok(())
    }

    fn post_actions<'info>(
        &self,
        ctx: &mut EvaluationContext,
        _guard_set: &GuardSet,
        _mint_args: &[u8],
    ) -> Result<()> {
        // freezes the nft
        freeze_nft(ctx, ctx.indices["freeze_sol_payment"], &self.destination, 2)
    }
}

/// PDA to store the frozen funds.
#[account]
#[derive(Default, Debug, PartialEq, Eq)]
pub struct FreezeEscrow {
    /// Candy guard address associated with this escrow.
    pub candy_guard: Pubkey,

    /// Candy machine address associated with this escrow.
    pub candy_machine: Pubkey,

    /// Number of NFTs frozen.
    pub frozen_count: u64,

    /// The timestamp of the first (frozen) mint. This is used to calculate
    /// when the freeze period is over.
    pub first_mint_time: Option<i64>,

    /// The amount of time (in seconds) for the freeze. The NFTs will be
    /// allowed to thaw after this.
    pub freeze_period: i64,

    /// The destination address for the frozen fund to go to.
    pub destination: Pubkey,

    /// The authority that initialized the freeze. This will be the only
    /// address able to unlock the funds in case the candy guard account is
    /// closed.
    pub authority: Pubkey,
}

impl FreezeEscrow {
    /// Maximum account size.
    pub const SIZE: usize = 8 // discriminator
        + 32    // candy guard
        + 32    // candy machine
        + 8     // frozen count
        + 1 + 8 // option + first mint time
        + 8     // freeze time
        + 32    // destination
        + 32; // authority

    /// Prefix used as seed.
    pub const PREFIX_SEED: &'static [u8] = b"freeze_escrow";

    /// Maximum freeze period in seconds (30 days).
    pub const MAX_FREEZE_TIME: i64 = 60 * 60 * 24 * 30;

    pub fn init(
        &mut self,
        candy_guard: Pubkey,
        candy_machine: Pubkey,
        first_mint_time: Option<i64>,
        freeze_period: i64,
        destination: Pubkey,
        authority: Pubkey,
    ) {
        self.candy_guard = candy_guard;
        self.candy_machine = candy_machine;
        self.frozen_count = 0;
        self.first_mint_time = first_mint_time;
        self.freeze_period = freeze_period;
        self.destination = destination;
        self.authority = authority;
    }

    pub fn is_thaw_allowed(&self, candy_machine: &CandyMachine, current_timestamp: i64) -> bool {
        if candy_machine.items_redeemed >= candy_machine.data.items_available {
            return true;
        } else if let Some(first_mint_time) = self.first_mint_time {
            if current_timestamp >= first_mint_time + self.freeze_period {
                return true;
            }
        }

        false
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub enum FreezeInstruction {
    Initialize,
    Thaw,
    UnlockFunds,
}

/// Helper function to freeze an nft.
pub fn freeze_nft<'c, 'info>(
    ctx: &EvaluationContext<'_, 'c, 'info>,
    account_index: usize,
    destination: &Pubkey,
    rule_set_offset: usize,
) -> Result<()>
where
    'c: 'info,
{
    let freeze_pda = try_get_account_info(ctx.accounts.remaining, account_index)?;

    let mut freeze_escrow: Account<FreezeEscrow> = Account::try_from(freeze_pda)?;
    freeze_escrow.frozen_count += 1;

    if freeze_escrow.first_mint_time.is_none() {
        let clock = Clock::get()?;
        freeze_escrow.first_mint_time = Some(clock.unix_timestamp);
    }

    freeze_escrow.exit(&crate::ID)?;

    let candy_guard_key = &ctx.accounts.candy_guard.key();
    let candy_machine_key = &ctx.accounts.candy_machine.key();
    let owner = &ctx.accounts.minter;

    let seeds = [
        FreezeEscrow::PREFIX_SEED,
        destination.as_ref(),
        candy_guard_key.as_ref(),
        candy_machine_key.as_ref(),
    ];
    let (_, bump) = Pubkey::find_program_address(&seeds, &crate::ID);

    let signer = [
        FreezeEscrow::PREFIX_SEED,
        destination.as_ref(),
        candy_guard_key.as_ref(),
        candy_machine_key.as_ref(),
        &[bump],
    ];

    let nft_ata = try_get_account_info(ctx.accounts.remaining, account_index + 1)?;

    if matches!(ctx.accounts.candy_machine.version, AccountVersion::V1) {
        invoke(
            &approve(
                &spl_token::ID,
                &nft_ata.key(),
                &freeze_pda.key(),
                &owner.key(),
                &[],
                1,
            )?,
            &[
                nft_ata.to_account_info(),
                freeze_pda.to_account_info(),
                owner.to_account_info(),
            ],
        )?;

        FreezeDelegatedAccountCpiBuilder::new(&ctx.accounts.token_metadata_program)
            .delegate(freeze_pda)
            .token_account(nft_ata)
            .edition(&ctx.accounts.nft_master_edition)
            .mint(&ctx.accounts.nft_mint)
            .token_program(&ctx.accounts.spl_token_program)
            .invoke_signed(&[&signer])?;
    } else {
        let token_record = ctx
            .accounts
            .token_record
            .as_ref()
            .map(|token_record| token_record.to_account_info());
        let authorization_rules =
            get_account_info(ctx.accounts.remaining, account_index + rule_set_offset);

        // if we have a token account, it must match the 'nft_ata'
        if let Some(ref token_info) = ctx.accounts.token {
            assert_keys_equal(nft_ata.key, token_info.key)?;
        }

        // approves a delegate to lock and transfer the token

        DelegateCpiBuilder::new(&ctx.accounts.token_metadata_program)
            .delegate(freeze_pda)
            .metadata(&ctx.accounts.nft_metadata)
            .master_edition(Some(&ctx.accounts.nft_master_edition))
            .token_record(token_record.as_ref())
            .mint(&ctx.accounts.nft_mint)
            .token(Some(nft_ata))
            .authority(&ctx.accounts.minter)
            .payer(&ctx.accounts.payer)
            .system_program(&ctx.accounts.system_program)
            .sysvar_instructions(&ctx.accounts.sysvar_instructions)
            .spl_token_program(Some(&ctx.accounts.spl_token_program))
            .authorization_rules_program(ctx.accounts.authorization_rules_program.as_ref())
            .authorization_rules(authorization_rules)
            .delegate_args(
                if ctx.accounts.candy_machine.token_standard
                    == TokenStandard::ProgrammableNonFungible as u8
                {
                    DelegateArgs::LockedTransferV1 {
                        amount: 1,
                        locked_address: freeze_escrow.key(),
                        authorization_data: None,
                    }
                } else {
                    DelegateArgs::StandardV1 { amount: 1 }
                },
            )
            .invoke_signed(&[&signer])?;

        // locks the token account

        LockCpiBuilder::new(&ctx.accounts.token_metadata_program)
            .authority(freeze_pda)
            .token_owner(Some(&ctx.accounts.minter))
            .token(nft_ata)
            .mint(&ctx.accounts.nft_mint)
            .metadata(&ctx.accounts.nft_metadata)
            .edition(Some(&ctx.accounts.nft_master_edition))
            .token_record(token_record.as_ref())
            .payer(&ctx.accounts.payer)
            .system_program(&ctx.accounts.system_program)
            .sysvar_instructions(&ctx.accounts.sysvar_instructions)
            .spl_token_program(Some(&ctx.accounts.spl_token_program))
            .lock_args(LockArgs::V1 {
                authorization_data: None,
            })
            .invoke_signed(&[&signer])?;
    }

    Ok(())
}

/// Helper function to initialize the freeze pda.
pub fn initialize_freeze<'c, 'info>(
    ctx: &Context<'_, '_, 'c, 'info, Route<'info>>,
    route_context: RouteContext,
    data: Vec<u8>,
    destination: Pubkey,
) -> Result<()>
where
    'c: 'info,
{
    let candy_guard_key = &ctx.accounts.candy_guard.key();
    let candy_machine_key = &ctx.accounts.candy_machine.key();

    let seeds = [
        FreezeEscrow::PREFIX_SEED,
        destination.as_ref(),
        candy_guard_key.as_ref(),
        candy_machine_key.as_ref(),
    ];
    let (pda, bump) = Pubkey::find_program_address(&seeds, &crate::ID);

    let freeze_pda = try_get_account_info(ctx.remaining_accounts, 0)?;
    assert_keys_equal(freeze_pda.key, &pda)?;

    let authority = try_get_account_info(ctx.remaining_accounts, 1)?;

    let candy_guard = route_context
        .candy_guard
        .as_ref()
        .ok_or(CandyGuardError::Uninitialized)?;

    let candy_machine = route_context
        .candy_machine
        .as_ref()
        .ok_or(CandyGuardError::Uninitialized)?;

    // only the authority can initialize freeze
    if !(cmp_pubkeys(authority.key, &candy_guard.authority) && authority.is_signer) {
        return err!(CandyGuardError::MissingRequiredSignature);
    }

    // and the candy guard and candy machine must be linked
    if !cmp_pubkeys(&candy_machine.mint_authority, &candy_guard.key()) {
        return err!(CandyGuardError::InvalidMintAuthority);
    }

    if freeze_pda.data_is_empty() {
        // checking if we got the correct system_program
        let system_program = try_get_account_info(ctx.remaining_accounts, 2)?;
        assert_keys_equal(system_program.key, &system_program::ID)?;

        let signer = [
            FreezeEscrow::PREFIX_SEED,
            destination.as_ref(),
            candy_guard_key.as_ref(),
            candy_machine_key.as_ref(),
            &[bump],
        ];
        let rent = Rent::get()?;

        invoke_signed(
            &system_instruction::create_account(
                &ctx.accounts.payer.key(),
                &pda,
                rent.minimum_balance(FreezeEscrow::SIZE),
                FreezeEscrow::SIZE as u64,
                &crate::ID,
            ),
            &[
                ctx.accounts.payer.to_account_info(),
                freeze_pda.to_account_info(),
            ],
            &[&signer],
        )?;
    } else {
        return err!(CandyGuardError::FreezeEscrowAlreadyExists);
    }

    // offset 1 to 9 (8 bytes) since the first byte is the freeze
    // instruction identifier
    let freeze_period = if let Ok(period) = i64::try_from_slice(&data[1..9]) {
        period
    } else {
        return err!(CandyGuardError::MissingFreezePeriod);
    };

    if freeze_period > FreezeEscrow::MAX_FREEZE_TIME {
        return err!(CandyGuardError::ExceededMaximumFreezePeriod);
    }

    // initilializes the escrow account (safe to be unchecked since the account
    // must be empty at this point)
    let mut freeze_escrow: Account<FreezeEscrow> = Account::try_from_unchecked(freeze_pda)?;
    freeze_escrow.init(
        *candy_guard_key,
        *candy_machine_key,
        None,
        freeze_period,
        destination,
        authority.key(),
    );

    freeze_escrow.exit(&crate::ID)
}

/// Helper function to thaw an nft.
pub fn thaw_nft<'c, 'info>(
    ctx: &Context<'_, '_, 'c, 'info, Route<'info>>,
    route_context: RouteContext,
    _data: Vec<u8>,
) -> Result<()>
where
    'c: 'info,
{
    let current_timestamp = Clock::get()?.unix_timestamp;

    let freeze_pda = try_get_account_info(ctx.remaining_accounts, 0)?;
    let mut freeze_escrow: Account<FreezeEscrow> = Account::try_from(freeze_pda)?;

    // thaw is automatically enabled if the candy machine account is closed, so
    // only check if we have one
    if let Some(ref candy_machine) = route_context.candy_machine {
        if !freeze_escrow.is_thaw_allowed(candy_machine, current_timestamp) {
            return err!(CandyGuardError::ThawNotEnabled);
        }
    }

    let nft_mint = try_get_account_info(ctx.remaining_accounts, 1)?;
    let nft_owner = try_get_account_info(ctx.remaining_accounts, 2)?;

    let nft_ata = try_get_account_info(ctx.remaining_accounts, 3)?;
    let nft_token_account = TokenAccount::unpack(&nft_ata.try_borrow_data()?)?;

    assert_keys_equal(nft_mint.key, &nft_token_account.mint)?;
    assert_keys_equal(nft_owner.key, &nft_token_account.owner)?;

    let nft_master_edition = try_get_account_info(ctx.remaining_accounts, 4)?;
    let payer = &ctx.accounts.payer;

    let token_program = try_get_account_info(ctx.remaining_accounts, 5)?;
    let token_metadata_program = try_get_account_info(ctx.remaining_accounts, 6)?;
    assert_keys_equal(token_metadata_program.key, &mpl_token_metadata::ID)?;

    let candy_guard_key = &ctx.accounts.candy_guard.key();
    let candy_machine_key = &ctx.accounts.candy_machine.key();

    let seeds = [
        FreezeEscrow::PREFIX_SEED,
        freeze_escrow.destination.as_ref(),
        candy_guard_key.as_ref(),
        candy_machine_key.as_ref(),
    ];
    let (pda, bump) = Pubkey::find_program_address(&seeds, &crate::ID);
    assert_keys_equal(&pda, freeze_pda.key)?;

    let signer = [
        FreezeEscrow::PREFIX_SEED,
        freeze_escrow.destination.as_ref(),
        candy_guard_key.as_ref(),
        candy_machine_key.as_ref(),
        &[bump],
    ];

    let is_programmable = assert_edition_is_programmable(&nft_master_edition.data.borrow()).is_ok();

    let is_frozen = if is_programmable {
        // for programmable assets, thaw consists of unlocking the token, transferring the
        // token to the freeze escrow ata and then transferring back to the owner; this will
        // clear the delegate reference on the owner token account

        let (escrow_ata_key, _) = Pubkey::find_program_address(
            &[
                freeze_escrow.key().as_ref(),
                spl_token::id().as_ref(),
                nft_mint.key.as_ref(),
            ],
            &spl_associated_token_account::id(),
        );

        let nft_metadata = try_get_account_info(ctx.remaining_accounts, 7)?;
        let escrow_ata = try_get_account_info(ctx.remaining_accounts, 8)?;
        let system_program_info = try_get_account_info(ctx.remaining_accounts, 9)?;
        let sysvar_instructions_info = try_get_account_info(ctx.remaining_accounts, 10)?;
        let spl_ata_program = try_get_account_info(ctx.remaining_accounts, 11)?;
        let owner_token_record = get_account_info(ctx.remaining_accounts, 12);
        let escrow_token_record = get_account_info(ctx.remaining_accounts, 13);
        let authorization_rules_program = get_account_info(ctx.remaining_accounts, 14);
        let authorization_rules = get_account_info(ctx.remaining_accounts, 15);

        let is_locked = if let Some(token_record) = owner_token_record {
            let token_record = TokenRecord::try_from(token_record)?;
            token_record.state == TokenState::Locked
        } else {
            nft_token_account.is_frozen()
        };

        // account validation happens on the CPI call, we only need to make sure we got
        // the correct escrow ata account
        assert_keys_equal(escrow_ata.key, &escrow_ata_key)?;

        if is_locked {
            // unlocks the token account

            UnlockV1CpiBuilder::new(token_metadata_program)
                .authority(freeze_pda)
                .token_owner(Some(nft_owner))
                .token(nft_ata)
                .mint(nft_mint)
                .metadata(nft_metadata)
                .edition(Some(nft_master_edition))
                .token_record(owner_token_record)
                .payer(&ctx.accounts.payer)
                .system_program(system_program_info)
                .sysvar_instructions(sysvar_instructions_info)
                .spl_token_program(Some(token_program))
                .invoke_signed(&[&signer])?;

            let freeze_escrow_info = freeze_escrow.to_account_info();

            // transfer out the asset (using a freeze escrow as delegate)

            TransferV1CpiBuilder::new(token_metadata_program)
                .authority(&freeze_escrow_info)
                .token(nft_ata)
                .token_owner(nft_owner)
                .destination_token(escrow_ata)
                .destination_owner(&freeze_escrow_info)
                .mint(nft_mint)
                .metadata(nft_metadata)
                .edition(Some(nft_master_edition))
                .token_record(owner_token_record)
                .destination_token_record(escrow_token_record)
                .payer(&ctx.accounts.payer)
                .system_program(system_program_info)
                .sysvar_instructions(sysvar_instructions_info)
                .spl_token_program(token_program)
                .spl_ata_program(spl_ata_program)
                .authorization_rules(authorization_rules)
                .authorization_rules_program(authorization_rules_program)
                .invoke_signed(&[&signer])?;

            // transfer in the asset (using a freeze escrow as owner)

            TransferV1CpiBuilder::new(token_metadata_program)
                .authority(&freeze_escrow_info)
                .token(escrow_ata)
                .token_owner(&freeze_escrow_info)
                .destination_token(nft_ata)
                .destination_owner(nft_owner)
                .mint(nft_mint)
                .metadata(nft_metadata)
                .edition(Some(nft_master_edition))
                .token_record(escrow_token_record)
                .destination_token_record(owner_token_record)
                .payer(&ctx.accounts.payer)
                .system_program(system_program_info)
                .sysvar_instructions(sysvar_instructions_info)
                .spl_token_program(token_program)
                .spl_ata_program(spl_ata_program)
                .authorization_rules(authorization_rules)
                .authorization_rules_program(authorization_rules_program)
                .invoke_signed(&[&signer])?;

            // closes the freeze escrow ATA

            invoke_signed(
                &spl_token::instruction::close_account(
                    token_program.key,
                    escrow_ata.key,
                    ctx.accounts.payer.key,
                    freeze_pda.key,
                    &[],
                )?,
                &[
                    escrow_ata.clone(),
                    ctx.accounts.payer.to_account_info(),
                    freeze_pda.clone(),
                ],
                &[&signer],
            )?;

            // decreases the freeze (lock) counter
            freeze_escrow.frozen_count = freeze_escrow.frozen_count.saturating_sub(1);
        } else {
            msg!("Token account is unlocked");
        }

        is_locked
    } else {
        let is_frozen = nft_token_account.is_frozen();

        if is_frozen {
            ThawDelegatedAccountCpiBuilder::new(token_metadata_program)
                .delegate(freeze_pda)
                .mint(nft_mint)
                .edition(nft_master_edition)
                .token_account(nft_ata)
                .token_program(token_program)
                .invoke_signed(&[&signer])?;
            // decreases the freeze counter
            freeze_escrow.frozen_count = freeze_escrow.frozen_count.saturating_sub(1);
        } else {
            msg!("Token account is not frozen");
        }

        if cmp_pubkeys(&payer.key(), &nft_owner.key()) {
            msg!("Revoking authority");
            invoke(
                &revoke(&spl_token::ID, &nft_ata.key(), &payer.key(), &[])?,
                &[nft_ata.to_account_info(), payer.to_account_info()],
            )?;
        } else {
            msg!("Token account owner is not signer, authority not revoked");
        }

        is_frozen
    };

    // We put this block at the end of the instruction to avoid subtleties with runtime
    // lamport balance checks
    if is_frozen {
        let rent = Rent::get()?;
        let rent_exempt_lamports = rent.minimum_balance(freeze_pda.data_len());
        if freeze_pda.lamports() >= rent_exempt_lamports + FREEZE_SOL_FEE {
            msg!(
                "Paying {} lamports from FreezePda account as crank reward",
                FREEZE_SOL_FEE
            );
            **freeze_pda.try_borrow_mut_lamports()? =
                freeze_pda.lamports().checked_sub(FREEZE_SOL_FEE).unwrap();
            **payer.try_borrow_mut_lamports()? =
                payer.lamports().checked_add(FREEZE_SOL_FEE).unwrap();
        } else {
            msg!("FreezePda account will not be rent-exempt. Skipping crank reward");
        }
    }
    // save the account state
    freeze_escrow.exit(&crate::ID)?;

    Ok(())
}

/// Helper function to unlock funds.
fn unlock_funds<'c, 'info>(
    ctx: &Context<'_, '_, 'c, 'info, Route<'info>>,
    route_context: RouteContext,
    _data: Vec<u8>,
) -> Result<()>
where
    'c: 'info,
{
    let candy_guard_key = &ctx.accounts.candy_guard.key();
    let candy_machine_key = &ctx.accounts.candy_machine.key();

    let freeze_pda = try_get_account_info(ctx.remaining_accounts, 0)?;
    let freeze_escrow: Account<FreezeEscrow> = Account::try_from(freeze_pda)?;

    let seeds = [
        FreezeEscrow::PREFIX_SEED,
        freeze_escrow.destination.as_ref(),
        candy_guard_key.as_ref(),
        candy_machine_key.as_ref(),
    ];
    let (pda, _) = Pubkey::find_program_address(&seeds, &crate::ID);
    assert_keys_equal(freeze_pda.key, &pda)?;

    // authority must the a signer
    let authority = try_get_account_info(ctx.remaining_accounts, 1)?;

    // if the candy guard account is present, we check the authority against
    // the candy guard authority; otherwise we use the freeze escrow authority
    let authority_check = if let Some(candy_guard) = route_context.candy_guard {
        candy_guard.authority
    } else {
        freeze_escrow.authority
    };

    if !(cmp_pubkeys(authority.key, &authority_check) && authority.is_signer) {
        return err!(CandyGuardError::MissingRequiredSignature);
    }

    // all NFTs must be thaw
    if freeze_escrow.frozen_count > 0 {
        return err!(CandyGuardError::UnlockNotEnabled);
    }

    let destination_address = try_get_account_info(ctx.remaining_accounts, 2)?;
    // funds should go to the destination account
    assert_keys_equal(destination_address.key, &freeze_escrow.destination)?;

    freeze_escrow.close(destination_address.to_account_info())?;

    Ok(())
}
