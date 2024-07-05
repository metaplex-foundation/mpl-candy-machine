use anchor_lang::prelude::*;

use crate::{
    constants::{CANDY_MACHINE_SIZE, CONFIG_LINE_SIZE},
    get_config_count,
    state::{CandyMachine, ConfigLine},
    CandyError,
};

pub fn add_config_lines(
    ctx: Context<AddConfigLines>,
    index: u32,
    config_lines: Vec<ConfigLine>,
) -> Result<()> {
    let candy_machine = &mut ctx.accounts.candy_machine;
    let account_info = candy_machine.to_account_info();
    // mutable reference to the account data (config lines are written in the
    // 'hidden' section of the data array)
    let mut data = account_info.data.borrow_mut();

    // no risk overflow because you literally cannot store this many in an account
    // going beyond u32 only happens with the hidden settings candies
    let total = index
        .checked_add(config_lines.len() as u32)
        .ok_or(CandyError::NumericalOverflowError)?;

    if total > (candy_machine.items_available as u32) {
        return err!(CandyError::IndexGreaterThanLength);
    } else if config_lines.is_empty() {
        // there is nothing to do, so we can stop early
        msg!("Config lines array empty");
        return Ok(());
    }

    let mut position = CANDY_MACHINE_SIZE + 4 + (index as usize) * CONFIG_LINE_SIZE;

    for line in &config_lines {
        let mint_slice: &mut [u8] = &mut data[position..position + 32];
        mint_slice.copy_from_slice(&line.mint.to_bytes());
        position += 32;

        let contributor_slice: &mut [u8] = &mut data[position..position + 32];
        contributor_slice.copy_from_slice(&line.contributor.to_bytes());
        // Skip buyer (+32)
        position += 64;

        let token_standard_slice: &mut [u8] = &mut data[position..position + 1];
        token_standard_slice.copy_from_slice(&u8::to_be_bytes(line.token_standard as u8));
        position += 1;
    }

    // after adding the config lines, we need to update the mint indices - there are two arrays
    // controlling this process: (1) a bit-mask array to keep track which config lines are already
    // present on the data; (2) an array with mint indices, where indices are added when the config
    // line is added for the first time (when updating a config line, the index is not added again)

    // bit-mask
    let bit_mask_start =
        CANDY_MACHINE_SIZE + 4 + (candy_machine.items_available as usize) * CONFIG_LINE_SIZE;
    // (unordered) indices for the mint
    let indices_start = bit_mask_start
        + (candy_machine
            .items_available
            .checked_div(8)
            .ok_or(CandyError::NumericalOverflowError)?
            + 1) as usize;

    // holds the total number of config lines
    let mut count = get_config_count(&data)?;

    for i in 0..config_lines.len() {
        let position = (index as usize)
            .checked_add(i)
            .ok_or(CandyError::NumericalOverflowError)?;
        let byte_position = bit_mask_start
            + position
                .checked_div(8)
                .ok_or(CandyError::NumericalOverflowError)?;
        // bit index corresponding to the position of the line
        let bit = 7 - position
            .checked_rem(8)
            .ok_or(CandyError::NumericalOverflowError)?;
        let mask = u8::pow(2, bit as u32);

        let current_value = data[byte_position];
        data[byte_position] |= mask;

        msg!(
            "Config line processed: byte position={}, mask={}, current value={}, new value={}, bit position={}",
            byte_position - bit_mask_start,
            mask,
            current_value,
            data[byte_position],
            bit
        );

        if current_value != data[byte_position] {
            // add the new index to the mint indices vec
            let index_position = indices_start + position * 4;
            data[index_position..index_position + 4]
                .copy_from_slice(&u32::to_le_bytes(position as u32));

            count = count
                .checked_add(1)
                .ok_or(CandyError::NumericalOverflowError)?;

            msg!(
                "New config line added: position={}, total count={})",
                position,
                count,
            );
        }
    }

    // updates the config lines count
    data[CANDY_MACHINE_SIZE..CANDY_MACHINE_SIZE + 4].copy_from_slice(&(count as u32).to_le_bytes());

    Ok(())
}

/// Add multiple config lines to a candy machine.
#[derive(Accounts)]
pub struct AddConfigLines<'info> {
    /// Candy Machine account.
    #[account(mut, has_one = authority)]
    candy_machine: Account<'info, CandyMachine>,

    /// Autority of the candy machine.
    authority: Signer<'info>,
}
