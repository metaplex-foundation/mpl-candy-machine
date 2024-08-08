use super::*;

use crate::{state::GuardType, utils::*};

/// Guard that restricts access to addresses that hold the specified spl-token.
///
/// List of accounts required:
///
///   0. `[]` Token account holding the required amount.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct TokenGate {
    pub amount: u64,
    pub mint: Pubkey,
}

impl Guard for TokenGate {
    fn size() -> usize {
        8    // amount
        + 32 // mint
    }

    fn mask() -> u64 {
        GuardType::as_mask(GuardType::TokenGate)
    }
}

impl Condition for TokenGate {
    fn validate<'info>(
        &self,
        ctx: &mut EvaluationContext,
        _guard_set: &GuardSet,
        _mint_args: &[u8],
    ) -> Result<()> {
        // retrieves the (potential) token gate account
        let token_gate_index = ctx.account_cursor;
        let token_gate_account = try_get_account_info(ctx.accounts.remaining, token_gate_index)?;
        // consumes the gate token account
        ctx.account_cursor += 1;

        let account = assert_is_ata(token_gate_account, &ctx.accounts.buyer.key(), &self.mint)?;

        if account.amount < self.amount {
            return err!(GumballGuardError::NotEnoughTokens);
        }

        Ok(())
    }
}
