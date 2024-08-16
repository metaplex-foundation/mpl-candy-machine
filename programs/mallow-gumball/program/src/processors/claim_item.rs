use anchor_lang::prelude::*;

use crate::{GumballError, GumballMachine};

pub fn is_item_claimed(gumball_machine: &Box<Account<GumballMachine>>, index: u32) -> Result<bool> {
    let account_info = gumball_machine.to_account_info();
    let data = account_info.data.borrow();

    // bit-mask
    let bit_mask_start = gumball_machine.get_claimed_items_bit_mask_position();
    let position = index as usize;
    let byte_position = bit_mask_start
        + position
            .checked_div(8)
            .ok_or(GumballError::NumericalOverflowError)?;
    // bit index corresponding to the position of the line
    let bit = 7 - position
        .checked_rem(8)
        .ok_or(GumballError::NumericalOverflowError)?;
    let mask = u8::pow(2, bit as u32);

    let current_value = data[byte_position];
    let is_claimed = current_value & mask == mask;

    msg!(
        "Item checked: byte position={}, mask={}, current value={}, is claimed={}, bit position={}",
        byte_position - bit_mask_start,
        mask,
        current_value,
        is_claimed,
        bit
    );

    drop(data);

    Ok(is_claimed)
}

pub fn claim_item(gumball_machine: &mut Box<Account<GumballMachine>>, index: u32) -> Result<()> {
    let account_info = gumball_machine.to_account_info();
    let mut data = account_info.data.borrow_mut();

    // bit-mask
    let bit_mask_start = gumball_machine.get_claimed_items_bit_mask_position();
    let position = index as usize;
    let byte_position = bit_mask_start
        + position
            .checked_div(8)
            .ok_or(GumballError::NumericalOverflowError)?;
    // bit index corresponding to the position of the line
    let bit = 7 - position
        .checked_rem(8)
        .ok_or(GumballError::NumericalOverflowError)?;
    let mask = u8::pow(2, bit as u32);

    let current_value = data[byte_position];
    data[byte_position] |= mask;

    msg!(
        "Item processed: byte position={}, mask={}, current value={}, new value={}, bit position={}",
        byte_position - bit_mask_start,
        mask,
        current_value,
        data[byte_position],
        bit
    );

    drop(data);

    Ok(())
}
