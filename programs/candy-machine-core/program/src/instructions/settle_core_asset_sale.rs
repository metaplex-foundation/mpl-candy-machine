use anchor_lang::prelude::*;
use crate::{
    assert_config_line, constants::{AUTHORITY_SEED, SELLER_HISTORY_SEED}, events::SettleItemSaleEvent, get_config_count, processors::{self, claim_proceeds, remove_from_loaded_bitmask}, state::CandyMachine, AssociatedToken, CandyError, ConfigLine, GumballState, SellerHistory, Token, TokenStandard
};

#[event_cpi]
#[derive(Accounts)]
pub struct SettleCoreAssetSale<'info> {
    /// Anyone can settle the sale
    #[account(mut)]
    payer: Signer<'info>,

    /// Candy machine account.
    #[account(
        mut,
        has_one = authority @ CandyError::InvalidAuthority,
        constraint = candy_machine.state == GumballState::SaleEnded @ CandyError::InvalidState
    )]
    candy_machine: Box<Account<'info, CandyMachine>>,

    /// CHECK: Safe due to seeds constraint
    #[account(
        mut,
        seeds = [
            AUTHORITY_SEED.as_bytes(), 
            candy_machine.key().as_ref()
        ],
        bump
    )]
    authority_pda: UncheckedAccount<'info>,

    /// Payment account for authority pda if using token payment
    #[account(mut)]
    authority_pda_payment_account: Option<UncheckedAccount<'info>>,

    /// Seller of the nft
    /// CHECK: Safe due to candy machine constraint
    #[account(mut)]
    authority: UncheckedAccount<'info>,

    /// Payment account for authority if using token payment
    #[account(mut)]
    authority_payment_account: Option<UncheckedAccount<'info>>,

    /// Seller of the nft
    /// CHECK: Safe due to item check
    #[account(mut)]
    seller: UncheckedAccount<'info>,

    /// Payment account for seller if using token payment
    #[account(mut)]
    seller_payment_account: Option<UncheckedAccount<'info>>,

    /// Seller history account.
    #[account(
        mut,
        seeds = [
            SELLER_HISTORY_SEED.as_bytes(),
            candy_machine.key().as_ref(),
            seller.key().as_ref()
        ],
        bump
    )]
    seller_history: Box<Account<'info, SellerHistory>>,

    /// buyer of the nft
    /// CHECK: Safe due to item check
    buyer: UncheckedAccount<'info>,

    /// Fee account for marketplace fee if using fee config
    #[account(mut)]
    fee_account: Option<UncheckedAccount<'info>>,

    /// Payment account for marketplace fee if using token payment
    #[account(mut)]
    fee_payment_account: Option<UncheckedAccount<'info>>,

    /// Payment mint if using non-native payment token
    payment_mint: Option<UncheckedAccount<'info>>,

    token_program: Program<'info, Token>,
    associated_token_program: Program<'info, AssociatedToken>,
    system_program: Program<'info, System>,
    rent: Sysvar<'info, Rent>,

    /// CHECK: Safe due to item check
    asset: UncheckedAccount<'info>,

    /// CHECK: Safe due to item check
    collection: Option<UncheckedAccount<'info>>,

    /// CHECK: Safe due to constraint
    #[account(address = mpl_core::ID)]
    mpl_core_program: UncheckedAccount<'info>,
}

pub fn settle_core_asset_sale<'info>(ctx: Context<'_, '_, '_, 'info, SettleCoreAssetSale<'info>>, index: u32) -> Result<()> {
    let candy_machine = &mut ctx.accounts.candy_machine;
    let seller_history = &mut ctx.accounts.seller_history;
    let payer = &ctx.accounts.payer.to_account_info();
    let buyer = &ctx.accounts.buyer.to_account_info();
    let authority_pda = &mut ctx.accounts.authority_pda.to_account_info();
    let authority = &mut ctx.accounts.authority.to_account_info();
    let seller = &mut ctx.accounts.seller.to_account_info();
    let mpl_core_program = &ctx.accounts.mpl_core_program.to_account_info();
    let token_program = &ctx.accounts.token_program.to_account_info();
    let associated_token_program = &ctx.accounts.associated_token_program.to_account_info();
    let system_program = &ctx.accounts.system_program.to_account_info();
    let rent = &ctx.accounts.rent.to_account_info();
    let asset = &ctx.accounts.asset.to_account_info();
    let collection_info = ctx.accounts.collection.as_ref().map(|account| account.to_account_info());
    let collection = collection_info.as_ref();

    assert_config_line(
        candy_machine,
        index,
        ConfigLine {
            mint: asset.key(),
            seller: seller.key(),
            buyer: buyer.key(),
            token_standard: TokenStandard::Core,
        },
    )?;

    let royalty_info = utils::core::royalties::get_verified_royalty_info(asset, collection)?;

    let payment_mint_info = ctx.accounts.payment_mint.as_ref().map(|mint| mint.to_account_info());
    let payment_mint = payment_mint_info.as_ref();

    let authority_pda_payment_account_info = ctx.accounts.authority_pda_payment_account.as_ref().map(|account| account.to_account_info());
    let authority_pda_payment_account = authority_pda_payment_account_info.as_ref();

    let authority_payment_account_info = ctx.accounts.authority_payment_account.as_ref().map(|account| account.to_account_info());
    let authority_payment_account = authority_payment_account_info.as_ref();

    let seller_payment_account_info = ctx.accounts.seller_payment_account.as_ref().map(|account| account.to_account_info());
    let seller_payment_account = seller_payment_account_info.as_ref();

    let mut fee_account_info = ctx.accounts.fee_account.as_ref().map(|account| account.to_account_info());
    let fee_account = fee_account_info.as_mut();

    let fee_payment_account_info = ctx.accounts.fee_payment_account.as_ref().map(|account| account.to_account_info());
    let fee_payment_account = fee_payment_account_info.as_ref();

    let auth_seeds = [
        AUTHORITY_SEED.as_bytes(),
        candy_machine.to_account_info().key.as_ref(),
        &[ctx.bumps.authority_pda],
    ];

    let proceeds = claim_proceeds(
        candy_machine, 
        seller_history,
        payer,
        authority_pda,
        authority_pda_payment_account,
        authority,
        authority_payment_account,
        seller,
        seller_payment_account,
        fee_account,
        fee_payment_account,
        payment_mint,
        &royalty_info,
        &ctx.remaining_accounts,
        associated_token_program,
        token_program, 
        system_program, 
        rent, 
        &auth_seeds
    )?;

    let account_info = candy_machine.to_account_info();
    let mut data = account_info.data.borrow_mut();
    let count = get_config_count(&data)?;
    let last_index = count - 1;

    if remove_from_loaded_bitmask(candy_machine.settings.item_capacity, last_index, *data)? {
        processors::claim_core_asset(
            authority_pda,
            payer,
            buyer,
            seller,
            asset,
            collection,
            mpl_core_program,
            system_program,
            &auth_seeds
        )?;
    }

    drop(data);

    emit_cpi!(SettleItemSaleEvent {
        mint: asset.key(),
        authority: candy_machine.authority.key(),
        seller: seller.key(),
        buyer: buyer.key(),
        price: candy_machine.settings.item_price,
        proceeds,
        payment_mint: candy_machine.settings.payment_mint,
        fee_config: candy_machine.marketplace_fee_config,
        curator_fee_bps: candy_machine.settings.curator_fee_bps
    });

    Ok(())
}