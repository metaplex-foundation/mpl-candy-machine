use anchor_lang::prelude::*;
use utils::get_verified_royalty_info;
use crate::{
    assert_config_line, constants::{AUTHORITY_SEED, SELLER_HISTORY_SEED}, events::SettleItemSaleEvent, get_config_count, processors::{self, claim_proceeds, remove_from_loaded_bitmask}, state::CandyMachine, AssociatedToken, CandyError, ConfigLine, GumballState, SellerHistory, Token, TokenStandard
};

/// Settles a legacy NFT sale
#[event_cpi]
#[derive(Accounts)]
pub struct SettleNftSale<'info> {
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
    mint: UncheckedAccount<'info>,

    /// CHECK: Safe due to thaw/transfer
    #[account(mut)]
    token_account: UncheckedAccount<'info>,

    /// Nft token account for buyer
    /// CHECK: Safe due to ata check in transfer
    #[account(mut)]
    buyer_token_account: UncheckedAccount<'info>,

    /// CHECK: Safe due to transfer
    #[account(mut)]
    tmp_token_account: UncheckedAccount<'info>,

    /// CHECK: Safe due to processor royalties check
    #[account(mut)]
    metadata: UncheckedAccount<'info>,

    /// CHECK: Safe due to thaw/send
    #[account(mut)]
    edition: UncheckedAccount<'info>,

    /// CHECK: Safe due to constraint
    #[account(address = mpl_token_metadata::ID)]
    token_metadata_program: UncheckedAccount<'info>,
}

pub fn settle_nft_sale<'info>(ctx: Context<'_, '_, '_, 'info, SettleNftSale<'info>>, index: u32) -> Result<()> {
    let candy_machine = &mut ctx.accounts.candy_machine;
    let seller_history = &mut ctx.accounts.seller_history;
    let payer = &ctx.accounts.payer.to_account_info();
    let buyer = &ctx.accounts.buyer.to_account_info();
    let buyer_token_account = &ctx.accounts.buyer_token_account.to_account_info();
    let tmp_token_account = &ctx.accounts.tmp_token_account.to_account_info();
    let authority_pda = &mut ctx.accounts.authority_pda.to_account_info();
    let authority = &mut ctx.accounts.authority.to_account_info();
    let seller = &mut ctx.accounts.seller.to_account_info();
    let token_metadata_program = &ctx.accounts.token_metadata_program.to_account_info();
    let token_account = &ctx.accounts.token_account.to_account_info();
    let token_program = &ctx.accounts.token_program.to_account_info();
    let associated_token_program = &ctx.accounts.associated_token_program.to_account_info();
    let system_program = &ctx.accounts.system_program.to_account_info();
    let rent = &ctx.accounts.rent.to_account_info();
    let metadata = &ctx.accounts.metadata.to_account_info();
    let edition = &ctx.accounts.edition.to_account_info();
    let mint = &ctx.accounts.mint.to_account_info();

    assert_config_line(
        candy_machine,
        index,
        ConfigLine {
            mint: mint.key(),
            seller: seller.key(),
            buyer: buyer.key(),
            token_standard: TokenStandard::NonFungible,
        },
    )?;

    let royalty_info = get_verified_royalty_info(metadata, mint)?;

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

    let account_info = candy_machine.to_account_info();
    let mut data = account_info.data.borrow_mut();
    let count = get_config_count(&data)?;
    let last_index = count - 1;

    if remove_from_loaded_bitmask(candy_machine.settings.item_capacity, last_index, *data)? {
        processors::claim_nft(
            authority_pda,
            payer,
            buyer,
            buyer_token_account,
            seller,
            token_account,
            tmp_token_account,
            mint,
            edition,
            metadata,
            token_program,
            associated_token_program,
            token_metadata_program,
            system_program,
            rent,
            &royalty_info,
            &auth_seeds,
        )?;
    }

    drop(data);

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

    emit_cpi!(SettleItemSaleEvent {
        mint: mint.key(),
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