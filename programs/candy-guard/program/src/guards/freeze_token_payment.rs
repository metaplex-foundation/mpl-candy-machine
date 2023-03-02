use super::{freeze_sol_payment::freeze_nft, *};

use anchor_lang::AccountsClose;
use solana_program::{
    program::{invoke, invoke_signed},
    program_pack::Pack,
    system_instruction, system_program,
};
use spl_associated_token_account::{
    get_associated_token_address, instruction::create_associated_token_account,
};
use spl_token::{instruction::close_account, state::Account as TokenAccount};

use crate::{
    errors::CandyGuardError,
    guards::freeze_sol_payment::{initialize_freeze, thaw_nft, FREEZE_SOL_FEE},
    instructions::Token,
    state::GuardType,
    utils::{
        assert_initialized, assert_is_ata, assert_keys_equal, assert_owned_by, cmp_pubkeys,
        spl_token_transfer, TokenTransferParams,
    },
};

/// Guard that charges an amount in a specified spl-token as payment for the mint with a freeze period.
///
/// List of accounts required:
///
///   0. `[writable]` Freeze PDA to receive the funds (seeds `["freeze_escrow",
///           destination_ata pubkey, candy guard pubkey, candy machine pubkey]`).
///   1. `[]` Associate token account of the NFT (seeds `[payer pubkey, token
///           program pubkey, nft mint pubkey]`).
///   2. `[writable]` Token account holding the required amount.
///   3. `[writable]` Associate token account of the Freeze PDA (seeds `[freeze PDA
///                   pubkey, token program pubkey, nft mint pubkey]`).
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct FreezeTokenPayment {
    pub amount: u64,
    pub mint: Pubkey,
    pub destination_ata: Pubkey,
}

impl Guard for FreezeTokenPayment {
    fn size() -> usize {
        8    // amount
        + 32 // token mint
        + 32 // destination ata
    }

    fn mask() -> u64 {
        GuardType::as_mask(GuardType::FreezeTokenPayment)
    }

    /// Instructions to interact with the freeze feature:
    ///
    ///  * initialize
    ///  * thaw
    ///  * unlock funds
    fn instruction<'info>(
        ctx: &Context<'_, '_, '_, 'info, Route<'info>>,
        route_context: RouteContext<'info>,
        data: Vec<u8>,
    ) -> Result<()> {
        // determines the instruction to execute
        let instruction: FreezeInstruction =
            if let Ok(instruction) = FreezeInstruction::try_from_slice(&data[0..1]) {
                instruction
            } else {
                return err!(CandyGuardError::MissingFreezeInstruction);
            };

        match instruction {
            // List of accounts required:
            //
            //   0. `[writable]` Freeze PDA to receive the funds (seeds `["freeze_escrow",
            //                   destination_ata pubkey, candy guard pubkey, candy machine pubkey]`).
            //   1. `[signer]` Candy Guard authority.
            //   2. `[]` System program account.
            //   3. `[writable]` Associate token account of the Freeze PDA (seeds `[freeze PDA
            //                   pubkey, token program pubkey, nft mint pubkey]`).
            //   4. `[]` Token mint account.
            //   5. `[]` Token program account.
            //   6. `[]` Associate token program account.
            //   7. `[]` Address to receive the funds (must match the `destination_ata` address
            //           of the guard configuration).
            FreezeInstruction::Initialize => {
                msg!("Instruction: Initialize (FreezeTokenPayment guard)");

                if route_context.candy_guard.is_none() || route_context.candy_machine.is_none() {
                    return err!(CandyGuardError::Uninitialized);
                }

                let (destination, mint) = if let Some(guard_set) = &route_context.guard_set {
                    if let Some(freeze_guard) = &guard_set.freeze_token_payment {
                        (freeze_guard.destination_ata, freeze_guard.mint)
                    } else {
                        return err!(CandyGuardError::FreezeGuardNotEnabled);
                    }
                } else {
                    return err!(CandyGuardError::FreezeGuardNotEnabled);
                };

                // initializes the freeze pda (the check of the authority as signer is done
                // during the initialization)
                initialize_freeze(ctx, route_context, data, destination)?;

                // initializes the freeze ata

                let freeze_pda = try_get_account_info(ctx.remaining_accounts, 0)?;

                let system_program = try_get_account_info(ctx.remaining_accounts, 2)?;
                assert_keys_equal(system_program.key, &system_program::ID)?;

                let freeze_ata = try_get_account_info(ctx.remaining_accounts, 3)?;
                let token_mint = try_get_account_info(ctx.remaining_accounts, 4)?;
                assert_keys_equal(token_mint.key, &mint)?;
                // spl token program
                let token_program = try_get_account_info(ctx.remaining_accounts, 5)?;
                assert_keys_equal(token_program.key, &spl_token::ID)?;
                // spl associated token program
                let associate_token_program = try_get_account_info(ctx.remaining_accounts, 6)?;
                assert_keys_equal(
                    associate_token_program.key,
                    &spl_associated_token_account::ID,
                )?;

                let destination_ata = try_get_account_info(ctx.remaining_accounts, 7)?;
                assert_keys_equal(destination_ata.key, &destination)?;
                let ata_account: spl_token::state::Account = assert_initialized(destination_ata)?;
                assert_keys_equal(&ata_account.mint, &mint)?;

                assert_keys_equal(
                    &get_associated_token_address(freeze_pda.key, token_mint.key),
                    freeze_ata.key,
                )?;

                invoke(
                    &create_associated_token_account(
                        ctx.accounts.payer.key,
                        freeze_pda.key,
                        token_mint.key,
                        &spl_token::ID,
                    ),
                    &[
                        ctx.accounts.payer.to_account_info(),
                        freeze_ata.to_account_info(),
                        freeze_pda.to_account_info(),
                        token_mint.to_account_info(),
                        system_program.to_account_info(),
                    ],
                )?;

                Ok(())
            }
            // Thaw an eligible NFT.
            //
            // List of accounts required:
            //
            //   0. `[writable]` Freeze PDA to receive the funds (seeds `["freeze_escrow",
            //                   destination_ata pubkey, candy guard pubkey, candy machine pubkey]`).
            //   1. `[]` Mint account for the NFT.
            //   2. `[]` Address of the owner of the NFT.
            //   3. `[writable]` Associate token account of the NFT.
            //   4. `[]` Master Edition account of the NFT.
            //   5. `[]` spl-token program ID.
            //   6. `[]` Metaplex Token Metadata program ID.
            FreezeInstruction::Thaw => {
                msg!("Instruction: Thaw (FreezeTokenPayment guard)");
                thaw_nft(ctx, route_context, data)
            }
            // Unlocks frozen funds.
            //
            // List of accounts required:
            //
            //   0. `[writable]` Freeze PDA (seeds `["freeze_escrow", destination_ata pubkey, candy guard pubkey,
            //                   candy machine pubkey]`).
            //   1. `[signer]` Candy Guard authority.
            //   2. `[writable]` Associate token account of the Freeze PDA (seeds `[freeze PDA pubkey, token
            //                   program pubkey, nft mint pubkey]`).
            //   3. `[writable]` Address to receive the funds (must match the `destination_ata` address
            //                   of the guard configuration).
            //   4. `[]` Token program account.
            //   5. `[]` System program account.
            FreezeInstruction::UnlockFunds => {
                msg!("Instruction: Unlock Funds (FreezeTokenPayment guard)");
                unlock_funds(ctx, route_context)
            }
        }
    }
}

