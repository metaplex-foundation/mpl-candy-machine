use anchor_lang::prelude::*;
use arrayref::array_ref;
use mpl_token_metadata::{
    accounts::Metadata,
    instructions::{
        CreateMasterEditionV3CpiBuilder, CreateMetadataAccountV3CpiBuilder, CreateV1CpiBuilder,
        MintV1CpiBuilder, SetAndVerifyCollectionCpiBuilder,
        SetAndVerifySizedCollectionItemCpiBuilder, UpdateMetadataAccountV2CpiBuilder,
        UpdateV1CpiBuilder, VerifyCollectionV1CpiBuilder,
    },
    types::{Collection, DataV2, PrintSupply, RuleSetToggle, TokenStandard},
};
use solana_program::sysvar;

use crate::{
    constants::{
        AUTHORITY_SEED, EMPTY_STR, HIDDEN_SECTION, MPL_TOKEN_AUTH_RULES_PROGRAM, NULL_STRING,
    },
    utils::*,
    AccountVersion, CandyError, CandyMachine, ConfigLine,
};

/// Accounts to mint an NFT.
pub(crate) struct MintAccounts<'info> {
    pub authority_pda: AccountInfo<'info>,
    pub payer: AccountInfo<'info>,
    pub nft_owner: AccountInfo<'info>,
    pub nft_mint: AccountInfo<'info>,
    pub nft_mint_authority: AccountInfo<'info>,
    pub nft_metadata: AccountInfo<'info>,
    pub nft_master_edition: AccountInfo<'info>,
    pub token: Option<AccountInfo<'info>>,
    pub token_record: Option<AccountInfo<'info>>,
    pub collection_delegate_record: AccountInfo<'info>,
    pub collection_mint: AccountInfo<'info>,
    pub collection_metadata: AccountInfo<'info>,
    pub collection_master_edition: AccountInfo<'info>,
    pub collection_update_authority: AccountInfo<'info>,
    pub token_metadata_program: AccountInfo<'info>,
    pub spl_token_program: AccountInfo<'info>,
    pub spl_ata_program: Option<AccountInfo<'info>>,
    pub system_program: AccountInfo<'info>,
    pub sysvar_instructions: Option<AccountInfo<'info>>,
    pub recent_slothashes: AccountInfo<'info>,
}

pub fn mint_v2<'info>(ctx: Context<'_, '_, '_, 'info, MintV2<'info>>) -> Result<()> {
    let accounts = MintAccounts {
        spl_ata_program: ctx
            .accounts
            .spl_ata_program
            .as_ref()
            .map(|spl_ata_program| spl_ata_program.to_account_info()),
        authority_pda: ctx.accounts.authority_pda.to_account_info(),
        collection_delegate_record: ctx.accounts.collection_delegate_record.to_account_info(),
        collection_master_edition: ctx.accounts.collection_master_edition.to_account_info(),
        collection_metadata: ctx.accounts.collection_metadata.to_account_info(),
        collection_mint: ctx.accounts.collection_mint.to_account_info(),
        collection_update_authority: ctx.accounts.collection_update_authority.to_account_info(),
        nft_owner: ctx.accounts.nft_owner.to_account_info(),
        nft_master_edition: ctx.accounts.nft_master_edition.to_account_info(),
        nft_metadata: ctx.accounts.nft_metadata.to_account_info(),
        nft_mint: ctx.accounts.nft_mint.to_account_info(),
        nft_mint_authority: ctx.accounts.nft_mint_authority.to_account_info(),
        payer: ctx.accounts.payer.to_account_info(),
        recent_slothashes: ctx.accounts.recent_slothashes.to_account_info(),
        system_program: ctx.accounts.system_program.to_account_info(),
        sysvar_instructions: Some(ctx.accounts.sysvar_instructions.to_account_info()),
        token: ctx
            .accounts
            .token
            .as_ref()
            .map(|token| token.to_account_info()),
        token_metadata_program: ctx.accounts.token_metadata_program.to_account_info(),
        spl_token_program: ctx.accounts.spl_token_program.to_account_info(),
        token_record: ctx
            .accounts
            .token_record
            .as_ref()
            .map(|token_record| token_record.to_account_info()),
    };

    process_mint(
        &mut ctx.accounts.candy_machine,
        accounts,
        ctx.bumps["authority_pda"],
    )
}

