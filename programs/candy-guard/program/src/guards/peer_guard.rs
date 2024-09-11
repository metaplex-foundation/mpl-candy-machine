use solana_program::sysvar::instructions::{
    load_current_index_checked, load_instruction_at_checked,
};

use solana_program::{program::invoke_signed, system_instruction};

use super::*;

use crate::{state::GuardType, utils::assert_keys_equal};

/// Gaurd to validate transactions using PeerPay
///
/// List of accounts required:
///
///   0. `[writable]` Transaction ID PDA. The PDA is derived
///                   using the seed `[transaction_id]`.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct PeerGuard {
    pub authority: Pubkey,
}

impl Guard for PeerGuard {
    fn size() -> usize {
        32 //  Pubkey
    }

    fn mask() -> u64 {
        GuardType::as_mask(GuardType::PeerGuard)
    }
}

impl Condition for PeerGuard {
    fn validate<'info>(
        &self,
        ctx: &mut EvaluationContext,
        _guard_set: &GuardSet,
        _mint_args: &[u8],
    ) -> Result<()> {
        let instructions_account = &ctx.accounts.sysvar_instructions;
        let current_index = load_current_index_checked(instructions_account)? as usize;
        msg!("The instruction index is: {}", current_index);

        let transaction_pda_index = ctx.account_cursor;
        ctx.account_cursor += 1;
        let transaction_pda = try_get_account_info(ctx.accounts.remaining, transaction_pda_index)?;

        match load_instruction_at_checked(current_index - 1, &instructions_account) {
            Ok(signature_ix) => {
                // Ensure signing authority is correct
                require!(
                    &self.authority.to_bytes().eq(&signature_ix.data[16..48]),
                    CandyGuardError::SignatureAuthorityMismatch
                );

                let mut message_data: [u8; 28] = [0u8; 28];
                message_data.copy_from_slice(&signature_ix.data[112..140]);
                let transaction_id = message_data;

                msg!(
                    "The message from Signature instruction is: {:?}",
                    transaction_id
                );

                let transaction_pda_seeds = [transaction_id.as_ref()];

                let (pda, bump) = Pubkey::find_program_address(&transaction_pda_seeds, &crate::ID);

                if transaction_pda.data_is_empty() {
                    let pda_signer = [transaction_id.as_ref(), &[bump]];

                    let rent = Rent::get()?;

                    invoke_signed(
                        &system_instruction::create_account(
                            ctx.accounts.payer.key,
                            &pda,
                            rent.minimum_balance(std::mem::size_of::<u64>()),
                            8 as u64,
                            &crate::ID,
                        ),
                        &[
                            ctx.accounts.payer.to_account_info(),
                            transaction_pda.to_account_info(),
                        ],
                        &[&pda_signer],
                    )?;
                } else {
                    return err!(CandyGuardError::TransactionAlreadyExists);
                }

                Ok(())
            }
            Err(_) => {
                msg!("Couldn't load the previous instruction");
                return err!(CandyGuardError::NoPreviousInstruction);
            }
        }
    }
}
