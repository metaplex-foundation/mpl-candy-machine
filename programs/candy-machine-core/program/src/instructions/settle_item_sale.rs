use anchor_lang::prelude::*;
use mpl_token_metadata::instructions::{UpdatePrimarySaleHappenedViaTokenCpi, UpdatePrimarySaleHappenedViaTokenCpiAccounts};
use utils::{assert_keys_equal, get_bps_of, get_verified_royalty_info, is_native_mint, transfer, transfer_from_pda, transfer_spl, RoyaltyInfo};

use crate::{
    constants::{AUTHORITY_SEED, SELLER_HISTORY_SEED}, state::CandyMachine, AssociatedToken, CandyError, GumballState, SellerHistory, Token
};


#[derive(Accounts)]
pub struct SettleAccounts<'info> {
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
            candy_machine.to_account_info().key.as_ref()
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
}

/// Settles a legacy NFT sale
#[derive(Accounts)]
pub struct SettleNftSale<'info> {
    settle_accounts: SettleAccounts<'info>,

    /// CHECK: Safe due to item check
    mint: UncheckedAccount<'info>,

    /// CHECK: Safe due to thaw/transfer
    #[account(mut)]
    token_account: UncheckedAccount<'info>,

    /// Nft token account for buyer
    /// CHECK: Safe due to ata check in transfer
    #[account(mut)]
    buyer_token_account: UncheckedAccount<'info>,

    /// CHECK: Safe due to processor royalties check
    metadata: UncheckedAccount<'info>,

    /// CHECK: Safe due to constraint
    #[account(address = mpl_token_metadata::ID)]
    token_metadata_program: UncheckedAccount<'info>,
}

pub fn settle_nft_sale<'info>(ctx: Context<'_, '_, '_, 'info, SettleNftSale<'info>>, index: u32) -> Result<()> {
    let candy_machine = &ctx.accounts.settle_accounts.candy_machine;
    let payer = &ctx.accounts.settle_accounts.payer.to_account_info();
    let buyer = &ctx.accounts.settle_accounts.buyer.to_account_info();
    let buyer_token_account = &ctx.accounts.buyer_token_account.to_account_info();
    let authority_pda = &mut ctx.accounts.settle_accounts.authority_pda.to_account_info();
    let authority = &mut ctx.accounts.settle_accounts.authority.to_account_info();
    let seller = &mut ctx.accounts.settle_accounts.seller.to_account_info();
    let token_metadata_program = &ctx.accounts.token_metadata_program.to_account_info();
    let token_account = &ctx.accounts.token_account.to_account_info();
    let token_program = &ctx.accounts.settle_accounts.token_program.to_account_info();
    let associated_token_program = &ctx.accounts.settle_accounts.associated_token_program.to_account_info();
    let system_program = &ctx.accounts.settle_accounts.system_program.to_account_info();
    let rent = &ctx.accounts.settle_accounts.rent.to_account_info();

    let metadata = &ctx.accounts.metadata.to_account_info();
    let mint = &ctx.accounts.mint.to_account_info();

    let royalty_info = get_verified_royalty_info(metadata, mint)?;

    // TODO: Verify item info w/ accounts

    let auth_seeds = [
        AUTHORITY_SEED.as_bytes(),
        candy_machine.to_account_info().key.as_ref(),
        &[ctx.bumps.settle_accounts.authority_pda],
    ];

    if royalty_info.is_primary_sale {
        UpdatePrimarySaleHappenedViaTokenCpi::new(
            token_metadata_program,
            UpdatePrimarySaleHappenedViaTokenCpiAccounts {
                metadata: &ctx.accounts.metadata.to_account_info(),
                owner: authority_pda,
                token: token_account
            },
        )
        .invoke_signed(&[&auth_seeds])?;
    }

    // Transfer
    transfer_spl(
        authority_pda,
        buyer,
        token_account,
        buyer_token_account,
        mint,
        payer,
        associated_token_program,
        token_program,
        system_program,
        rent,
        Some(authority_pda),
        Some(&auth_seeds),
        None,
        1,
    )?;

    let payment_mint_info = if let Some(mint) = &ctx.accounts.settle_accounts.payment_mint {
        Some(mint.to_account_info())
    } else {
        None
    };

    let payment_mint = if let Some(payment_mint) = &payment_mint_info {
        Some(payment_mint)
    } else {
        None
    };

    let authority_pda_payment_account_info = if let Some(account) = &ctx.accounts.settle_accounts.authority_pda_payment_account {
        Some(account.to_account_info())
    } else {
        None
    };

    let authority_pda_payment_account = if let Some(account) = &authority_pda_payment_account_info {
        Some(account)
    } else {
        None
    };

    let authority_payment_account_info = if let Some(account) = &ctx.accounts.settle_accounts.authority_payment_account {
        Some(account.to_account_info())
    } else {
        None
    };

    let authority_payment_account = if let Some(account) = &authority_payment_account_info {
        Some(account)
    } else {
        None
    };

    let seller_payment_account_info = if let Some(account) = &ctx.accounts.settle_accounts.seller_payment_account {
        Some(account.to_account_info())
    } else {
        None
    };

    let seller_payment_account = if let Some(account) = &seller_payment_account_info {
        Some(account)
    } else {
        None
    };

    let fee_account = if let Some(_) = candy_machine.marketplace_fee_config {
        ctx.accounts.settle_accounts.fee_account.as_ref().unwrap()
    } else {
        ctx.accounts.settle_accounts.authority.as_ref()
    };

    let fee_payment_account_info = if let Some(account) = &ctx.accounts.settle_accounts.fee_payment_account {
        Some(account.to_account_info())
    } else {
        None
    };

    let fee_payment_account = if let Some(account) = &fee_payment_account_info {
        Some(account)
    } else {
        None
    };

    process_payment(
        payer,
        candy_machine, 
        authority_pda,
        authority_pda_payment_account,
        authority,
        authority_payment_account,
        seller,
        seller_payment_account,
        &mut fee_account.to_account_info(),
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
    
    ctx.accounts.settle_accounts.seller_history.item_count -= 1;

    Ok(())
}

#[derive(Accounts)]
pub struct SettleCoreAssetSale<'info> {
    settle_accounts: SettleAccounts<'info>,

    /// CHECK: Safe due to item check
    asset: UncheckedAccount<'info>,

    /// CHECK: Safe due to item check
    collection: Option<UncheckedAccount<'info>>,

    /// CHECK: Safe due to constraint
    #[account(address = mpl_core::ID)]
    mpl_core_program: UncheckedAccount<'info>,
}

