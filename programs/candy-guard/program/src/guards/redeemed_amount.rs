use crate::state::GuardType;

use super::*;

/// Guard that stop the mint once the specified amount of items
/// redeenmed is reached.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct RedeemedAmount {
    pub maximum: u64,
}

impl Guard for RedeemedAmount {
    fn size() -> usize {
        8 // maximum
    }

    fn mask() -> u64 {
        GuardType::as_mask(GuardType::RedeemedAmount)
    }
}

impl Condition for RedeemedAmount {
    fn validate<'info>(
        &self,
        ctx: &Context<'_, '_, '_, 'info, Mint<'info>>,
        _mint_args: &[u8],
        _guard_set: &GuardSet,
        _evaluation_context: &mut EvaluationContext,
    ) -> Result<()> {
        let candy_machine = &ctx.accounts.candy_machine;

        if candy_machine.items_redeemed >= self.maximum {
            return err!(CandyGuardError::MaximumRedeemedAmount);
        }

        Ok(())
    }
}
