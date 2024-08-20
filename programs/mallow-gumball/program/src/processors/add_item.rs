use anchor_lang::prelude::*;

use crate::{
    constants::{CONFIG_LINE_SIZE, GUMBALL_MACHINE_SIZE},
    get_config_count, ConfigLineInput, GumballError, GumballMachine, TokenStandard,
};

pub fn add_item(
    gumball_machine: &mut Account<GumballMachine>,
    config_line: ConfigLineInput,
    token_standard: TokenStandard,
) -> Result<()> {
    let account_info = gumball_machine.to_account_info();
    // mutable reference to the account data (config lines are written in the
    // 'hidden' section of the data array)
    let mut data = account_info.data.borrow_mut();

    // holds the total number of config lines
    let mut count = get_config_count(&data)?;
    let index = count as u32;

    // no risk overflow because you literally cannot store this many in an account
    // going beyond u32 only happens with the hidden settings candies
    let total = index
        .checked_add(1)
        .ok_or(GumballError::NumericalOverflowError)?;

    if total > (gumball_machine.settings.item_capacity as u32) {
        return err!(GumballError::IndexGreaterThanLength);
    }

    let mut position = GUMBALL_MACHINE_SIZE + 4 + (index as usize) * CONFIG_LINE_SIZE;

    let mint_slice: &mut [u8] = &mut data[position..position + 32];
    mint_slice.copy_from_slice(&config_line.mint.to_bytes());
    position += 32;

    let seller_slice: &mut [u8] = &mut data[position..position + 32];
    seller_slice.copy_from_slice(&config_line.seller.to_bytes());
    // Skip buyer (+32)
    position += 64;

    let token_standard_slice: &mut [u8] = &mut data[position..position + 1];
    token_standard_slice.copy_from_slice(&u8::to_be_bytes(token_standard as u8));

    // (unordered) indices for the mint
    let indices_start = gumball_machine.get_mint_indices_position()?;

    // add the new index to the mint indices vec
    let index_position = indices_start + (index as usize) * 4;
    data[index_position..index_position + 4].copy_from_slice(&u32::to_le_bytes(index));

    count = count
        .checked_add(1)
        .ok_or(GumballError::NumericalOverflowError)?;

    msg!(
        "New item added: position={}, new count={})",
        position,
        count,
    );

    // updates the config lines count
    data[GUMBALL_MACHINE_SIZE..GUMBALL_MACHINE_SIZE + 4]
        .copy_from_slice(&(count as u32).to_le_bytes());

    Ok(())
}