pub fn settle_core_asset_sale(ctx: Context<SettleCoreAssetSale>, index: u32) -> Result<()> {
    Ok(())
}

pub fn process_payment<'a, 'b>(
    fee_payer: &AccountInfo<'a>,
    candy_machine: &Box<Account<'a, CandyMachine>>,
    authority_pda: &mut AccountInfo<'a>,
    authority_pda_payment_account: Option<&AccountInfo<'a>>,
    authority: &mut AccountInfo<'a>,
    authority_payment_account: Option<&AccountInfo<'a>>,
    seller: &mut AccountInfo<'a>,
    seller_payment_account: Option<&AccountInfo<'a>>,
    fee_account: &mut AccountInfo<'a>,
    fee_payment_account: Option<&AccountInfo<'a>>,
    payment_mint: Option<&AccountInfo<'a>>,
    royalty_info: &RoyaltyInfo,
    remaining_accounts: &'b [AccountInfo<'a>],
    associated_token_program: &AccountInfo<'a>,
    token_program: &AccountInfo<'a>,
    system_program: &AccountInfo<'a>,
    rent: &AccountInfo<'a>,
    auth_seeds: &[&[u8]],
) -> Result<()> {
    let is_native = is_native_mint(candy_machine.settings.payment_mint);

    if !is_native {
        assert_keys_equal(payment_mint.unwrap().key(), candy_machine.settings.payment_mint, "Invalid payment mint")?;
    }

    let marketplace_fee_bps = if let Some(fee_confg) = candy_machine.marketplace_fee_config {
        fee_confg.fee_bps
    } else {
        0
    };
    
    let marketplace_fee = get_bps_of(candy_machine.settings.item_price, marketplace_fee_bps)?;
    if marketplace_fee > 0 {
        transfer_from_pda(
            authority_pda,
            fee_account,
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

    let curator_fee = get_bps_of(candy_machine.settings.item_price, candy_machine.settings.curator_fee_bps)?;
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

    let price_less_fees = candy_machine.settings.item_price
        .checked_sub(marketplace_fee)
        .ok_or(CandyError::NumericalOverflowError)?
        .checked_sub(curator_fee)
        .ok_or(CandyError::NumericalOverflowError)?;

    let total_royalty = if royalty_info.is_primary_sale {
        price_less_fees
    } else {
        get_bps_of(
            price_less_fees,
            royalty_info.seller_fee_basis_points,
        )?
    };

    let royalties_paid = pay_creator_fees(
        authority_pda,
        candy_machine.settings.payment_mint,
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
            curator_fee,
        )?;
    }

    Ok(())
}

/// Pays creator fees to the creators in the metadata and returns total paid
pub fn pay_creator_fees<'a, 'b>(
    payer: &mut AccountInfo<'a>,
    currency_mint: Pubkey,
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
    let is_native = is_native_mint(currency_mint);

    let remaining_accounts_clone = &mut remaining_accounts.iter().clone();

    let (currency_mint_account, payer_currency_account, _, _) = if is_native {
        (None, None, None, None)
    } else {
        (
            Some(next_account_info(remaining_accounts_clone)?),
            Some(next_account_info(remaining_accounts_clone)?),
            Some(next_account_info(remaining_accounts_clone)?),
            Some(next_account_info(remaining_accounts_clone)?),
        )
    };

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
                payer_currency_account,
                creator_token_account,
                currency_mint_account,
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
                payer_currency_account,
                creator_token_account,
                currency_mint_account,
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