/// Mint a new NFT.
///
/// The index minted depends on the configuration of the candy machine: it could be
/// a psuedo-randomly selected one or sequential. In both cases, after minted a
/// specific index, the candy machine does not allow to mint the same index again.
pub(crate) fn process_mint(
    candy_machine: &mut Box<Account<'_, CandyMachine>>,
    accounts: MintAccounts,
    bump: u8,
) -> Result<()> {
    if !accounts.nft_metadata.data_is_empty() {
        return err!(CandyError::MetadataAccountMustBeEmpty);
    }

    // are there items to be minted?
    if candy_machine.items_redeemed >= candy_machine.data.items_available {
        return err!(CandyError::CandyMachineEmpty);
    }

    // check that we got the correct collection mint
    if !cmp_pubkeys(
        &accounts.collection_mint.key(),
        &candy_machine.collection_mint,
    ) {
        return err!(CandyError::CollectionKeyMismatch);
    }

    // collection metadata must be owner by token metadata
    if !cmp_pubkeys(accounts.collection_metadata.owner, &mpl_token_metadata::ID) {
        return err!(CandyError::IncorrectOwner);
    }

    let collection_metadata_info = &accounts.collection_metadata;
    let collection_metadata: Metadata =
        Metadata::try_from(&collection_metadata_info.to_account_info())?;
    // check that the update authority matches the collection update authority
    if !cmp_pubkeys(
        &collection_metadata.update_authority,
        &accounts.collection_update_authority.key(),
    ) {
        return err!(CandyError::IncorrectCollectionAuthority);
    }

    // (2) selecting an item to mint

    let recent_slothashes = &accounts.recent_slothashes;
    let data = recent_slothashes.data.borrow();
    let most_recent = array_ref![data, 12, 8];

    let clock = Clock::get()?;
    // seed for the random number is a combination of the slot_hash - timestamp
    let seed = u64::from_le_bytes(*most_recent).saturating_sub(clock.unix_timestamp as u64);

    let remainder: usize = seed
        .checked_rem(candy_machine.data.items_available - candy_machine.items_redeemed)
        .ok_or(CandyError::NumericalOverflowError)? as usize;

    let config_line = get_config_line(candy_machine, remainder, candy_machine.items_redeemed)?;

    candy_machine.items_redeemed = candy_machine
        .items_redeemed
        .checked_add(1)
        .ok_or(CandyError::NumericalOverflowError)?;
    // release the data borrow
    drop(data);

    // (3) minting

    let mut creators: Vec<mpl_token_metadata::types::Creator> =
        vec![mpl_token_metadata::types::Creator {
            address: accounts.authority_pda.key(),
            verified: true,
            share: 0,
        }];

    for c in &candy_machine.data.creators {
        creators.push(mpl_token_metadata::types::Creator {
            address: c.address,
            verified: false,
            share: c.percentage_share,
        });
    }

    match candy_machine.version {
        AccountVersion::V1 => create(
            candy_machine,
            accounts,
            bump,
            config_line,
            creators,
            collection_metadata,
        ),
        AccountVersion::V2 => create_and_mint(
            candy_machine,
            accounts,
            bump,
            config_line,
            creators,
            collection_metadata,
        ),
    }
}

