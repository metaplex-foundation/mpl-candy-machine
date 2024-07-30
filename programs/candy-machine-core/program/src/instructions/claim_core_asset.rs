use anchor_lang::prelude::*;
use crate::{
    assert_config_line, constants::AUTHORITY_SEED, events::ClaimItemEvent, processors, state::CandyMachine, CandyError, ConfigLine, GumballState, TokenStandard
};

#[event_cpi]
#[derive(Accounts)]
pub struct ClaimCoreAsset<'info> {
    /// Anyone can settle the sale
    #[account(mut)]
    payer: Signer<'info>,

    /// Candy machine account.
    #[account(
        mut,
        constraint = candy_machine.state == GumballState::SaleLive || candy_machine.state == GumballState::SaleEnded @ CandyError::InvalidState
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

    system_program: Program<'info, System>,
    rent: Sysvar<'info, Rent>,

    /// CHECK: Safe due to item check
    #[account(mut)]
    asset: UncheckedAccount<'info>,

    /// CHECK: Safe due to item check
    collection: Option<UncheckedAccount<'info>>,

    /// CHECK: Safe due to constraint
    #[account(address = mpl_core::ID)]
    mpl_core_program: UncheckedAccount<'info>,
}

pub fn claim_core_asset<'info>(ctx: Context<'_, '_, '_, 'info, ClaimCoreAsset<'info>>, index: u32) -> Result<()> {
    let candy_machine = &mut ctx.accounts.candy_machine;
    let payer = &ctx.accounts.payer.to_account_info();
    let buyer = &ctx.accounts.buyer.to_account_info();
    let authority_pda = &mut ctx.accounts.authority_pda.to_account_info();
    let seller = &mut ctx.accounts.seller.to_account_info();
    let mpl_core_program = &ctx.accounts.mpl_core_program.to_account_info();
    let system_program = &ctx.accounts.system_program.to_account_info();
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

    let auth_seeds = [
        AUTHORITY_SEED.as_bytes(),
        candy_machine.to_account_info().key.as_ref(),
        &[ctx.bumps.authority_pda],
    ];

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

    emit_cpi!(ClaimItemEvent {
        mint: asset.key(),
        authority: candy_machine.authority.key(),
        seller: seller.key(),
        buyer: buyer.key(),
    });

    Ok(())
}