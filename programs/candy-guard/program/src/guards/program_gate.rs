use solana_program::{
    pubkey,
    serialize_utils::{read_pubkey, read_u16},
    system_program,
};

use super::*;
use crate::{errors::GumballGuardError, state::GuardType, utils::cmp_pubkeys};

// Default list of authorized programs.
pub static DEFAULT_PROGRAMS: &[Pubkey] = &[
    crate::ID,
    mallow_gumball::ID,
    system_program::ID,
    spl_token::ID,
    spl_associated_token_account::ID,
    pubkey!("ComputeBudget111111111111111111111111111111"),
    pubkey!("SysExL2WDyJi9aRZrXorrjHJut3JwHQ7R9bTyctbNNG"),
];

// Maximum number of programs in the additional list.
const MAXIMUM_SIZE: usize = 5;

/// Guard that restricts the programs that can be in a mint transaction. The guard allows the
/// necessary programs for the mint and any other program specified in the configuration.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct ProgramGate {
    pub additional: Vec<Pubkey>,
}

impl Guard for ProgramGate {
    fn size() -> usize {
        4 + (MAXIMUM_SIZE * 32) // programs
    }

    fn mask() -> u64 {
        GuardType::as_mask(GuardType::ProgramGate)
    }

    fn verify(data: &GumballGuardData) -> Result<()> {
        if let Some(program_gate) = &data.default.program_gate {
            if program_gate.additional.len() > MAXIMUM_SIZE {
                return err!(GumballGuardError::ExceededProgramListSize);
            }
        }

        if let Some(groups) = &data.groups {
            for group in groups {
                if let Some(program_gate) = &group.guards.program_gate {
                    if program_gate.additional.len() > MAXIMUM_SIZE {
                        return err!(GumballGuardError::ExceededProgramListSize);
                    }
                }
            }
        }

        Ok(())
    }
}

impl Condition for ProgramGate {
    fn validate<'info>(
        &self,
        ctx: &mut EvaluationContext,
        _guard_set: &GuardSet,
        _mint_args: &[u8],
    ) -> Result<()> {
        let ix_sysvar_account = &ctx.accounts.sysvar_instructions;
        let ix_sysvar_account_info = ix_sysvar_account.to_account_info();

        let mut programs: Vec<Pubkey> =
            Vec::with_capacity(DEFAULT_PROGRAMS.len() + self.additional.len());
        programs.extend(DEFAULT_PROGRAMS);
        programs.extend(&self.additional);

        verify_programs(&ix_sysvar_account_info, &programs)
    }
}

pub fn verify_programs(sysvar: &AccountInfo, programs: &[Pubkey]) -> Result<()> {
    let sysvar_data = sysvar.data.borrow();

    let mut index = 0;
    // determines the total number of instructions in the transaction
    let num_instructions =
        read_u16(&mut index, &sysvar_data).map_err(|_| ProgramError::InvalidAccountData)?;

    'outer: for index in 0..num_instructions {
        let mut offset = 2 + (index * 2) as usize;

        // offset for the number of accounts
        offset = read_u16(&mut offset, &sysvar_data).unwrap() as usize;
        let num_accounts = read_u16(&mut offset, &sysvar_data).unwrap();

        // offset for the program id
        offset += (num_accounts as usize) * (1 + 32);
        let program_id = read_pubkey(&mut offset, &sysvar_data).unwrap();

        for program in programs {
            if cmp_pubkeys(&program_id, program) {
                continue 'outer;
            }
        }

        msg!("Transaction had ix with program id {}", program_id);
        // if we reach this point, the program id was not found in the
        // programs list (the validation will fail)
        return err!(GumballGuardError::UnauthorizedProgramFound);
    }

    Ok(())
}
