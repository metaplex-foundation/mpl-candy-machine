use crate::{
    assert_can_add_item,
    constants::{AUTHORITY_SEED, SELLER_HISTORY_SEED},
    state::CandyMachine,
    CandyError, ConfigLineInput, GumballState, SellerHistory, TokenStandard,
};
use anchor_lang::prelude::*;
use mpl_core::{
    accounts::{BaseAssetV1, BaseCollectionV1},
    fetch_plugin,
    instructions::{
        AddPluginV1CpiBuilder, ApprovePluginAuthorityV1CpiBuilder, UpdatePluginV1CpiBuilder,
    },
    types::{
        FreezeDelegate, PermanentBurnDelegate, PermanentFreezeDelegate, PermanentTransferDelegate,
        Plugin, PluginAuthority, PluginType, TransferDelegate,
    },
};

/// Add core asset to a gumball machine.
#[derive(Accounts)]
pub struct AddCoreAsset<'info> {
    /// Candy Machine account.
    #[account(
        mut,
        constraint = candy_machine.state != GumballState::SaleLive @ CandyError::InvalidState,
    )]
    candy_machine: Box<Account<'info, CandyMachine>>,

    /// Seller history account.
    #[account(
		init_if_needed,
		seeds = [
			SELLER_HISTORY_SEED.as_bytes(),
			candy_machine.key().as_ref(),
            seller.key().as_ref(),
		],
		bump,
		space = SellerHistory::SPACE,
		payer = seller
	)]
    seller_history: Box<Account<'info, SellerHistory>>,

    /// CHECK: Safe due to seeds constraint
    #[account(
        mut,
        seeds = [AUTHORITY_SEED.as_bytes(), candy_machine.to_account_info().key.as_ref()],
        bump
    )]
    authority_pda: UncheckedAccount<'info>,

    /// Seller of the asset.
    #[account(mut)]
    seller: Signer<'info>,

    /// CHECK: Safe due to freeze
    #[account(mut)]
    asset: UncheckedAccount<'info>,

    /// Core asset's collection if it's part of one.
    /// CHECK: Verified in mpl_core processors
    #[account(mut)]
    collection: Option<UncheckedAccount<'info>>,

    /// CHECK: Safe due to address constraint
    #[account(address = mpl_core::ID)]
    mpl_core_program: UncheckedAccount<'info>,

    system_program: Program<'info, System>,
}

pub fn add_core_asset(
    ctx: Context<AddCoreAsset>,
    seller_proof_path: Option<Vec<[u8; 32]>>,
) -> Result<()> {
    let asset_info = &ctx.accounts.asset.to_account_info();
    let seller = &ctx.accounts.seller.to_account_info();
    let mpl_core_program = &ctx.accounts.mpl_core_program.to_account_info();
    let system_program = &ctx.accounts.system_program.to_account_info();
    let authority_pda_key = ctx.accounts.authority_pda.key();
    let candy_machine = &mut ctx.accounts.candy_machine;
    let seller_history = &mut ctx.accounts.seller_history;

    seller_history.candy_machine = candy_machine.key();
    seller_history.seller = seller.key();

    // Validate the seller
    assert_can_add_item(candy_machine, seller_history, seller_proof_path)?;

    seller_history.item_count += 1;

    let collection_info = if let Some(collection) = &ctx.accounts.collection {
        Some(collection.to_account_info())
    } else {
        None
    };

    let collection = if let Some(collection) = &collection_info {
        Some(collection)
    } else {
        None
    };

    // Make sure the collection doesn't have any Permanent delegates
    if let Some(collection) = collection {
        if let Ok(_) = fetch_plugin::<BaseCollectionV1, PermanentTransferDelegate>(
            collection,
            PluginType::PermanentTransferDelegate,
        ) {
            msg!("Collection cannot have the PermanentTransferDelegate plugin");
            return err!(CandyError::InvalidCollection);
        }

        if let Ok(_) = fetch_plugin::<BaseCollectionV1, PermanentFreezeDelegate>(
            collection,
            PluginType::PermanentFreezeDelegate,
        ) {
            msg!("Collection cannot have the PermanentFreezeDelegate plugin");
            return err!(CandyError::InvalidCollection);
        }

        if let Ok(_) = fetch_plugin::<BaseCollectionV1, PermanentBurnDelegate>(
            collection,
            PluginType::PermanentBurnDelegate,
        ) {
            msg!("Collection cannot have the PermanentBurnDelegate plugin");
            return err!(CandyError::InvalidCollection);
        }
    }

    crate::processors::add_item(
        candy_machine,
        ConfigLineInput {
            mint: ctx.accounts.asset.key(),
            seller: ctx.accounts.seller.key(),
        },
        TokenStandard::Core,
    )?;

    // Approve
    if let Err(_) =
        fetch_plugin::<BaseAssetV1, TransferDelegate>(asset_info, PluginType::TransferDelegate)
    {
        AddPluginV1CpiBuilder::new(mpl_core_program)
            .asset(asset_info)
            .collection(collection)
            .payer(seller)
            .plugin(Plugin::TransferDelegate(TransferDelegate {}))
            .init_authority(PluginAuthority::Address {
                address: authority_pda_key,
            })
            .system_program(system_program)
            .invoke()?;
    } else {
        ApprovePluginAuthorityV1CpiBuilder::new(mpl_core_program)
            .asset(asset_info)
            .collection(collection)
            .payer(seller)
            .new_authority(PluginAuthority::Address {
                address: authority_pda_key,
            })
            .plugin_type(PluginType::TransferDelegate)
            .system_program(system_program)
            .invoke()?;
    }

    let auth_seeds = [
        AUTHORITY_SEED.as_bytes(),
        ctx.accounts.candy_machine.to_account_info().key.as_ref(),
        &[ctx.bumps.authority_pda],
    ];

    // Freeze
    if let Err(_) =
        fetch_plugin::<BaseAssetV1, TransferDelegate>(asset_info, PluginType::FreezeDelegate)
    {
        AddPluginV1CpiBuilder::new(mpl_core_program)
            .asset(asset_info)
            .collection(collection)
            .payer(seller)
            .plugin(Plugin::FreezeDelegate(FreezeDelegate { frozen: true }))
            .init_authority(PluginAuthority::Address {
                address: authority_pda_key,
            })
            .system_program(system_program)
            .invoke_signed(&[&auth_seeds])?;
    } else {
        ApprovePluginAuthorityV1CpiBuilder::new(mpl_core_program)
            .asset(asset_info)
            .collection(collection)
            .payer(seller)
            .new_authority(PluginAuthority::Address {
                address: authority_pda_key,
            })
            .plugin_type(PluginType::FreezeDelegate)
            .system_program(system_program)
            .invoke()?;

        UpdatePluginV1CpiBuilder::new(mpl_core_program)
            .asset(asset_info)
            .collection(collection)
            .payer(seller)
            .plugin(Plugin::FreezeDelegate(FreezeDelegate { frozen: true }))
            .authority(Some(&ctx.accounts.authority_pda.to_account_info()))
            .system_program(system_program)
            .invoke_signed(&[&auth_seeds])?;
    }

    Ok(())
}