/// Selects and returns the information of a config line.
///
/// The selection could be either sequential or random.
pub fn get_config_line(
    candy_machine: &Account<'_, CandyMachine>,
    index: usize,
    mint_number: u64,
) -> Result<ConfigLine> {
    if let Some(hs) = &candy_machine.data.hidden_settings {
        return Ok(ConfigLine {
            name: replace_patterns(hs.name.clone(), mint_number as usize),
            uri: replace_patterns(hs.uri.clone(), mint_number as usize),
        });
    }
    let settings = if let Some(settings) = &candy_machine.data.config_line_settings {
        settings
    } else {
        return err!(CandyError::MissingConfigLinesSettings);
    };

    let account_info = candy_machine.to_account_info();
    let mut account_data = account_info.data.borrow_mut();

    // validates that all config lines were added to the candy machine
    let config_count = get_config_count(&account_data)? as u64;
    if config_count != candy_machine.data.items_available {
        return err!(CandyError::NotFullyLoaded);
    }

    // (1) determine the mint index (index is a random index on the available indices array)

    let value_to_use = if settings.is_sequential {
        mint_number as usize
    } else {
        let items_available = candy_machine.data.items_available;
        let indices_start = HIDDEN_SECTION
            + 4
            + (items_available as usize) * candy_machine.data.get_config_line_size()
            + (items_available
                .checked_div(8)
                .ok_or(CandyError::NumericalOverflowError)?
                + 1) as usize;
        // calculates the mint index and retrieves the value at that position
        let mint_index = indices_start + index * 4;
        let value_to_use = u32::from_le_bytes(*array_ref![account_data, mint_index, 4]) as usize;
        // calculates the last available index and retrieves the value at that position
        let last_index = indices_start + ((items_available - mint_number - 1) * 4) as usize;
        let last_value = u32::from_le_bytes(*array_ref![account_data, last_index, 4]);
        // swap-remove: this guarantees that we remove the used mint index from the available array
        // in a constant time O(1) no matter how big the indices array is
        account_data[mint_index..mint_index + 4].copy_from_slice(&u32::to_le_bytes(last_value));

        value_to_use
    };

    // (2) retrieve the config line at the mint_index position

    let mut position =
        HIDDEN_SECTION + 4 + value_to_use * candy_machine.data.get_config_line_size();
    let name_length = settings.name_length as usize;
    let uri_length = settings.uri_length as usize;

    let name = if name_length > 0 {
        let name_slice: &mut [u8] = &mut account_data[position..position + name_length];
        let name = String::from_utf8(name_slice.to_vec())
            .map_err(|_| CandyError::CouldNotRetrieveConfigLineData)?;
        name.trim_end_matches(NULL_STRING).to_string()
    } else {
        EMPTY_STR.to_string()
    };

    position += name_length;
    let uri = if uri_length > 0 {
        let uri_slice: &mut [u8] = &mut account_data[position..position + uri_length];
        let uri = String::from_utf8(uri_slice.to_vec())
            .map_err(|_| CandyError::CouldNotRetrieveConfigLineData)?;
        uri.trim_end_matches(NULL_STRING).to_string()
    } else {
        EMPTY_STR.to_string()
    };

    let complete_name = replace_patterns(settings.prefix_name.clone(), value_to_use) + &name;
    let complete_uri = replace_patterns(settings.prefix_uri.clone(), value_to_use) + &uri;

    Ok(ConfigLine {
        name: complete_name,
        uri: complete_uri,
    })
}

