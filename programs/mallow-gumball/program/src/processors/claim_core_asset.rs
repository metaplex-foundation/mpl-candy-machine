use anchor_lang::prelude::*;
use mpl_core::{
    instructions::{RemovePluginV1CpiBuilder, TransferV1CpiBuilder, UpdatePluginV1CpiBuilder},
    types::{FreezeDelegate, Plugin, PluginType},
};
use utils::transfer_sol;

use crate::GumballMachine;

use super::claim_item;

pub fn claim_core_asset<'a, 'b>(
    gumball_machine: &mut Box<Account<'a, GumballMachine>>,
    index: u32,
    authority_pda: &AccountInfo<'a>,
    payer: &AccountInfo<'a>,
    to: &AccountInfo<'a>,
    from: &AccountInfo<'a>,
    asset: &AccountInfo<'a>,
    collection: Option<&AccountInfo<'a>>,
    mpl_core_program: &AccountInfo<'a>,
    system_program: &AccountInfo<'a>,
    auth_seeds: &[&[u8]],
) -> Result<()> {
    claim_item(gumball_machine, index)?;

    UpdatePluginV1CpiBuilder::new(mpl_core_program)
        .asset(asset)
        .collection(collection)
        .payer(payer)
        .plugin(Plugin::FreezeDelegate(FreezeDelegate { frozen: false }))
        .authority(Some(authority_pda))
        .system_program(system_program)
        .invoke_signed(&[&auth_seeds])?;

    TransferV1CpiBuilder::new(mpl_core_program)
        .asset(asset)
        .collection(collection)
        .payer(payer)
        .authority(Some(authority_pda))
        .new_owner(to)
        .system_program(Some(system_program))
        .invoke_signed(&[&auth_seeds])?;

    if payer.key == to.key {
        // Clean up plugins and send rent back to seller
        let pre_lamports = payer.lamports();

        RemovePluginV1CpiBuilder::new(mpl_core_program)
            .asset(asset)
            .collection(collection)
            .payer(payer)
            .plugin_type(PluginType::FreezeDelegate)
            .system_program(system_program)
            .invoke()?;

        RemovePluginV1CpiBuilder::new(mpl_core_program)
            .asset(asset)
            .collection(collection)
            .payer(payer)
            .plugin_type(PluginType::TransferDelegate)
            .system_program(system_program)
            .invoke()?;

        let post_lamports = payer.lamports();
        let rent_amount = post_lamports.checked_sub(pre_lamports).unwrap_or(0);

        if rent_amount > 0 {
            transfer_sol(to, from, system_program, None, rent_amount)?;
        }
    }

    Ok(())
}
