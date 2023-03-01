use crate::{state::GuardType, utils::cmp_pubkeys};

use super::*;

/// Guard that restricts access to a specific address.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct AddressGate {
    pub address: Pubkey,
}

impl Guard for AddressGate {
    fn size() -> usize {
        32 // address
    }

    fn mask() -> u64 {
        GuardType::as_mask(GuardType::AddressGate)
    }
}

impl Condition for AddressGate {
    fn validate<'info>(
        &self,
        ctx: &Context<'_, '_, '_, 'info, Mint<'info>>,
        _mint_args: &[u8],
        _guard_set: &GuardSet,
        _evaluation_context: &mut EvaluationContext,
    ) -> Result<()> {
        if !cmp_pubkeys(&ctx.accounts.payer.key(), &self.address) {
            return err!(CandyGuardError::AddressNotAuthorized);
        }

        Ok(())
    }
}