/// Creates the metadata accounts and mint a new token.
fn create_and_mint(
    candy_machine: &mut Box<Account<'_, CandyMachine>>,
    accounts: MintAccounts,
    bump: u8,
    config_line: ConfigLine,
    creators: Vec<mpl_token_metadata::types::Creator>,
    collection_metadata: Metadata,
) -> Result<()> {
    let candy_machine_key = candy_machine.key();
    let authority_seeds = [
        AUTHORITY_SEED.as_bytes(),
        candy_machine_key.as_ref(),
        &[bump],
    ];

    let sysvar_instructions_info = accounts
        .sysvar_instructions
        .as_ref()
        .ok_or(CandyError::MissingInstructionsSysvar)?;

    // create metadata accounts

    CreateV1CpiBuilder::new(&accounts.token_metadata_program)
        .metadata(&accounts.nft_metadata)
        .mint(&accounts.nft_mint, accounts.nft_mint.is_signer)
        .authority(&accounts.nft_mint_authority)
        .payer(&accounts.payer)
        .update_authority(&accounts.authority_pda, true)
        .master_edition(Some(&accounts.nft_master_edition))
        .token_standard(
            if candy_machine.token_standard == TokenStandard::ProgrammableNonFungible as u8 {
                TokenStandard::ProgrammableNonFungible
            } else {
                TokenStandard::NonFungible
            },
        )
        .name(config_line.name)
        .uri(config_line.uri)
        .symbol(candy_machine.data.symbol.to_string())
        .seller_fee_basis_points(candy_machine.data.seller_fee_basis_points)
        .is_mutable(candy_machine.data.is_mutable)
        .creators(creators)
        .collection(Collection {
            verified: false,
            key: candy_machine.collection_mint,
        })
        .decimals(0)
        .print_supply(if candy_machine.data.max_supply == 0 {
            PrintSupply::Zero
        } else {
            PrintSupply::Limited(candy_machine.data.max_supply)
        })
        .system_program(&accounts.system_program)
        .sysvar_instructions(sysvar_instructions_info)
        .spl_token_program(&accounts.spl_token_program)
        .invoke_signed(&[&authority_seeds])?;

    // mints one token

    let token_info = accounts
        .token
        .as_ref()
        .ok_or(CandyError::MissingTokenAccount)?;
    let token_record_info =
        if candy_machine.token_standard == TokenStandard::ProgrammableNonFungible as u8 {
            Some(
                accounts
                    .token_record
                    .as_ref()
                    .ok_or(CandyError::MissingTokenRecord)?,
            )
        } else {
            None
        };
    let spl_ata_program_info = accounts
        .spl_ata_program
        .as_ref()
        .ok_or(CandyError::MissingSplAtaProgram)?;

    MintV1CpiBuilder::new(&accounts.token_metadata_program)
        .token(token_info)
        .token_owner(Some(&accounts.nft_owner))
        .metadata(&accounts.nft_metadata)
        .master_edition(Some(&accounts.nft_master_edition))
        .mint(&accounts.nft_mint)
        .payer(&accounts.payer)
        .authority(&accounts.authority_pda)
        .token_record(token_record_info)
        .system_program(&accounts.system_program)
        .sysvar_instructions(sysvar_instructions_info)
        .spl_token_program(&accounts.spl_token_program)
        .spl_ata_program(spl_ata_program_info)
        .amount(1)
        .invoke_signed(&[&authority_seeds])?;

    // changes the update authority, primary sale happened, authorization rules

    let mut update_cpi = UpdateV1CpiBuilder::new(&accounts.token_metadata_program);
    update_cpi
        .authority(&accounts.authority_pda)
        .token(Some(token_info))
        .metadata(&accounts.nft_metadata)
        .edition(Some(&accounts.nft_master_edition))
        .mint(&accounts.nft_mint)
        .payer(&accounts.payer)
        .system_program(&accounts.system_program)
        .sysvar_instructions(sysvar_instructions_info)
        .primary_sale_happened(true)
        .new_update_authority(collection_metadata.update_authority);

    if candy_machine.token_standard == TokenStandard::ProgrammableNonFungible as u8 {
        let candy_machine_info = candy_machine.to_account_info();
        let account_data = candy_machine_info.data.borrow_mut();

        // the rule set for a newly minted pNFT is determined by:
        //   1. check if there is a rule set stored on the account; otherwise
        //   2. use the rule set from the collection metadata
        let candy_machine_rule_set =
            candy_machine.get_rule_set(&account_data, &collection_metadata)?;

        if let Some(rule_set) = candy_machine_rule_set {
            update_cpi.rule_set(RuleSetToggle::Set(rule_set));
        }
    }

    update_cpi.invoke_signed(&[&authority_seeds])?;

    // verify the minted nft into the collection

    VerifyCollectionV1CpiBuilder::new(&accounts.token_metadata_program)
        .authority(&accounts.authority_pda)
        .delegate_record(Some(&accounts.collection_delegate_record))
        .metadata(&accounts.nft_metadata)
        .collection_mint(&accounts.collection_mint)
        .collection_metadata(Some(&accounts.collection_metadata))
        .collection_master_edition(Some(&accounts.collection_master_edition))
        .system_program(&accounts.system_program)
        .sysvar_instructions(sysvar_instructions_info)
        .invoke_signed(&[&authority_seeds])
        .map_err(|error| error.into())
}

