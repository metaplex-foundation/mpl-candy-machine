use std::collections::HashSet;

use anchor_lang::{prelude::*, AnchorDeserialize};
use solana_program::program_memory::sol_memcmp;

use crate::{errors::GumballGuardError, guards::*, utils::fixed_length_string};
use mpl_candy_guard_derive::GuardSet;

// Bytes offset for the start of the data section:
//     8 (discriminator)
//  + 32 (base)
//  +  1 (bump)
//  + 32 (authority)
pub const DATA_OFFSET: usize = 8 + 32 + 1 + 32;

// Maximim group label size.
pub const MAX_LABEL_SIZE: usize = 6;

// Seed value for PDA.
pub const SEED: &[u8] = b"gumball_guard";

#[account]
#[derive(Default)]
pub struct GumballGuard {
    // Base key used to generate the PDA
    pub base: Pubkey,
    // Bump seed
    pub bump: u8,
    // Authority of the guard
    pub authority: Pubkey,
    // after this there is a flexible amount of data to serialize
    // data (GumballGuardData struct) of the available guards; the size
    // of the data is adjustable as new guards are implemented (the
    // account is resized using realloc)
    //
    // available guards:
    //  1) bot tax
    //  2) sol payment
    //  3) token payment
    //  4) start date
    //  5) third party signer
    //  6) token gate
    //  7) gatekeeper
    //  8) end date
    //  9) allow list
    // 10) mint limit
    // 11) nft payment
    // 12) redeemed amount
    // 13) address gate
    // 14) nft gate
    // 15) nft burn
    // 16) token burn
    // 17) freeze sol payment
    // 18) freeze token payment
    // 19) program gate
    // 20) allocation
    // 21) token2022 payment
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct GumballGuardData {
    pub default: GuardSet,
    pub groups: Option<Vec<Group>>,
}

/// A group represent a specific set of guards. When groups are used, transactions
/// must specify which group should be used during validation.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct Group {
    pub label: String,
    pub guards: GuardSet,
}

/// The set of guards available.
#[derive(GuardSet, AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct GuardSet {
    /// Last instruction check and bot tax (penalty for invalid transactions).
    pub bot_tax: Option<BotTax>,
    /// Start data guard (controls when minting is allowed).
    pub start_date: Option<StartDate>,
    /// Sol payment guard (set the price for the mint in lamports).
    pub sol_payment: Option<SolPayment>,
    /// Token payment guard (set the price for the mint in spl-token amount).
    pub token_payment: Option<TokenPayment>,
    /// Third party signer guard (requires an extra signer for the transaction).
    pub third_party_signer: Option<ThirdPartySigner>,
    /// Token gate guard (restrict access to holders of a specific token).
    pub token_gate: Option<TokenGate>,
    /// Gatekeeper guard (captcha challenge).
    pub gatekeeper: Option<Gatekeeper>,
    /// End date guard (set an end date to stop the mint).
    pub end_date: Option<EndDate>,
    /// Allow list guard (curated list of allowed addresses).
    pub allow_list: Option<AllowList>,
    /// Mint limit guard (add a limit on the number of mints per wallet).
    pub mint_limit: Option<MintLimit>,
    /// NFT Payment (charge an NFT in order to mint).
    pub nft_payment: Option<NftPayment>,
    /// Redeemed amount guard (add a limit on the overall number of items minted).
    pub redeemed_amount: Option<RedeemedAmount>,
    /// Address gate (check access against a specified address).
    pub address_gate: Option<AddressGate>,
    /// NFT gate guard (check access based on holding a specified NFT).
    pub nft_gate: Option<NftGate>,
    /// NFT burn guard (burn a specified NFT).
    pub nft_burn: Option<NftBurn>,
    /// Token burn guard (burn a specified amount of spl-token).
    pub token_burn: Option<TokenBurn>,
    /// Program gate guard (restricts the programs that can be in a mint transaction).
    pub program_gate: Option<ProgramGate>,
    /// Allocation guard (specify the maximum number of mints in a group).
    pub allocation: Option<Allocation>,
    /// Token2022 payment guard (set the price for the mint in spl-token-2022 amount).
    pub token2022_payment: Option<Token2022Payment>,
}

/// Available guard types.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub enum GuardType {
    BotTax,
    StartDate,
    SolPayment,
    TokenPayment,
    ThirdPartySigner,
    TokenGate,
    Gatekeeper,
    EndDate,
    AllowList,
    MintLimit,
    NftPayment,
    RedeemedAmount,
    AddressGate,
    NftGate,
    NftBurn,
    TokenBurn,
    ProgramGate,
    Allocation,
    Token2022Payment,
}

