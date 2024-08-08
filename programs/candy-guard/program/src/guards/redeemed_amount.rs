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
        ctx: &mut EvaluationContext,
        _guard_set: &GuardSet,
        _mint_args: &[u8],
    ) -> Result<()> {
        let gumball_machine = &ctx.accounts.gumball_machine;

        if gumball_machine.items_redeemed >= self.maximum {
            return err!(GumballGuardError::MaximumRedeemedAmount);
        }

        Ok(())
    }
}
