use anchor_lang::prelude::*;

use crate::{get_bit_byte_info, GumballError, GumballMachine};

pub fn is_item_claimed(gumball_machine: &Box<Account<GumballMachine>>, index: u32) -> Result<bool> {
    let account_info = gumball_machine.to_account_info();
    let data = account_info.data.borrow();

    // bit-mask
    let bit_mask_start = gumball_machine.get_claimed_items_bit_mask_position();
    let (byte_position, bit, mask) = get_bit_byte_info(bit_mask_start, index as usize)?;
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
    let (byte_position, bit, mask) = get_bit_byte_info(bit_mask_start, index as usize)?;
    let current_value = data[byte_position];
    let is_claimed = current_value & mask == mask;
    require!(!is_claimed, GumballError::ItemAlreadyClaimed);

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
