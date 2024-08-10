use crate::{
    constants::{AUTHORITY_SEED, SELLER_HISTORY_SEED},
    processors,
    state::GumballMachine,
    AssociatedToken, GumballError, GumballState, SellerHistory, Token,
};
use anchor_lang::prelude::*;
use mpl_token_metadata::instructions::{ThawDelegatedAccountCpi, ThawDelegatedAccountCpiAccounts};
use solana_program::program::{invoke, invoke_signed};
use spl_associated_token_account::instruction::create_associated_token_account_idempotent;
use spl_token::instruction::transfer_checked;

/// Add nft to a gumball machine.
#[derive(Accounts)]
pub struct RemoveNft<'info> {
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
        seeds = [AUTHORITY_SEED.as_bytes(), gumball_machine.to_account_info().key.as_ref()],
        bump
    )]
    authority_pda: UncheckedAccount<'info>,

    /// Authority allowed to remove the nft (must be the gumball machine auth or the seller of the nft)
    authority: Signer<'info>,

    /// CHECK: Safe due to item seller check
    #[account(mut)]
    seller: UncheckedAccount<'info>,

    /// CHECK: Safe due to transfer
    mint: UncheckedAccount<'info>,

    /// CHECK: Safe due to transfer
    #[account(mut)]
    token_account: UncheckedAccount<'info>,

    /// CHECK: Safe due to transfer
    #[account(mut)]
    tmp_token_account: UncheckedAccount<'info>,

    /// CHECK: Safe due to thaw
    edition: UncheckedAccount<'info>,

    token_program: Program<'info, Token>,

    associated_token_program: Program<'info, AssociatedToken>,

    /// CHECK: Safe due to constraint
    #[account(address = mpl_token_metadata::ID)]
    token_metadata_program: UncheckedAccount<'info>,

    system_program: Program<'info, System>,
    rent: Sysvar<'info, Rent>,
}

pub fn remove_nft(ctx: Context<RemoveNft>, index: u32) -> Result<()> {
    let system_program = &ctx.accounts.system_program.to_account_info();
    let rent = &ctx.accounts.rent.to_account_info();
    let token_program = &ctx.accounts.token_program.to_account_info();
    let associated_token_program = &ctx.accounts.associated_token_program.to_account_info();
    let token_metadata_program = &ctx.accounts.token_metadata_program.to_account_info();
    let token_account = &ctx.accounts.token_account.to_account_info();
    let tmp_token_account = &ctx.accounts.tmp_token_account.to_account_info();
    let authority_pda = &ctx.accounts.authority_pda.to_account_info();
    let authority = &ctx.accounts.authority.to_account_info();
    let edition = &ctx.accounts.edition.to_account_info();
    let mint = &ctx.accounts.mint.to_account_info();
    let seller = &ctx.accounts.seller.to_account_info();
    let gumball_machine = &mut ctx.accounts.gumball_machine;
    let seller_history = &mut ctx.accounts.seller_history;

    processors::remove_item(
        gumball_machine,
        authority.key(),
        mint.key(),
        seller.key(),
        index,
    )?;

    let auth_seeds = [
        AUTHORITY_SEED.as_bytes(),
        ctx.accounts.gumball_machine.to_account_info().key.as_ref(),
        &[ctx.bumps.authority_pda],
    ];

    ThawDelegatedAccountCpi::new(
        token_metadata_program,
        ThawDelegatedAccountCpiAccounts {
            delegate: authority_pda,
            token_account,
            edition,
            mint,
            token_program,
        },
    )
    .invoke_signed(&[&auth_seeds])?;

    // Send to a temporary account to revoke
    invoke(
        &create_associated_token_account_idempotent(
            authority.key,
            authority_pda.key,
            mint.key,
            token_program.key,
        ),
        &[
            token_program.to_account_info(),
            associated_token_program.to_account_info(),
            authority_pda.to_account_info(),
            authority.to_account_info(),
            mint.to_account_info(),
            tmp_token_account.to_account_info(),
            system_program.to_account_info(),
            rent.to_account_info(),
        ],
    )?;

    invoke_signed(
        &transfer_checked(
            token_program.key,
            token_account.key,
            mint.key,
            tmp_token_account.key,
            authority_pda.key,
            &[],
            1,
            0,
        )?,
        &[
            token_program.to_account_info(),
            token_account.to_account_info(),
            mint.to_account_info(),
            tmp_token_account.to_account_info(),
            authority_pda.to_account_info(),
            system_program.to_account_info(),
        ],
        &[&auth_seeds],
    )?;

    invoke_signed(
        &transfer_checked(
            token_program.key,
            tmp_token_account.key,
            mint.key,
            token_account.key,
            authority_pda.key,
            &[],
            1,
            0,
        )?,
        &[
            token_program.to_account_info(),
            token_account.to_account_info(),
            mint.to_account_info(),
            tmp_token_account.to_account_info(),
            authority_pda.to_account_info(),
            system_program.to_account_info(),
        ],
        &[&auth_seeds],
    )?;

    seller_history.item_count -= 1;

    if seller_history.item_count == 0 {
        seller_history.close(seller.to_account_info())?;
    }

    Ok(())
}
