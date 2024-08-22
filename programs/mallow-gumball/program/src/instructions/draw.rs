use anchor_lang::prelude::*;
use arrayref::array_ref;
use solana_program::sysvar;
use crate::{
    constants::{
        GUMBALL_MACHINE_SIZE, CONFIG_LINE_SIZE
    }, events::DrawItemEvent, utils::*, GumballError, GumballMachine, GumballState
};

/// Draws an item from the gumball machine.
#[event_cpi]
#[derive(Accounts)]
pub struct Draw<'info> {
    /// Gumball machine account.
    #[account(
        mut, 
        has_one = mint_authority,
        constraint = gumball_machine.state == GumballState::SaleLive @ GumballError::InvalidState
    )]
    gumball_machine: Box<Account<'info, GumballMachine>>,

    /// Gumball machine mint authority (mint only allowed for the mint_authority).
    mint_authority: Signer<'info>,

    /// Payer for the transaction and account allocation (rent).
    #[account(mut)]
    payer: Signer<'info>,

    /// NFT account owner.
    ///
    /// CHECK: account not written or read from
    buyer: UncheckedAccount<'info>,

    /// System program.
    system_program: Program<'info, System>,

    /// SlotHashes sysvar cluster data.
    ///
    /// CHECK: account constraints checked in account trait
    #[account(address = sysvar::slot_hashes::id())]
    recent_slothashes: UncheckedAccount<'info>,
}

/// Accounts to mint an NFT.
pub(crate) struct DrawAccounts<'info> {
    pub buyer: AccountInfo<'info>,
    pub recent_slothashes: AccountInfo<'info>,
}

pub fn draw<'info>(ctx: Context<'_, '_, '_, 'info, Draw<'info>>) -> Result<()> {
    let accounts = DrawAccounts {
        buyer: ctx.accounts.buyer.to_account_info(),
        recent_slothashes: ctx.accounts.recent_slothashes.to_account_info(),
    };

    let index = process_draw(
        &mut ctx.accounts.gumball_machine,
        accounts
    )?;

    msg!("Drew item at index: {}", index);

    emit_cpi!(DrawItemEvent {
        authority: ctx.accounts.gumball_machine.authority.key(),
        buyer: ctx.accounts.buyer.key(),
        index,
    });

    Ok(())
}

/// Mint a new NFT.
///
/// The index minted depends on the configuration of the gumball machine: it could be
/// a psuedo-randomly selected one or sequential. In both cases, after minted a
/// specific index, the gumball machine does not allow to mint the same index again.
pub(crate) fn process_draw(
    gumball_machine: &mut Box<Account<'_, GumballMachine>>,
    accounts: DrawAccounts,
) -> Result<u32> {
    let account_info = gumball_machine.to_account_info();
    let account_data = account_info.data.borrow();
    let config_count = get_config_count(&account_data)? as u64;
    drop(account_data);

    // are there items to be minted?
    if gumball_machine.items_redeemed >= config_count {
        return err!(GumballError::GumballMachineEmpty);
    }

    // (2) selecting an item to mint
    let recent_slothashes = &accounts.recent_slothashes;
    let data = recent_slothashes.data.borrow();
    let most_recent = array_ref![data, 12, 8];

    let clock = Clock::get()?;
    // seed for the random number is a combination of the slot_hash - timestamp
    let seed = u64::from_le_bytes(*most_recent).saturating_sub(clock.unix_timestamp as u64);

    let index: usize = seed
        .checked_rem(config_count - gumball_machine.items_redeemed)
        .ok_or(GumballError::NumericalOverflowError)? as usize;

    let mint_index = set_config_line_buyer(
        gumball_machine,
        accounts.buyer.key(),
        index,
        gumball_machine.items_redeemed
    )?;

    gumball_machine.items_redeemed = gumball_machine
        .items_redeemed
        .checked_add(1)
        .ok_or(GumballError::NumericalOverflowError)?;

    // Sale has ended if this is the last item to be redeemed
    if gumball_machine.items_redeemed == config_count {
        gumball_machine.state = GumballState::SaleEnded;
    }

    // release the data borrow
    drop(data);

    Ok(mint_index)
}

/// Selects and returns the information of a config line.
///
/// The selection could be either sequential or random.
pub fn set_config_line_buyer(
    gumball_machine: &Account<'_, GumballMachine>,
    buyer: Pubkey,
    index: usize,
    mint_number: u64,
) -> Result<u32> {
    let account_info = gumball_machine.to_account_info();
    let mut account_data = account_info.data.borrow_mut();
    let config_count = get_config_count(&account_data)? as u64;

    // (1) determine the mint index (index is a random index on the available indices array)
    let indices_start = gumball_machine.get_mint_indices_position()?;
    // calculates the mint index and retrieves the value at that position
    let mint_byte_position = indices_start + index * 4;
    let mint_index = u32::from_le_bytes(*array_ref![account_data, mint_byte_position, 4]) as usize;
    // calculates the last available index and retrieves the value at that position
    let last_index = indices_start + ((config_count - mint_number - 1) * 4) as usize;
    let last_value = u32::from_le_bytes(*array_ref![account_data, last_index, 4]);
    // swap-remove: this guarantees that we remove the used mint index from the available array
    // in a constant time O(1) no matter how big the indices array is
    account_data[mint_byte_position..mint_byte_position + 4].copy_from_slice(&u32::to_le_bytes(last_value));

    // (2) retrieve the config line at the mint_index position
    let buyer_position = GUMBALL_MACHINE_SIZE + 4 + mint_index * CONFIG_LINE_SIZE 
        + 32 // mint
        + 32; // seller

    // Set the buyer on the config line
    let current_buyer = Pubkey::try_from(&account_data[buyer_position..buyer_position + 32]).unwrap();
    require!(current_buyer == Pubkey::default(), GumballError::ItemAlreadyDrawn);
    account_data[buyer_position..buyer_position + 32].copy_from_slice(&buyer.to_bytes());

    Ok(mint_index as u32)
}
