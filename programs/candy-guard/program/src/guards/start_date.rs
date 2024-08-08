use crate::state::GuardType;

use super::*;

/// Guard that sets a specific start date for the mint.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct StartDate {
    pub date: i64,
}

impl Guard for StartDate {
    fn size() -> usize {
        8 // date
    }

    fn mask() -> u64 {
        GuardType::as_mask(GuardType::StartDate)
    }
}

impl Condition for StartDate {
    fn validate<'info>(
        &self,
        _ctx: &mut EvaluationContext,
        _guard_set: &GuardSet,
        _mint_args: &[u8],
    ) -> Result<()> {
        let clock = Clock::get()?;

        if clock.unix_timestamp < self.date {
            return err!(GumballGuardError::MintNotLive);
        }

        Ok(())
    }
}