/// Creates the metadata accounts
fn create(
    candy_machine: &mut Box<Account<'_, CandyMachine>>,
    accounts: MintAccounts,
    bump: u8,
    config_line: ConfigLine,
    creators: Vec<mpl_token_metadata::types::Creator>,
    collection_metadata: Metadata,
) -> Result<()> {
    let cm_key = candy_machine.key();
    let authority_seeds = [AUTHORITY_SEED.as_bytes(), cm_key.as_ref(), &[bump]];

    // create metadata account

    CreateMetadataAccountV3CpiBuilder::new(&accounts.token_metadata_program)
        .metadata(&accounts.nft_metadata)
        .mint(&accounts.nft_mint)
        .mint_authority(&accounts.nft_mint_authority)
        .payer(&accounts.payer)
        .update_authority(&accounts.authority_pda, true)
        .system_program(&accounts.system_program)
        .data(DataV2 {
            name: config_line.name,
            uri: config_line.uri,
            symbol: candy_machine.data.symbol.to_string(),
            seller_fee_basis_points: candy_machine.data.seller_fee_basis_points,
            creators: Some(creators),
            collection: None,
            uses: None,
        })
        .is_mutable(candy_machine.data.is_mutable)
        .invoke_signed(&[&authority_seeds])?;

    // create master edition account

    CreateMasterEditionV3CpiBuilder::new(&accounts.token_metadata_program)
        .edition(&accounts.nft_master_edition)
        .mint(&accounts.nft_mint)
        .mint_authority(&accounts.nft_mint_authority)
        .update_authority(&accounts.authority_pda)
        .metadata(&accounts.nft_metadata)
        .payer(&accounts.payer)
        .system_program(&accounts.system_program)
        .token_program(&accounts.spl_token_program)
        .max_supply(candy_machine.data.max_supply)
        .invoke_signed(&[&authority_seeds])?;

    // update metadata account

    UpdateMetadataAccountV2CpiBuilder::new(&accounts.token_metadata_program)
        .metadata(&accounts.nft_metadata)
        .update_authority(&accounts.authority_pda)
        .new_update_authority(collection_metadata.update_authority)
        .primary_sale_happened(true)
        .invoke_signed(&[&authority_seeds])?;

    // set and verify collection

    if collection_metadata.collection_details.is_some() {
        SetAndVerifySizedCollectionItemCpiBuilder::new(&accounts.token_metadata_program)
            .metadata(&accounts.nft_metadata)
            .collection_authority(&accounts.authority_pda)
            .collection_authority_record(Some(&accounts.collection_delegate_record))
            .collection(&accounts.collection_metadata)
            .collection_master_edition_account(&accounts.collection_master_edition)
            .collection_mint(&accounts.collection_mint)
            .update_authority(&accounts.collection_update_authority)
            .payer(&accounts.payer)
            .invoke_signed(&[&authority_seeds])
            .map_err(|error| error.into())
    } else {
        SetAndVerifyCollectionCpiBuilder::new(&accounts.token_metadata_program)
            .metadata(&accounts.nft_metadata)
            .collection_authority(&accounts.authority_pda)
            .collection_authority_record(Some(&accounts.collection_delegate_record))
            .collection(&accounts.collection_metadata)
            .collection_master_edition_account(&accounts.collection_master_edition)
            .collection_mint(&accounts.collection_mint)
            .update_authority(&accounts.collection_update_authority)
            .payer(&accounts.payer)
            .invoke_signed(&[&authority_seeds])
            .map_err(|error| error.into())
    }
}

