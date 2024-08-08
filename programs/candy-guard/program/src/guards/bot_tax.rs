use solana_program::{
    program::invoke, system_instruction, sysvar::instructions::get_instruction_relative,
};

use super::{
    program_gate::{verify_programs, DEFAULT_PROGRAMS},
    *,
};
use crate::{errors::GumballGuardError, state::GuardType};

/// Guard is used to:
/// * charge a penalty for invalid transactions
/// * validate that the mint transaction is the last transaction
/// * verify that only authorized programs have instructions
///
/// The `bot_tax` is applied to any error that occurs during the
/// validation of the guards.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct BotTax {
    pub lamports: u64,
    pub last_instruction: bool,
}

impl Guard for BotTax {
    fn size() -> usize {
        8 + 1 // u64 + bool
    }

    fn mask() -> u64 {
        GuardType::as_mask(GuardType::BotTax)
    }
}

impl Condition for BotTax {
    fn validate<'info>(
        &self,
        ctx: &mut EvaluationContext,
        _guard_set: &GuardSet,
        _mint_args: &[u8],
    ) -> Result<()> {
        if self.last_instruction {
            let ix_sysvar_account_info = &ctx.accounts.sysvar_instructions;

            // the next instruction after the mint
            if get_instruction_relative(1, ix_sysvar_account_info).is_ok() {
                msg!("Failing and halting due to an extra unauthorized instruction");
                return err!(GumballGuardError::MintNotLastTransaction);
            }

            // verifies that only authorized programs have instructions in the transaction
            verify_programs(ix_sysvar_account_info, DEFAULT_PROGRAMS)?;
        }

        Ok(())
    }
}

impl BotTax {
    pub fn punish_bots(&self, ctx: &EvaluationContext, error: Error) -> Result<()> {
        let bot_account = ctx.accounts.payer.to_account_info();
        let payment_account = ctx.accounts.gumball_machine.to_account_info();
        let system_program = ctx.accounts.system_program.to_account_info();

        msg!(
            "{}, Gumball Guard Botting is taxed at {:?} lamports",
            error.to_string(),
            self.lamports
        );

        let final_fee = self.lamports.min(bot_account.lamports());
        invoke(
            &system_instruction::transfer(bot_account.key, payment_account.key, final_fee),
            &[bot_account, payment_account, system_program],
        )?;

        Ok(())
    }
}
