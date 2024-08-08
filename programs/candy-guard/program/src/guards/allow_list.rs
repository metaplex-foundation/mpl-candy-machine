use super::*;
use crate::{
    instructions::Route,
    state::GuardType,
    utils::{assert_keys_equal, assert_owned_by, cmp_pubkeys},
};
use anchor_lang::system_program;
use solana_program::{program::invoke_signed, system_instruction};

/// Guard that uses a merkle tree to specify the addresses allowed to mint.
///
/// List of accounts required:
///
///   0. `[]` Pda created by the merkle proof instruction (seeds `["allow_list", merke tree root,
///           payer key, gumball guard pubkey, gumball machine pubkey]`).
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct AllowList {
    /// Merkle root of the addresses allowed to mint.
    pub merkle_root: [u8; 32],
}

impl AllowList {
    /// Returns true if a `leaf` can be proved to be a part of a Merkle tree
    /// defined by `root`. For this, a `proof` must be provided, containing
    /// sibling hashes on the branch from the leaf to the root of the tree. Each
    /// pair of leaves and each pair of pre-images are assumed to be sorted.
    fn verify(proof: &[[u8; 32]], root: &[u8; 32], leaf: &[u8; 32]) -> bool {
        let mut computed_hash = *leaf;
        for proof_element in proof.iter() {
            if computed_hash <= *proof_element {
                // hash (current computed hash + current element of the proof)
                computed_hash = solana_program::keccak::hashv(&[&computed_hash, proof_element]).0
            } else {
                // hash (current element of the proof + current computed hash)
                computed_hash = solana_program::keccak::hashv(&[proof_element, &computed_hash]).0;
            }
        }
        // check if the computed hash (root) is equal to the provided root
        computed_hash == *root
    }
}

impl Guard for AllowList {
    fn size() -> usize {
        32 // merkle_root
    }

    fn mask() -> u64 {
        GuardType::as_mask(GuardType::AllowList)
    }

    /// Instruction to validate an address against the merkle tree.
    ///
    /// List of accounts required:
    ///
    ///   0. `[writable]` Pda to represent the merkle proof (seeds `["allow_list", merke tree root,
    ///                   payer/minter key, gumball guard pubkey, gumball machine pubkey]`).
    ///   1. `[]` System program account.
    ///   2. `[optional]` Minter account.
    fn instruction<'c: 'info, 'info>(
        ctx: &Context<'_, '_, 'c, 'info, Route<'info>>,
        route_context: RouteContext<'info>,
        data: Vec<u8>,
    ) -> Result<()> {
        msg!("AllowList: validate proof instruction");

        let gumball_guard = route_context
            .gumball_guard
            .as_ref()
            .ok_or(GumballGuardError::Uninitialized)?;

        let gumball_machine = route_context
            .gumball_machine
            .as_ref()
            .ok_or(GumballGuardError::Uninitialized)?;

        // and the gumball guard and gumball machine must be linked
        if !cmp_pubkeys(&gumball_machine.mint_authority, &gumball_guard.key()) {
            return err!(GumballGuardError::InvalidMintAuthority);
        }

        let proof_pda = try_get_account_info(ctx.remaining_accounts, 0)?;
        let system_program_info = try_get_account_info(ctx.remaining_accounts, 1)?;
        assert_keys_equal(system_program_info.key, &system_program::ID)?;

        let minter = if let Some(minter) = get_account_info(ctx.remaining_accounts, 2) {
            minter.key()
        } else {
            ctx.accounts.payer.key()
        };

        // validates the proof

        let merkle_proof: Vec<[u8; 32]> = if let Ok(proof) = Vec::try_from_slice(&data[..]) {
            proof
        } else {
            return err!(GumballGuardError::MissingAllowedListProof);
        };

        let leaf = solana_program::keccak::hashv(&[minter.to_string().as_bytes()]);

        let guard_set = if let Some(guard_set) = route_context.guard_set {
            guard_set
        } else {
            return err!(GumballGuardError::AllowedListNotEnabled);
        };

        let merkle_root = if let Some(allow_list) = &guard_set.allow_list {
            &allow_list.merkle_root
        } else {
            return err!(GumballGuardError::AllowedListNotEnabled);
        };

        if !Self::verify(&merkle_proof[..], merkle_root, &leaf.0) {
            return err!(GumballGuardError::AddressNotFoundInAllowedList);
        }

        // creates the proof PDA

        let gumball_guard_key = &ctx.accounts.gumball_guard.key();
        let gumball_machine_key = &ctx.accounts.gumball_machine.key();

        let seeds = [
            AllowListProof::PREFIX_SEED,
            &merkle_root[..],
            minter.as_ref(),
            gumball_guard_key.as_ref(),
            gumball_machine_key.as_ref(),
        ];
        let (pda, bump) = Pubkey::find_program_address(&seeds, &crate::ID);

        assert_keys_equal(proof_pda.key, &pda)?;

        if proof_pda.data_is_empty() {
            let signer = [
                AllowListProof::PREFIX_SEED,
                &merkle_root[..],
                minter.as_ref(),
                gumball_guard_key.as_ref(),
                gumball_machine_key.as_ref(),
                &[bump],
            ];
            let rent = Rent::get()?;

            invoke_signed(
                &system_instruction::create_account(
                    &ctx.accounts.payer.key(),
                    &pda,
                    rent.minimum_balance(std::mem::size_of::<i64>()),
                    std::mem::size_of::<i64>() as u64,
                    &crate::ID,
                ),
                &[
                    ctx.accounts.payer.to_account_info(),
                    proof_pda.to_account_info(),
                ],
                &[&signer],
            )?;
        } else {
            // if it an existing account, make sure it has the correct ownwer
            assert_owned_by(proof_pda, &crate::ID)?;
        }

        let mut account_data = proof_pda.try_borrow_mut_data()?;
        let mut proof = AllowListProof::try_from_slice(&account_data)?;
        proof.timestamp = Clock::get()?.unix_timestamp;
        // saves the changes back to the pda
        let data = &mut proof.try_to_vec().unwrap();
        account_data[0..data.len()].copy_from_slice(data);

        Ok(())
    }
}

impl Condition for AllowList {
    fn validate<'info>(
        &self,
        ctx: &mut EvaluationContext,
        _guard_set: &GuardSet,
        _mint_args: &[u8],
    ) -> Result<()> {
        let proof_pda = try_get_account_info(ctx.accounts.remaining, ctx.account_cursor)?;
        ctx.account_cursor += 1;
        let minter = ctx.accounts.buyer.key();

        // validates the pda

        let gumball_guard_key = &ctx.accounts.gumball_guard.key();
        let gumball_machine_key = &ctx.accounts.gumball_machine.key();

        let seeds = [
            AllowListProof::PREFIX_SEED,
            &self.merkle_root[..],
            minter.as_ref(),
            gumball_guard_key.as_ref(),
            gumball_machine_key.as_ref(),
        ];
        let (pda, _) = Pubkey::find_program_address(&seeds, &crate::ID);

        assert_keys_equal(proof_pda.key, &pda)?;

        if proof_pda.data_is_empty() {
            return err!(GumballGuardError::MissingAllowedListProof);
        }

        assert_owned_by(proof_pda, &crate::ID)?;

        Ok(())
    }
}

/// PDA to track whether an address has been validated or not.
#[derive(AnchorDeserialize, AnchorSerialize)]
pub struct AllowListProof {
    pub timestamp: i64,
}

impl AllowListProof {
    /// Prefix used as seed.
    pub const PREFIX_SEED: &'static [u8] = b"allow_list";
}
