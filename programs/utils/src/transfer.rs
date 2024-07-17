use crate::{assert_is_ata, error::Error, is_native_mint};
use anchor_lang::prelude::*;
use anchor_spl::token;
use anchor_spl::token::Transfer;
use solana_program::program::{invoke, invoke_signed};
use solana_program::{account_info::AccountInfo, system_instruction};
use spl_associated_token_account::instruction::create_associated_token_account;

/// Transfers SOL or SPL tokens from a program owned account to another account.
pub fn transfer<'a>(
    from: &AccountInfo<'a>,
    to: &AccountInfo<'a>,
    from_currency_account: Option<&AccountInfo<'a>>,
    to_currency_account: Option<&AccountInfo<'a>>,
    currency_mint: Option<&AccountInfo<'a>>,
    fee_payer: Option<&AccountInfo<'a>>,
    ata_program: &AccountInfo<'a>,
    token_program: &AccountInfo<'a>,
    system_program: &AccountInfo<'a>,
    rent: Option<&AccountInfo<'a>>,
    signer_seeds: Option<&[&[u8]]>,
    fee_payer_seeds: Option<&[&[u8]]>,
    amount: u64,
) -> Result<()> {
    if currency_mint.is_none() {
        transfer_sol(from, to, system_program, signer_seeds, amount)?;
    } else {
        transfer_spl(
            from,
            to,
            from_currency_account.unwrap(),
            to_currency_account.unwrap(),
            currency_mint.unwrap(),
            if fee_payer.is_some() {
                fee_payer.unwrap()
            } else {
                from
            },
            ata_program,
            token_program,
            system_program,
            rent.unwrap(),
            None,
            signer_seeds,
            fee_payer_seeds,
            amount,
        )?;
    }

    Ok(())
}

/// Transfers SOL or SPL tokens from a program owned account to another account.
pub fn transfer_from_pda<'a>(
    from: &mut AccountInfo<'a>,
    to: &mut AccountInfo<'a>,
    from_currency_account: Option<&AccountInfo<'a>>,
    to_currency_account: Option<&AccountInfo<'a>>,
    currency_mint: Option<&AccountInfo<'a>>,
    fee_payer: Option<&AccountInfo<'a>>,
    ata_program: &AccountInfo<'a>,
    token_program: &AccountInfo<'a>,
    system_program: &AccountInfo<'a>,
    rent: &AccountInfo<'a>,
    signer_seeds: &[&[u8]],
    fee_payer_seeds: Option<&[&[u8]]>,
    amount: u64,
) -> Result<()> {
    if currency_mint.is_none()
        || currency_mint.unwrap().key() == Pubkey::default()
        || is_native_mint(currency_mint.unwrap().key())
    {
        transfer_sol_from_pda(from, to, amount)?;
    } else {
        transfer_spl(
            from,
            to,
            from_currency_account.unwrap(),
            to_currency_account.unwrap(),
            currency_mint.unwrap(),
            if fee_payer.is_some() {
                fee_payer.unwrap()
            } else {
                from
            },
            ata_program,
            token_program,
            system_program,
            rent,
            None,
            Some(signer_seeds),
            fee_payer_seeds,
            amount,
        )?;
    }

    Ok(())
}

pub fn transfer_sol_from_pda(
    src: &mut AccountInfo,
    dst: &mut AccountInfo,
    amount: u64,
) -> Result<()> {
    **src.try_borrow_mut_lamports()? = src
        .lamports()
        .checked_sub(amount)
        .ok_or(Error::OverflowError)?;
    **dst.try_borrow_mut_lamports()? = dst
        .lamports()
        .checked_add(amount)
        .ok_or(Error::OverflowError)?;
    Ok(())
}

