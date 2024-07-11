use crate::{
    assert_is_non_printable_edition, constants::AUTHORITY_SEED, state::CandyMachine, CandyError,
    ConfigLineInput, GumballState, Token, TokenStandard,
};
use anchor_lang::prelude::*;
use mpl_token_metadata::{
    accounts::Metadata,
    instructions::{FreezeDelegatedAccountCpi, FreezeDelegatedAccountCpiAccounts},
};
use solana_program::program::invoke;
use spl_token::instruction::approve;

/// Add nft to a gumball machine.
#[derive(Accounts)]
pub struct AddNft<'info> {
    /// Candy Machine account.
    #[account(
        mut,
        constraint = candy_machine.state != GumballState::SaleStarted @ CandyError::InvalidState,
    )]
    candy_machine: Account<'info, CandyMachine>,

    /// CHECK: Safe due to seeds constraint
    #[account(
        mut,
        seeds = [AUTHORITY_SEED.as_bytes(), candy_machine.to_account_info().key.as_ref()],
        bump
    )]
    authority_pda: UncheckedAccount<'info>,

    /// Seller of the nft
    seller: Signer<'info>,

    /// CHECK: Safe due to freeze
    mint: UncheckedAccount<'info>,

    /// CHECK: Safe due to freeze
    #[account(mut)]
    token_account: UncheckedAccount<'info>,

    /// CHECK: Safe due to processor mint check
    metadata: UncheckedAccount<'info>,

    /// CHECK: Safe due to freeze
    edition: UncheckedAccount<'info>,

    /// CHECK: Safe due to processor check
    allowlist: Option<UncheckedAccount<'info>>,

    token_program: Program<'info, Token>,

    /// CHECK: Safe due to constraint
    #[account(address = mpl_token_metadata::ID)]
    token_metadata_program: UncheckedAccount<'info>,
}

pub fn add_nft(ctx: Context<AddNft>, index: u32) -> Result<()> {
    // Validate that the nft is a primary sale
    let metadata_account = &ctx.accounts.metadata.to_account_info();
    let metadata = Metadata::try_from(metadata_account)?;
    require!(
        metadata.mint == ctx.accounts.mint.key(),
        CandyError::MintMismatch
    );
    require!(!metadata.primary_sale_happened, CandyError::NotPrimarySale);

    assert_is_non_printable_edition(&ctx.accounts.edition.to_account_info())?;

    let token_program = &ctx.accounts.token_program.to_account_info();
    let token_account = &ctx.accounts.token_account.to_account_info();
    let authority_pda = &ctx.accounts.authority_pda.to_account_info();
    let seller = &ctx.accounts.seller.to_account_info();
    let edition = &ctx.accounts.edition.to_account_info();
    let mint = &ctx.accounts.mint.to_account_info();

    let approve_ix = approve(
        token_program.key,
        token_account.key,
        authority_pda.key,
        seller.key,
        &[seller.key],
        1,
    )?;

    invoke(
        &approve_ix,
        &[
            token_program.to_account_info(),
            token_account.to_account_info(),
            authority_pda.to_account_info(),
            seller.to_account_info(),
        ],
    )?;

    let auth_seeds = [
        AUTHORITY_SEED.as_bytes(),
        ctx.accounts.candy_machine.to_account_info().key.as_ref(),
        &[ctx.bumps.authority_pda],
    ];
    FreezeDelegatedAccountCpi::new(
        &ctx.accounts.token_metadata_program.to_account_info(),
        FreezeDelegatedAccountCpiAccounts {
            delegate: authority_pda,
            token_account,
            edition,
            mint,
            token_program,
        },
    )
    .invoke_signed(&[&auth_seeds])?;

    let candy_machine = &mut ctx.accounts.candy_machine;
    crate::processors::add_config_lines(
        candy_machine,
        index,
        vec![ConfigLineInput {
            mint: ctx.accounts.mint.key(),
            seller: ctx.accounts.seller.key(),
        }],
        TokenStandard::NonFungible,
    )?;

    Ok(())
}
