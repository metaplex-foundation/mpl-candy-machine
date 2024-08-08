use crate::state::GuardType;

use super::*;

/// Guard that sets a specific date for the mint to stop.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct EndDate {
    pub date: i64,
}

impl Guard for EndDate {
    fn size() -> usize {
        8 // date
    }

    fn mask() -> u64 {
        GuardType::as_mask(GuardType::EndDate)
    }
}

impl Condition for EndDate {
    fn validate<'info>(
        &self,
        _ctx: &mut EvaluationContext,
        _guard_set: &GuardSet,
        _mint_args: &[u8],
    ) -> Result<()> {
        let clock = Clock::get()?;

        if clock.unix_timestamp >= self.date {
            return err!(GumballGuardError::AfterEndDate);
        }

        Ok(())
    }
}