pub fn transfer_sol<'a>(
    from: &AccountInfo<'a>,
    to: &AccountInfo<'a>,
    system_program: &AccountInfo<'a>,
    signer_seeds: Option<&[&[u8]]>,
    amount: u64,
) -> Result<()> {
    if amount == 0 {
        return Ok(());
    }

    let transfer_ix = &system_instruction::transfer(from.key, to.key, amount);

    let transfer_accounts = &[from.clone(), to.clone(), system_program.clone()];

    if signer_seeds.is_some() {
        invoke_signed(transfer_ix, transfer_accounts, &[signer_seeds.unwrap()])?;
    } else {
        invoke(transfer_ix, transfer_accounts)?;
    }

    Ok(())
}

pub fn transfer_spl<'a>(
    from: &AccountInfo<'a>,
    to: &AccountInfo<'a>,
    from_token_account: &AccountInfo<'a>,
    to_token_account: &AccountInfo<'a>,
    mint: &AccountInfo<'a>,
    fee_payer: &AccountInfo<'a>,
    ata_program: &AccountInfo<'a>,
    token_program: &AccountInfo<'a>,
    system_program: &AccountInfo<'a>,
    rent: &AccountInfo<'a>,
    from_authority: Option<&AccountInfo<'a>>,
    signer_seeds: Option<&[&[u8]]>,
    fee_payer_seeds: Option<&[&[u8]]>,
    amount: u64,
) -> Result<()> {
    if amount == 0 {
        return Ok(());
    }

    ensure_ata(
        to_token_account,
        to,
        mint,
        fee_payer,
        ata_program,
        token_program,
        system_program,
        rent,
        fee_payer_seeds,
    )?;

    let transfer_cpi = CpiContext::new(
        token_program.to_account_info(),
        Transfer {
            from: from_token_account.to_account_info(),
            to: to_token_account.to_account_info(),
            authority: if from_authority.is_some() {
                from_authority.unwrap().to_account_info()
            } else {
                from.to_account_info()
            },
        },
    );

    if signer_seeds.is_none() {
        token::transfer(transfer_cpi, amount)?;
    } else {
        token::transfer(transfer_cpi.with_signer(&[signer_seeds.unwrap()]), amount)?;
    }

    Ok(())
}

pub fn ensure_ata<'b>(
    to_token_account: &AccountInfo<'b>,
    to: &AccountInfo<'b>,
    mint: &AccountInfo<'b>,
    fee_payer: &AccountInfo<'b>,
    ata_program: &AccountInfo<'b>,
    token_program: &AccountInfo<'b>,
    system_program: &AccountInfo<'b>,
    rent: &AccountInfo<'b>,
    fee_payer_seeds: Option<&[&[u8]]>,
) -> Result<()> {
    if to_token_account.data_is_empty() {
        make_ata(
            to_token_account.to_account_info(),
            to.to_account_info(),
            mint.to_account_info(),
            fee_payer.to_account_info(),
            ata_program.to_account_info(),
            token_program.to_account_info(),
            system_program.to_account_info(),
            rent.to_account_info(),
            fee_payer_seeds,
        )?;
    } else {
        assert_is_ata(to_token_account, to.key, &mint.key())?;
    }

    Ok(())
}

pub fn make_ata<'a>(
    ata: AccountInfo<'a>,
    wallet: AccountInfo<'a>,
    mint: AccountInfo<'a>,
    fee_payer: AccountInfo<'a>,
    ata_program: AccountInfo<'a>,
    token_program: AccountInfo<'a>,
    system_program: AccountInfo<'a>,
    rent: AccountInfo<'a>,
    fee_payer_seeds: Option<&[&[u8]]>,
) -> Result<()> {
    let ix =
        &create_associated_token_account(fee_payer.key, wallet.key, mint.key, token_program.key);

    let accounts = &[
        ata,
        wallet,
        mint,
        fee_payer,
        ata_program,
        system_program,
        rent,
        token_program,
    ];

    if fee_payer_seeds.is_some() {
        let seeds = &[fee_payer_seeds.unwrap()];
        invoke_signed(ix, accounts, seeds)?;
    } else {
        invoke(ix, accounts)?;
    }

    Ok(())
}