impl Condition for FreezeTokenPayment {
    fn validate<'info>(
        &self,
        ctx: &mut EvaluationContext,
        _guard_set: &GuardSet,
        _mint_args: &[u8],
    ) -> Result<()> {
        let candy_guard_key = &ctx.accounts.candy_guard.key();
        let candy_machine_key = &ctx.accounts.candy_machine.key();

        // validates the additional accounts

        let index = ctx.account_cursor;
        let freeze_pda = try_get_account_info(ctx.accounts.remaining, index)?;
        ctx.account_cursor += 1;

        let seeds = [
            FreezeEscrow::PREFIX_SEED,
            self.destination_ata.as_ref(),
            candy_guard_key.as_ref(),
            candy_machine_key.as_ref(),
        ];

        let (pda, _) = Pubkey::find_program_address(&seeds, &crate::ID);
        assert_keys_equal(freeze_pda.key, &pda)?;

        if freeze_pda.data_is_empty() {
            return err!(CandyGuardError::FreezeNotInitialized);
        }

        let nft_ata = try_get_account_info(ctx.accounts.remaining, index + 1)?;
        ctx.account_cursor += 1;
        assert_is_ata(nft_ata, ctx.accounts.payer.key, ctx.accounts.nft_mint.key)?;

        let token_account_info = try_get_account_info(ctx.accounts.remaining, index + 2)?;
        // validate freeze_pda ata
        let destination_ata = try_get_account_info(ctx.accounts.remaining, index + 3)?;
        assert_is_ata(destination_ata, &freeze_pda.key(), &self.mint)?;

        ctx.account_cursor += 2;

        let token_account =
            assert_is_ata(token_account_info, &ctx.accounts.payer.key(), &self.mint)?;

        if token_account.amount < self.amount {
            return err!(CandyGuardError::NotEnoughTokens);
        }

        if ctx.accounts.payer.lamports() < FREEZE_SOL_FEE {
            msg!(
                "Require {} lamports, accounts has {} lamports",
                FREEZE_SOL_FEE,
                ctx.accounts.payer.lamports(),
            );
            return err!(CandyGuardError::NotEnoughSOL);
        }

        ctx.indices.insert("freeze_token_payment", index);

        Ok(())
    }

    fn pre_actions<'info>(
        &self,
        ctx: &mut EvaluationContext,
        _guard_set: &GuardSet,
        _mint_args: &[u8],
    ) -> Result<()> {
        let index = ctx.indices["freeze_token_payment"];
        // the accounts have already been validated
        let freeze_pda = try_get_account_info(ctx.accounts.remaining, index)?;
        let token_account_info = try_get_account_info(ctx.accounts.remaining, index + 2)?;
        let destination_ata = try_get_account_info(ctx.accounts.remaining, index + 3)?;

        spl_token_transfer(TokenTransferParams {
            source: token_account_info.to_account_info(),
            destination: destination_ata.to_account_info(),
            authority: ctx.accounts.payer.to_account_info(),
            authority_signer_seeds: &[],
            token_program: ctx.accounts.spl_token_program.to_account_info(),
            amount: self.amount,
        })?;

        invoke(
            &system_instruction::transfer(
                &ctx.accounts.payer.key(),
                &freeze_pda.key(),
                FREEZE_SOL_FEE,
            ),
            &[
                ctx.accounts.payer.to_account_info(),
                freeze_pda.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
        )?;

        Ok(())
    }

    fn post_actions<'info>(
        &self,
        ctx: &mut EvaluationContext,
        _guard_set: &GuardSet,
        _mint_args: &[u8],
    ) -> Result<()> {
        // freezes the nft
        freeze_nft(
            ctx,
            ctx.indices["freeze_token_payment"],
            &self.destination_ata,
        )
    }
}

