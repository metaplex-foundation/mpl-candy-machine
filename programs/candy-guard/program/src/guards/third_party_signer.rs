use super::*;
use crate::{state::GuardType, utils::cmp_pubkeys};

/// Guard that requires a specified signer to validate the transaction.
///
/// List of accounts required:
///
///   0. `[signer]` Signer of the transaction.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct ThirdPartySigner {
    pub signer_key: Pubkey,
}

impl Guard for ThirdPartySigner {
    fn size() -> usize {
        32 // Pubkey
    }

    fn mask() -> u64 {
        GuardType::as_mask(GuardType::ThirdPartySigner)
    }
}

impl Condition for ThirdPartySigner {
    fn validate<'info>(
        &self,
        ctx: &mut EvaluationContext,
        _guard_set: &GuardSet,
        _mint_args: &[u8],
    ) -> Result<()> {
        let signer_index = ctx.account_cursor;
        ctx.account_cursor += 1;
        let signer_account = try_get_account_info(ctx.accounts.remaining, signer_index)?;

        if !(cmp_pubkeys(signer_account.key, &self.signer_key) && signer_account.is_signer) {
            return err!(GumballGuardError::MissingRequiredSignature);
        }

        Ok(())
    }
}