impl GuardType {
    pub fn as_mask(guard_type: GuardType) -> u64 {
        0b1u64 << (guard_type as u8)
    }
}

impl GumballGuardData {
    /// Serialize the gumball guard data into the specified data array.
    pub fn save(&self, data: &mut [u8]) -> Result<()> {
        let mut cursor = 0;

        // saves the 'default' guard set
        let _ = self.default.to_data(data)?;
        cursor += self.default.size();

        // stores the number of 'groups' guard set
        let group_counter = if let Some(groups) = &self.groups {
            groups.len() as u32
        } else {
            0
        };
        data[cursor..cursor + 4].copy_from_slice(&u32::to_le_bytes(group_counter));
        cursor += 4;

        // saves each individual 'groups' guard set
        if let Some(groups) = &self.groups {
            for group in groups {
                // label
                let label = fixed_length_string(group.label.to_string(), MAX_LABEL_SIZE)?;
                data[cursor..cursor + MAX_LABEL_SIZE].copy_from_slice(label.as_bytes());
                cursor += MAX_LABEL_SIZE;
                // guard set
                let _ = group.guards.to_data(&mut data[cursor..])?;
                cursor += group.guards.size();
            }
        }

        Ok(())
    }

    /// Deserializes the guards. Only attempts the deserialization of individuals guards
    /// if the data slice is large enough.
    pub fn load(data: &[u8]) -> Result<Box<Self>> {
        let (default, _) = GuardSet::from_data(data)?;
        let mut cursor = default.size();

        let group_counter = u32::from_le_bytes(*arrayref::array_ref![data, cursor, 4]);
        cursor += 4;

        let groups = if group_counter > 0 {
            let mut groups = Vec::with_capacity(group_counter as usize);

            for _i in 0..group_counter {
                let slice: &[u8] = &data[cursor..cursor + MAX_LABEL_SIZE];
                let label = String::from_utf8(slice.to_vec())
                    .map_err(|_| GumballGuardError::DeserializationError)?;
                cursor += MAX_LABEL_SIZE;
                let (guards, _) = GuardSet::from_data(&data[cursor..])?;
                cursor += guards.size();
                groups.push(Group { label, guards });
            }

            Some(groups)
        } else {
            None
        };

        // sanity check: the bytes read must match the data size
        if data.len() != cursor {
            msg!("Read {} bytes, received {} bytes", cursor, data.len());
            return err!(GumballGuardError::DeserializationError);
        }

        Ok(Box::new(Self { default, groups }))
    }

    pub fn active_set(data: &[u8], label: Option<String>) -> Result<Box<GuardSet>> {
        // default guard set
        let (mut default, _) = GuardSet::from_data(data)?;
        let mut cursor = default.size();

        // number of groups
        let group_counter = u32::from_le_bytes(*arrayref::array_ref![data, cursor, 4]);
        cursor += 4;

        if group_counter > 0 {
            if let Some(label) = label {
                let group_label = fixed_length_string(label, MAX_LABEL_SIZE)?;
                let label_slice = group_label.as_bytes();
                // retrieves the selected group
                for _i in 0..group_counter {
                    if sol_memcmp(label_slice, &data[cursor..], label_slice.len()) == 0 {
                        cursor += MAX_LABEL_SIZE;
                        let (guards, _) = GuardSet::from_data(&data[cursor..])?;
                        default.merge(guards);
                        // we found our group
                        return Ok(Box::new(default));
                    } else {
                        cursor += MAX_LABEL_SIZE;
                        let features = u64::from_le_bytes(*arrayref::array_ref![data, cursor, 8]);
                        cursor += GuardSet::bytes_count(features);
                    }
                }
                return err!(GumballGuardError::GroupNotFound);
            }
            // if we have groups, label is required
            return err!(GumballGuardError::RequiredGroupLabelNotFound);
        } else if label.is_some() {
            return err!(GumballGuardError::GroupNotFound);
        }

        Ok(Box::new(default))
    }

    pub fn account_size(&self) -> usize {
        DATA_OFFSET + self.size()
    }

    pub fn size(&self) -> usize {
        let mut size = self.default.size();
        size += 4; // u32 (number of groups)

        if let Some(groups) = &self.groups {
            size += groups
                .iter()
                .map(|group| MAX_LABEL_SIZE + group.guards.size())
                .sum::<usize>();
        }

        size
    }

    pub fn verify(&self) -> Result<()> {
        // set of unique labels
        let mut labels = HashSet::new();

        if let Some(groups) = &self.groups {
            for group in groups {
                if labels.contains(&group.label) {
                    return err!(GumballGuardError::DuplicatedGroupLabel);
                }

                labels.insert(group.label.clone());
            }
        }

        // verify the guards configuration
        GuardSet::verify(self)
    }
}
