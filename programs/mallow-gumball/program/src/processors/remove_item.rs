use crate::{
    constants::{CONFIG_LINE_SIZE, GUMBALL_MACHINE_SIZE},
    get_config_count, GumballError, GumballMachine,
};
use anchor_lang::prelude::*;

pub fn remove_item(
    gumball_machine: &mut Account<GumballMachine>,
    authority: Pubkey,
    mint: Pubkey,
    expected_seller: Pubkey,
    index: u32,
) -> Result<()> {
    let account_info = gumball_machine.to_account_info();
    // mutable reference to the account data (config lines are written in the
    // 'hidden' section of the data array)
    let mut data = account_info.data.borrow_mut();

    // holds the total number of config lines
    let mut count = get_config_count(&data)?;

    if index >= count as u32 {
        return err!(GumballError::IndexGreaterThanLength);
    }

    let last_index = count - 1;
    let config_line_position = GUMBALL_MACHINE_SIZE + 4 + (index as usize) * CONFIG_LINE_SIZE;
    let last_config_line_position = GUMBALL_MACHINE_SIZE + 4 + (last_index) * CONFIG_LINE_SIZE;

    let seller =
        Pubkey::try_from(&data[config_line_position + 32..config_line_position + 64]).unwrap();
    // Only the gumball machine authority or the seller can remove a config line
    require!(
        authority == gumball_machine.authority || seller == authority,
        GumballError::InvalidAuthority
    );
    require!(expected_seller == seller, GumballError::InvalidSeller);

    let item_mint =
        Pubkey::try_from(&data[config_line_position..config_line_position + 32]).unwrap();
    require!(mint == item_mint, GumballError::InvalidMint);

    // if it's the last line we'll just zero out the config slice
    if index == count as u32 - 1 {
        data[config_line_position..config_line_position + CONFIG_LINE_SIZE]
            .iter_mut()
            .for_each(|x| *x = 0);
    } else {
        // if it's not the last line we'll move the last line to the current position
        let last_config_slice: [u8; CONFIG_LINE_SIZE] = data
            [last_config_line_position..last_config_line_position + CONFIG_LINE_SIZE]
            .try_into()
            .unwrap();
        data[config_line_position..config_line_position + CONFIG_LINE_SIZE]
            .copy_from_slice(&last_config_slice);
        // zero out the last line
        data[last_config_line_position..last_config_line_position + CONFIG_LINE_SIZE]
            .iter_mut()
            .for_each(|x| *x = 0);
    }

    // (unordered) indices for the mint
    let indices_start = gumball_machine.get_mint_indices_position()?;

    // remove the last index from the mint indices vec
    let index_position = indices_start + last_index * 4;
    data[index_position..index_position + 4].copy_from_slice(&u32::MIN.to_le_bytes());

    count = count
        .checked_sub(1)
        .ok_or(GumballError::NumericalOverflowError)?;

    msg!("Item removed: position={}, new count={})", index, count,);

    // updates the config lines count
    data[GUMBALL_MACHINE_SIZE..GUMBALL_MACHINE_SIZE + 4]
        .copy_from_slice(&(count as u32).to_le_bytes());

    Ok(())
}