// Helper function to unlocks frozen funds.
fn unlock_funds<'info>(
    ctx: &Context<'_, '_, '_, 'info, Route<'info>>,
    route_context: RouteContext<'info>,
) -> Result<()> {
    let candy_guard_key = &ctx.accounts.candy_guard.key();
    let candy_machine_key = &ctx.accounts.candy_machine.key();

    let freeze_pda = try_get_account_info(ctx.remaining_accounts, 0)?;
    let freeze_escrow: Account<FreezeEscrow> = Account::try_from(freeze_pda)?;

    let seeds = [
        FreezeEscrow::PREFIX_SEED,
        freeze_escrow.destination.as_ref(),
        candy_guard_key.as_ref(),
        candy_machine_key.as_ref(),
    ];
    let (pda, bump) = Pubkey::find_program_address(&seeds, &crate::ID);
    assert_keys_equal(freeze_pda.key, &pda)?;

    // authority must the a signer
    let authority = try_get_account_info(ctx.remaining_accounts, 1)?;

    // if the candy guard account is present, we check the authority against
    // the candy guard authority; otherwise we use the freeze escrow authority
    let authority_check = if let Some(candy_guard) = route_context.candy_guard {
        candy_guard.authority
    } else {
        freeze_escrow.authority
    };

    if !(cmp_pubkeys(authority.key, &authority_check) && authority.is_signer) {
        return err!(CandyGuardError::MissingRequiredSignature);
    }

    // all NFTs must be thaw
    if freeze_escrow.frozen_count > 0 {
        return err!(CandyGuardError::UnlockNotEnabled);
    }

    let freeze_ata = try_get_account_info(ctx.remaining_accounts, 2)?;
    assert_owned_by(freeze_ata, &spl_token::ID)?;
    let freeze_ata_account = TokenAccount::unpack(&freeze_ata.try_borrow_data()?)?;
    assert_keys_equal(&freeze_ata_account.owner, freeze_pda.key)?;

    let destination_ata_account = try_get_account_info(ctx.remaining_accounts, 3)?;
    assert_keys_equal(&freeze_escrow.destination, destination_ata_account.key)?;

    let token_program = try_get_account_info(ctx.remaining_accounts, 4)?;
    assert_keys_equal(token_program.key, &Token::id())?;

    // transfer the tokens

    let signer = [
        FreezeEscrow::PREFIX_SEED,
        freeze_escrow.destination.as_ref(),
        candy_guard_key.as_ref(),
        candy_machine_key.as_ref(),
        &[bump],
    ];

    spl_token_transfer(TokenTransferParams {
        source: freeze_ata.to_account_info(),
        destination: destination_ata_account.to_account_info(),
        authority: freeze_pda.to_account_info(),
        authority_signer_seeds: &signer,
        token_program: token_program.to_account_info(),
        amount: freeze_ata_account.amount,
    })?;

    // close the freeze ata

    invoke_signed(
        &close_account(
            token_program.key,
            freeze_ata.key,
            authority.key,
            freeze_pda.key,
            &[],
        )?,
        &[
            freeze_ata.to_account_info(),
            authority.to_account_info(),
            freeze_pda.to_account_info(),
            token_program.to_account_info(),
        ],
        &[&signer],
    )?;

    // the rent for the freeze escrow goes back to the authority
    freeze_escrow.close(authority.to_account_info())?;

    Ok(())
}
