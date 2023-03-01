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
        _ctx: &Context<'_, '_, '_, 'info, Mint<'info>>,
        _mint_args: &[u8],
        _guard_set: &GuardSet,
        _evaluation_context: &mut EvaluationContext,
    ) -> Result<()> {
        let clock = Clock::get()?;

        if clock.unix_timestamp >= self.date {
            return err!(CandyGuardError::AfterEndDate);
        }

        Ok(())
    }
}
