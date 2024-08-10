use crate::{
    constants::{AUTHORITY_SEED, SELLER_HISTORY_SEED},
    processors,
    state::GumballMachine,
    GumballError, GumballState, SellerHistory,
};
use anchor_lang::prelude::*;
use mpl_core::{
    instructions::{
        RemovePluginV1CpiBuilder, RevokePluginAuthorityV1CpiBuilder, UpdatePluginV1CpiBuilder,
    },
    types::{FreezeDelegate, Plugin, PluginType},
};

/// Add core asset to a gumball machine.
#[derive(Accounts)]
pub struct RemoveCoreAsset<'info> {
    /// Gumball Machine account.
    #[account(
        mut,
        constraint = gumball_machine.state == GumballState::None || gumball_machine.state == GumballState::DetailsFinalized @ GumballError::InvalidState,
    )]
    gumball_machine: Account<'info, GumballMachine>,

    /// Seller history account.
    #[account(
		mut,
		seeds = [
			SELLER_HISTORY_SEED.as_bytes(),
			gumball_machine.key().as_ref(),
            seller.key().as_ref(),
		],
		bump,
        has_one = gumball_machine,
        has_one = seller,
	)]
    seller_history: Box<Account<'info, SellerHistory>>,

    /// CHECK: Safe due to seeds constraint
    #[account(
        mut,
        seeds = [
            AUTHORITY_SEED.as_bytes(), 
            gumball_machine.key().as_ref()
        ],
        bump
    )]
    authority_pda: UncheckedAccount<'info>,

    /// Seller of the asset.
    authority: Signer<'info>,

    /// CHECK: Safe due to item seller check
    #[account(mut)]
    seller: UncheckedAccount<'info>,

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

pub fn remove_core_asset(ctx: Context<RemoveCoreAsset>, index: u32) -> Result<()> {
    let asset_info = &ctx.accounts.asset.to_account_info();
    let authority = &ctx.accounts.authority.to_account_info();
    let mpl_core_program = &ctx.accounts.mpl_core_program.to_account_info();
    let system_program = &ctx.accounts.system_program.to_account_info();
    let authority_pda = &ctx.accounts.authority_pda.to_account_info();
    let seller = &ctx.accounts.seller.to_account_info();
    let gumball_machine = &mut ctx.accounts.gumball_machine;
    let seller_history = &mut ctx.accounts.seller_history;

    processors::remove_item(
        gumball_machine,
        authority.key(),
        asset_info.key(),
        seller.key(),
        index,
    )?;

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

    let auth_seeds = [
        AUTHORITY_SEED.as_bytes(),
        ctx.accounts.gumball_machine.to_account_info().key.as_ref(),
        &[ctx.bumps.authority_pda],
    ];

    // Thaw
    UpdatePluginV1CpiBuilder::new(mpl_core_program)
        .asset(asset_info)
        .collection(collection)
        .payer(authority)
        .plugin(Plugin::FreezeDelegate(FreezeDelegate { frozen: false }))
        .authority(Some(authority_pda))
        .system_program(system_program)
        .invoke_signed(&[&auth_seeds])?;

    // Can only remove plugins if the seller is the authority
    if seller.key() == authority.key() {
        // Clean up freeze plugin back to seller
        RemovePluginV1CpiBuilder::new(mpl_core_program)
            .asset(asset_info)
            .collection(collection)
            .payer(authority)
            .plugin_type(PluginType::FreezeDelegate)
            .system_program(system_program)
            .invoke()?;

        // Clean up transfer delegate plugin back to seller
        RemovePluginV1CpiBuilder::new(mpl_core_program)
            .asset(asset_info)
            .collection(collection)
            .payer(authority)
            .plugin_type(PluginType::TransferDelegate)
            .system_program(system_program)
            .invoke()?;
    } else {
        // Revoke
        RevokePluginAuthorityV1CpiBuilder::new(mpl_core_program)
            .asset(asset_info)
            .collection(collection)
            .payer(authority)
            .plugin_type(PluginType::FreezeDelegate)
            .authority(Some(authority_pda))
            .system_program(system_program)
            .invoke_signed(&[&auth_seeds])?;

        // Revoke
        RevokePluginAuthorityV1CpiBuilder::new(mpl_core_program)
            .asset(asset_info)
            .collection(collection)
            .payer(authority)
            .plugin_type(PluginType::TransferDelegate)
            .authority(Some(authority_pda))
            .system_program(system_program)
            .invoke_signed(&[&auth_seeds])?;
    }

    seller_history.item_count -= 1;

    if seller_history.item_count == 0 {
        seller_history.close(seller.to_account_info())?;
    }

    Ok(())
}
