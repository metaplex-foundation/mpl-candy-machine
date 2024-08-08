use crate::state::GuardType;

use super::*;

// The program ID (not exported from the gateway integration crate).
// const GATEWAY_PROGRAM_ID: Pubkey =
//     solana_program::pubkey!("gatem74V238djXdzWnJf94Wo1DcnuGkfijbf3AuBhfs");

/// Guard that validates if the payer of the transaction has a token from a specified
/// gateway network — in most cases, a token after completing a captcha challenge.
///
/// List of accounts required:
///
///   0. `[writeable]` Gatekeeper token account.
///   1. `[]` Gatekeeper program account.
///   2. `[]` Gatekeeper expire account.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct Gatekeeper {
    /// The network for the gateway token required
    pub gatekeeper_network: Pubkey,
    /// Whether or not the token should expire after minting.
    /// The gatekeeper network must support this if true.
    pub expire_on_use: bool,
}

impl Guard for Gatekeeper {
    fn size() -> usize {
        32  // gatekeeper network
        + 1 // expire on use
    }

    fn mask() -> u64 {
        GuardType::as_mask(GuardType::Gatekeeper)
    }
}

impl Condition for Gatekeeper {
    fn validate<'info>(
        &self,
        _: &mut EvaluationContext,
        _guard_set: &GuardSet,
        _mint_args: &[u8],
    ) -> Result<()> {
        // // retrieves the (potential) gateway token
        // let gateway_index = ctx.account_cursor;
        // let gateway_token_account = try_get_account_info(ctx.accounts.remaining, gateway_index)?;
        // // consumes the gatekeeper token account
        // ctx.account_cursor += 1;

        // ctx.indices.insert("gateway_index", gateway_index);

        // // splits up verify and burn: we verify everything regardless of whether
        // // it should be burned or not
        // Gateway::verify_gateway_token_account_info(
        //     gateway_token_account,
        //     ctx.accounts.minter.key,
        //     &self.gatekeeper_network,
        //     None,
        // )
        // .map_err(|_| error!(GumballGuardError::GatewayTokenInvalid))?;

        // if self.expire_on_use {
        //     // if expire on use is true, two more accounts are needed.
        //     // Ensure they are present and correct
        //     let gateway_program_key =
        //         try_get_account_info(ctx.accounts.remaining, gateway_index + 1)?.key;
        //     assert_keys_equal(gateway_program_key, &GATEWAY_PROGRAM_ID)?;
        //     let expiry_key = try_get_account_info(ctx.accounts.remaining, gateway_index + 2)?.key;
        //     // increment counter for next guard
        //     ctx.account_cursor += 2;
        //     let expected_expiry_key = get_expire_address_with_seed(&self.gatekeeper_network).0;
        //     assert_keys_equal(expiry_key, &expected_expiry_key)?;
        // }

        Ok(())
    }

    fn pre_actions<'info>(
        &self,
        _: &mut EvaluationContext,
        _guard_set: &GuardSet,
        _mint_args: &[u8],
    ) -> Result<()> {
        // if self.expire_on_use {
        //     let gateway_index = ctx.indices["gateway_index"];
        //     // the accounts have already been validated
        //     let gateway_token_info = try_get_account_info(ctx.accounts.remaining, gateway_index)?;
        //     let gateway_program_info =
        //         try_get_account_info(ctx.accounts.remaining, gateway_index + 1)?;
        //     let expiry_info = try_get_account_info(ctx.accounts.remaining, gateway_index + 2)?;

        //     invoke(
        //         &expire_token(
        //             *gateway_token_info.key,
        //             *ctx.accounts.minter.key,
        //             self.gatekeeper_network,
        //         ),
        //         &[
        //             gateway_token_info.to_account_info(),
        //             ctx.accounts.minter.to_account_info(),
        //             expiry_info.to_account_info(),
        //             gateway_program_info.to_account_info(),
        //         ],
        //     )?;
        // }

        Ok(())
    }
}