/// Mints a new NFT.
#[derive(Accounts)]
pub struct MintV2<'info> {
    /// Candy machine account.
    #[account(mut, has_one = mint_authority)]
    candy_machine: Box<Account<'info, CandyMachine>>,

    /// Candy machine authority account. This is the account that holds a delegate
    /// to verify an item into the collection.
    ///
    /// CHECK: account constraints checked in account trait
    #[account(mut, seeds = [AUTHORITY_SEED.as_bytes(), candy_machine.key().as_ref()], bump)]
    authority_pda: UncheckedAccount<'info>,

    /// Candy machine mint authority (mint only allowed for the mint_authority).
    mint_authority: Signer<'info>,

    /// Payer for the transaction and account allocation (rent).
    #[account(mut)]
    payer: Signer<'info>,

    /// NFT account owner.
    ///
    /// CHECK: account not written or read from
    nft_owner: UncheckedAccount<'info>,

    /// Mint account of the NFT. The account will be initialized if necessary.
    ///
    /// CHECK: account checked in CPI
    #[account(mut)]
    nft_mint: UncheckedAccount<'info>,

    /// Mint authority of the NFT. In most cases this will be the owner of the NFT.
    nft_mint_authority: Signer<'info>,

    /// Metadata account of the NFT. This account must be uninitialized.
    ///
    /// CHECK: account checked in CPI
    #[account(mut)]
    nft_metadata: UncheckedAccount<'info>,

    /// Master edition account of the NFT. The account will be initialized if necessary.
    ///
    /// CHECK: account checked in CPI
    #[account(mut)]
    nft_master_edition: UncheckedAccount<'info>,

    /// Destination token account (required for pNFT).
    ///
    /// CHECK: account checked in CPI
    #[account(mut)]
    token: Option<UncheckedAccount<'info>>,

    /// Token record (required for pNFT).
    ///
    /// CHECK: account checked in CPI
    #[account(mut)]
    token_record: Option<UncheckedAccount<'info>>,

    /// Collection authority or metadata delegate record.
    ///
    /// CHECK: account checked in CPI
    collection_delegate_record: UncheckedAccount<'info>,

    /// Mint account of the collection NFT.
    ///
    /// CHECK: account checked in CPI
    collection_mint: UncheckedAccount<'info>,

    /// Metadata account of the collection NFT.
    ///
    /// CHECK: account checked in CPI
    #[account(mut)]
    collection_metadata: UncheckedAccount<'info>,

    /// Master edition account of the collection NFT.
    ///
    /// CHECK: account checked in CPI
    collection_master_edition: UncheckedAccount<'info>,

    /// Update authority of the collection NFT.
    ///
    /// CHECK: account checked in CPI
    collection_update_authority: UncheckedAccount<'info>,

    /// Token Metadata program.
    ///
    /// CHECK: account checked in CPI
    #[account(address = mpl_token_metadata::ID)]
    token_metadata_program: UncheckedAccount<'info>,

    /// SPL Token program.
    spl_token_program: Program<'info, Token>,

    /// SPL Associated Token program.
    spl_ata_program: Option<Program<'info, AssociatedToken>>,

    /// System program.
    system_program: Program<'info, System>,

    /// Instructions sysvar account.
    ///
    /// CHECK: account constraints checked in account trait
    #[account(address = sysvar::instructions::id())]
    sysvar_instructions: UncheckedAccount<'info>,

    /// SlotHashes sysvar cluster data.
    ///
    /// CHECK: account constraints checked in account trait
    #[account(address = sysvar::slot_hashes::id())]
    recent_slothashes: UncheckedAccount<'info>,

    /// Token Authorization Rules program.
    ///
    /// CHECK: account checked in CPI
    #[account(address = MPL_TOKEN_AUTH_RULES_PROGRAM)]
    authorization_rules_program: Option<UncheckedAccount<'info>>,

    /// Token Authorization rules account for the collection metadata (if any).
    ///
    /// CHECK: account constraints checked in account trait
    #[account(owner = MPL_TOKEN_AUTH_RULES_PROGRAM)]
    authorization_rules: Option<UncheckedAccount<'info>>,
}
