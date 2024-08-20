use anchor_lang::prelude::*;
use crate::{
    assert_config_line, constants::AUTHORITY_SEED, events::ClaimItemEvent, processors, state::GumballMachine, GumballError, ConfigLine, GumballState, TokenStandard
};

#[event_cpi]
#[derive(Accounts)]
pub struct ClaimCoreAsset<'info> {
    /// Anyone can settle the sale
    #[account(mut)]
    payer: Signer<'info>,

    /// Gumball machine account.
    #[account(
        mut,
        constraint = gumball_machine.state == GumballState::SaleLive || gumball_machine.state == GumballState::SaleEnded @ GumballError::InvalidState
    )]
    gumball_machine: Box<Account<'info, GumballMachine>>,

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

    /// Seller of the nft
    /// CHECK: Safe due to item check
    #[account(mut)]
    seller: UncheckedAccount<'info>,


    /// buyer of the nft
    /// CHECK: Safe due to item check
    buyer: UncheckedAccount<'info>,

    system_program: Program<'info, System>,

    /// CHECK: Safe due to item check
    #[account(mut)]
    asset: UncheckedAccount<'info>,

    /// CHECK: Safe due to item check
    #[account(mut)]
    collection: Option<UncheckedAccount<'info>>,

    /// CHECK: Safe due to constraint
    #[account(address = mpl_core::ID)]
    mpl_core_program: UncheckedAccount<'info>,
}

pub fn claim_core_asset<'info>(ctx: Context<'_, '_, '_, 'info, ClaimCoreAsset<'info>>, index: u32) -> Result<()> {
    let gumball_machine = &mut ctx.accounts.gumball_machine;
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
        gumball_machine,
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
        gumball_machine.to_account_info().key.as_ref(),
        &[ctx.bumps.authority_pda],
    ];

    processors::claim_core_asset(
        gumball_machine,
        index,
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
        authority: gumball_machine.authority.key(),
        seller: seller.key(),
        buyer: buyer.key(),
    });

    Ok(())
}