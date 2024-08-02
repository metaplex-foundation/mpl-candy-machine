use crate::{state::CandyMachine, CandyError, SellerHistory};
use anchor_lang::prelude::*;
use utils::{
    assert_keys_equal, get_bps_of, is_native_mint, transfer, transfer_from_pda, RoyaltyInfo,
};

pub fn claim_proceeds<'a, 'b>(
    candy_machine: &mut Box<Account<'a, CandyMachine>>,
    seller_history: &mut Box<Account<'a, SellerHistory>>,
    fee_payer: &AccountInfo<'a>,
    authority_pda: &mut AccountInfo<'a>,
    authority_pda_payment_account: Option<&AccountInfo<'a>>,
    authority: &mut AccountInfo<'a>,
    authority_payment_account: Option<&AccountInfo<'a>>,
    seller: &mut AccountInfo<'a>,
    seller_payment_account: Option<&AccountInfo<'a>>,
    fee_account: Option<&mut AccountInfo<'a>>,
    fee_payment_account: Option<&AccountInfo<'a>>,
    payment_mint: Option<&AccountInfo<'a>>,
    royalty_info: &RoyaltyInfo,
    remaining_accounts: &'b [AccountInfo<'a>],
    associated_token_program: &AccountInfo<'a>,
    token_program: &AccountInfo<'a>,
    system_program: &AccountInfo<'a>,
    rent: &AccountInfo<'a>,
    auth_seeds: &[&[u8]],
) -> Result<u64> {
    candy_machine.items_settled += 1;

    let is_native = is_native_mint(candy_machine.settings.payment_mint);

    if !is_native {
        require!(
            payment_mint.is_some()
                && payment_mint.unwrap().key() == candy_machine.settings.payment_mint,
            CandyError::InvalidPaymentMint
        );
    }

    // Proceeds are calculated as total amount paid by buyers divided by total number of items in the gumball machine
    let total_proceeds = candy_machine
        .total_revenue
        .checked_div(candy_machine.finalized_items_count)
        .ok_or(CandyError::NumericalOverflowError)?;
    msg!("Proceeds: {}", total_proceeds);

    let marketplace_fee_bps = if let Some(fee_confg) = candy_machine.marketplace_fee_config {
        fee_confg.fee_bps
    } else {
        0
    };

    let marketplace_fee = get_bps_of(total_proceeds, marketplace_fee_bps)?;
    msg!("Marketplace fee: {}", marketplace_fee);

    if marketplace_fee > 0 {
        transfer_from_pda(
            authority_pda,
            fee_account.unwrap(),
            authority_pda_payment_account,
            fee_payment_account,
            payment_mint,
            Some(fee_payer),
            associated_token_program,
            token_program,
            system_program,
            rent,
            &auth_seeds,
            None,
            marketplace_fee,
        )?;
    }

    let curator_fee = get_bps_of(total_proceeds, candy_machine.settings.curator_fee_bps)?;
    msg!("Curator fee: {}", curator_fee);

    if curator_fee > 0 {
        transfer_from_pda(
            authority_pda,
            authority,
            authority_pda_payment_account,
            authority_payment_account,
            payment_mint,
            Some(fee_payer),
            associated_token_program,
            token_program,
            system_program,
            rent,
            &auth_seeds,
            None,
            curator_fee,
        )?;
    }

    let price_less_fees = total_proceeds
        .checked_sub(marketplace_fee)
        .ok_or(CandyError::NumericalOverflowError)?
        .checked_sub(curator_fee)
        .ok_or(CandyError::NumericalOverflowError)?;
    msg!("Price less fees: {}", price_less_fees);

    let total_royalty = if royalty_info.is_primary_sale {
        price_less_fees
    } else {
        get_bps_of(price_less_fees, royalty_info.seller_fee_basis_points)?
    };

    msg!("Total royalty: {}", total_royalty);

    let royalties_paid = pay_creator_royalties(
        authority_pda,
        payment_mint,
        authority_pda_payment_account,
        Some(fee_payer),
        royalty_info,
        remaining_accounts,
        associated_token_program,
        token_program,
        system_program,
        rent,
        Some(&auth_seeds),
        total_royalty,
    )?;

    let seller_proceeds = price_less_fees
        .checked_sub(royalties_paid)
        .ok_or(CandyError::NumericalOverflowError)?;

    msg!("Seller proceeds: {}", seller_proceeds);

    if seller_proceeds > 0 {
        transfer_from_pda(
            authority_pda,
            seller,
            authority_pda_payment_account,
            seller_payment_account,
            payment_mint,
            Some(fee_payer),
            associated_token_program,
            token_program,
            system_program,
            rent,
            &auth_seeds,
            None,
            seller_proceeds,
        )?;
    }

    seller_history.item_count -= 1;
    if seller_history.item_count == 0 {
        seller_history.close(seller.to_account_info())?;
    }

    Ok(total_proceeds)
}

/// Pays creator fees to the creators in the metadata and returns total paid
pub fn pay_creator_royalties<'a, 'b>(
    payer: &mut AccountInfo<'a>,
    payment_mint: Option<&AccountInfo<'a>>,
    payer_token_account: Option<&AccountInfo<'a>>,
    fee_payer: Option<&AccountInfo<'a>>,
    verified_royalty_info: &RoyaltyInfo,
    remaining_accounts: &'b [AccountInfo<'a>],
    ata_program: &AccountInfo<'a>,
    token_program: &AccountInfo<'a>,
    system_program: &AccountInfo<'a>,
    rent: &AccountInfo<'a>,
    auth_seeds: Option<&[&[u8]]>,
    total_royalty: u64,
) -> Result<u64> {
    if total_royalty == 0 {
        return Ok(0);
    }

    if verified_royalty_info.creators.is_none() {
        return Ok(0);
    }

    let creators = verified_royalty_info.creators.as_ref().unwrap().iter();
    if creators.len() == 0 {
        return Ok(0);
    }

    let mut total_paid = 0;
    let is_native = payment_mint.is_none() || is_native_mint(payment_mint.unwrap().key());

    let remaining_accounts_clone = &mut remaining_accounts.iter().clone();

    for creator in creators {
        let creator_fee = (creator.share as u128)
            .checked_mul(total_royalty as u128)
            .ok_or(CandyError::NumericalOverflowError)?
            .checked_div(100)
            .ok_or(CandyError::NumericalOverflowError)? as u64;

        let current_creator_info = next_account_info(remaining_accounts_clone)?;
        assert_keys_equal(
            creator.address,
            current_creator_info.key(),
            "Invalid creator key",
        )?;

        let creator_token_account = if is_native {
            None
        } else {
            Some(next_account_info(remaining_accounts_clone)?)
        };

        if creator_fee == 0 {
            continue;
        }

        if auth_seeds.is_some() {
            transfer_from_pda(
                payer,
                &mut current_creator_info.to_account_info(),
                payer_token_account,
                creator_token_account,
                payment_mint,
                fee_payer,
                ata_program,
                token_program,
                system_program,
                rent,
                auth_seeds.unwrap(),
                None,
                creator_fee,
            )?;
        } else {
            transfer(
                payer,
                current_creator_info,
                payer_token_account,
                creator_token_account,
                payment_mint,
                fee_payer,
                ata_program,
                token_program,
                system_program,
                Some(rent),
                None,
                None,
                creator_fee,
            )?;
        }

        total_paid += creator_fee;
    }

    Ok(total_paid)
}
