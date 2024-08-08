# Metaplex Gumball Guard

---

### 💡 Update:

From Gumball Guard v0.2.0, the serialization logic for the arguments of the `initialize` and `update` instructions expect a `[u8]` represeting the custom serialized struct. This is to ensure adding new guards in the future does not affect clients.

If you are using the `mpl-candy-guard` npm package, you can serialize the `GumballMachineData` object using:

```typescript
import { serialize } from '@metaplex-foundation/mpl-candy-guard';

const data = { ... };
const serializedData = serialize(data);
```

If you are using the `mpl-candy-guard` Rust crate, you can serialize the `GumballMachineData` struct using:

```rust
let data = GumballGuardData { ... };
let mut serialized_data = vec![0; data.size()];
data.save(&mut serialized_data)?;
```

---

## Overview

The new `Gumball Guard` program is designed to take away the **access control** logic from the `Gumball Machine` to handle the additional mint features, while the Gumball Machine program retains its core mint functionality &mdash; the creation of the NFT. This not only provides a clear separation between **access controls** and **mint logic**, it also provides a modular and flexible architecture to add or remove mint features without having to modify the Gumball Machine program.

The access control on a Gumball Guard is encapsulated in individuals guards representing a specific rule that needs to be satisfied, which can be enabled or disabled. For example, the live date of the mint is represented as the `LiveDate` guard. This guard is satisfied only if the transaction time is on or after the configured start time on the guard. Other guards can validate different aspects of the access control – e.g., ensuring that the user holds a specific token (token gating).

> **Note**
> The Gumball Guard program can only be used in combination with `Gumball Machine Core` (`Gumball Machine V3`) accounts. When a Gumball Guard is used in combination with a Gumball Machine, it becomes its mint authority and minting is only possible through the Gumball Guard.

### How the program works?

![image](https://user-images.githubusercontent.com/729235/192335006-d4f2c573-165f-4c5a-aef7-7428cd74bb2b.png)

The main purpose of the Gumball Guard program is to hold the configuration of mint **guards** and apply them before a user can mint from a gumball machine. If all enabled guard conditions are valid, the mint transaction is forwarded to the Gumball Machine.

When a mint transaction is received, the program performs the following steps:

1. Validates the transaction against all enabled guards.
   - If any of the guards fail at this point, the transaction is subject to the `BotTax` (when the `BotTax` guard is enabled) and the transaction is then aborted.
2. After evaluating that all guards are valid, it invokes the `pre_actions` function on each guard. This function is responsible to perform any action **before** the mint (e.g., take payment for the mint).
3. Then the transaction is forwarded to the Gumball Machine program to mint the NFT.
4. Finally, it invokes the `post_actions` function on each enabled guard. This function is responsible to perform any action **after** the mint (e.g., freeze the NFT, change the update authority).

A **guard** is a modular piece of code that can be easily added to the Gumball Guard program, providing great flexibility and simplicity to support specific features without having to modify directly the Gumball Machine program. Adding new guards is supported by conforming to specific interfaces, with changes isolated to the individual guard – e.g., each guard can be created and modified in isolation. This architecture also provides the flexibility to enable/disable guards without requiring code changes, as each guard has an enable/disable "switch".

The Gumball Guard program contains a set of core access control guards that can be enabled/disabled:

- `AddressGate`: restricts the mint to a single address
- `Allocation`: specify the maximum number of mints in a group (guard set)
- `AllowList`: uses a wallet address list to determine who is allowed to mint
- `BotTax`: configurable tax (amount) to charge invalid transactions
- `EndDate`: determines a date to end the mint
- `FreezeSolPayment`: set the price of the mint in SOL with a freeze period.
- `FreezeTokenPayment`: set the price of the mint in spl-token amount with a freeze period.
- `Gatekeeper`: captcha integration
- `MintLimit`: specified a limit on the number of mints per wallet
- `NftBurn`: restricts the mint to holders of a specified collection, requiring a burn of the NFT
- `NftGate`: restricts the mint to holders of a specified collection
- `NftPayment`: set the price of the mint as an NFT of a specified collection
- `ProgramGate`: restricts the programs that can be in a mint transaction
- `RedeemedAmount`: determines the end of the mint based on a total amount minted
- `SolPayment`: set the price of the mint in SOL
- `StartDate`: determines the start date of the mint
- `ThirdPartySigner`: requires an additional signer on the transaction
- `TokenBurn`: restricts the mint to holders of a specified spl-token, requiring a burn of the tokens
- `TokenGate`: restricts the mint to holders of a specified spl-token
- `TokenPayment`: set the price of the mint in spl-token amount

Along with those guads, amazing teams in the community are making guard programs with new and cool checks. Here are a few teams who have created guards:

- Civic: Civic Pass Guard ([Integration Docs](https://docs.civic.com/integrations/adding-civic-pass-protection-to-candy-machine-v3))

## Account

The Gumball Guard configuration is stored in a single account. The information regarding the guards that are enable is stored in a "hidden" section of the account to avoid unnecessary deserialization.

| Field             | Offset | Size | Description                                                                                                                 |
| ----------------- | ------ | ---- | --------------------------------------------------------------------------------------------------------------------------- |
| &mdash;           | 0      | 8    | Anchor account discriminator.                                                                                               |
| `base`            | 8      | 32   | `PubKey` to derive the PDA key. The seed is defined by `["gumball_guard", base pubkey]`.                                    |
| `bump`            | 40     | 1    | `u8` representing the bump of the derivation.                                                                               |
| `authority`       | 41     | 32   | `PubKey` of the authority address that controls the Gumball Guard.                                                          |
| _hidden section_  | 73     | ~    | Hidden data section to avoid unnecessary deserialization. This section of the account is used to serialize the guards data. |
| - _features_      | 73     | 8    | Feature flags indicating which guards are serialized.                                                                       |
| - _guard set_     | 81     | ~    | (optional) A sequence of serialized guard structs.                                                                          |
| - _group counter_ | ~      | 4    | `u32` specifying the number of groups in use.                                                                               |
| - _groups_        | ~      | ~    | (optional) A variable number of `Group` structs representing different guard sets. Each group is defined by:                |
| -- _label_        | ~      | 6    | The label of the group.                                                                                                     |
| -- _features_     | ~      | 8    | Feature flags indicating which guards are serialized for the group.                                                         |
| -- _guard set_    | ~      | ~    | (optional) A sequence of serialized guard structs.                                                                          |

Since the number of guards enabled and groups is variable, the account size is dynamically resized during the `update` instruction to accommodate the updated configuration.

## Instructions

### 📄 `initialize`

This instruction creates and initializes a new `GumballGuard` account.

<details>
  <summary>Accounts</summary>

| Name             | Writable | Signer | Description                                                                                             |
| ---------------- | :------: | :----: | ------------------------------------------------------------------------------------------------------- |
| `gumball_guard`  |    ✅    |        | The `GumballGuard` account PDA key. The PDA is derived using the seed `["gumball_guard", base pubkey]`. |
| `base`           |          |   ✅   | Base public key for the PDA derivation.                                                                 |
| `authority`      |          |        | Public key of the gumball guard authority.                                                              |
| `payer`          |          |   ✅   | Payer of the transaction.                                                                               |
| `system_program` |          |        | `SystemProgram` account.                                                                                |

</details>

<details>
  <summary>Arguments</summary>
  
| Argument                      | Offset | Size | Description               |
| ----------------------------- | ------ | ---- | ------------------------- |
| `data`                        | 0      | ~    | Serialized `GumballGuardData` object as `[u8]`. |

The instruction uses a [custom serialization](https://docs.rs/mpl-candy-guard/0.1.1/mpl_gumball_guard/state/gumball_guard/struct.GumballGuardData.html#method.save) in order to maintain backwards compatibility with previous versions of the `GumballGuardData` struct.

</details>

### 📄 `mint` (deprecated)

This instruction mints an NFT from a Gumball Machine "wrapped" by a Gumball Guard. Only when the transaction is succesfully validated, it is forwarded to the Gumball Machine.

<details>
  <summary>Accounts</summary>

| Name                          | Writable | Signer | Description                                                                                             |
| ----------------------------- | :------: | :----: | ------------------------------------------------------------------------------------------------------- |
| `gumball_guard`               |          |        | The `GumballGuard` account PDA key. The PDA is derived using the seed `["gumball_guard", base pubkey]`. |
| `candy_machine_program`       |          |        | `GumballMachine` program ID.                                                                            |
| `candy_machine`               |    ✅    |        | The `GumballMachine` account.                                                                           |
| `candy_machine_authority_pda` |    ✅    |        | Authority PDA key (seeds `["candy_machine", candy_machine pubkey]`).                                    |
| `payer`                       |    ✅    |   ✅   | Payer of the transaction.                                                                               |
| `nft_metadata`                |    ✅    |        | Metadata account of the NFT.                                                                            |
| `nft_mint`                    |    ✅    |        | Mint account for the NFT. The account should be created before executing the instruction.               |
| `nft_mint_authority`          |          |   ✅   | Mint authority of the NFT.                                                                              |
| `nft_master_edition`          |    ✅    |        | Master Edition account of the NFT.                                                                      |
| `collection_authority_record` |          |        | Authority Record PDA of the collection.                                                                 |
| `collection_mint`             |          |        | Mint account of the collection.                                                                         |
| `collection_metadata`         |    ✅    |        | Metadata account of the collection.                                                                     |
| `collection_master_edition`   |          |        | Master Edition account of the collection.                                                               |
| `collection_update_authority` |          |        | Update authority of the collection.                                                                     |
| `token_metadata_program`      |          |        | Metaplex `TokenMetadata` program ID.                                                                    |
| `token_program`               |          |        | `spl-token` program ID.                                                                                 |
| `system_program`              |          |        | `SystemProgram` account.                                                                                |
| `rent`                        |          |        | `Rent` account.                                                                                         |
| `recent_slothashes`           |          |        | `SlotHashes` account.                                                                                   |
| `instruction_sysvar_account`  |          |        | `Sysvar1nstructions` account.                                                                           |
| _remaining accounts_          |          |        | (optional) A list of optional accounts required by individual guards.                                   |

</details>

<details>
  <summary>Arguments</summary>
  
| Argument        | Offset | Size | Description               |
| --------------- | ------ | ---- | ------------------------- |
| `mint_args`     | 0      | ~    | `[u8]` representing arguments for guards; an empty `[u8]` if there are no arguments. |
| `label`         | ~      | 6    | (optional) `string` representing the group label to use for validation of guards. |
</details>

### 📄 `mint_v2`

This instruction mints both `NFT` or `pNFT` from a Gumball Machine "wrapped" by a Gumball Guard. Only when the transaction is succesfully validated, it is forwarded to the Gumball Machine.

<details>
  <summary>Accounts</summary>

| Name                          | Writable | Signer | Description                                                                                             |
| ----------------------------- | :------: | :----: | ------------------------------------------------------------------------------------------------------- |
| `gumball_guard`               |          |        | The `GumballGuard` account PDA key. The PDA is derived using the seed `["gumball_guard", base pubkey]`. |
| `candy_machine_program`       |          |        | `GumballMachine` program ID.                                                                            |
| `candy_machine`               |    ✅    |        | The `GumballMachine` account.                                                                           |
| `candy_machine_authority_pda` |    ✅    |        | Authority PDA key (seeds `["candy_machine", candy_machine pubkey]`).                                    |
| `payer`                       |    ✅    |   ✅   | Payer of the transaction.                                                                               |
| `minter`                      |    ✅    |   ✅   | Minter (owner) of the NFT.                                                                              |
| `nft_mint`                    |    ✅    |        | Mint account for the NFT. The account should be created before executing the instruction.               |
| `nft_mint_authority`          |          |   ✅   | Mint authority of the NFT.                                                                              |
| `nft_metadata`                |    ✅    |        | Metadata account of the NFT.                                                                            |
| `nft_master_edition`          |    ✅    |        | Master Edition account of the NFT.                                                                      |
| `token`                       |    ✅    |        | (optional) NFT token account.                                                                           |
| `token_record`                |    ✅    |        | (optional) Metadata `TokenRecord` account (required for `pNFT`)                                         |
| `collection_delegate_record`  |          |        | Metadata Delegate Record of the collection.                                                             |
| `collection_mint`             |          |        | Mint account of the collection.                                                                         |
| `collection_metadata`         |    ✅    |        | Metadata account of the collection.                                                                     |
| `collection_master_edition`   |          |        | Master Edition account of the collection.                                                               |
| `collection_update_authority` |          |        | Update authority of the collection.                                                                     |
| `token_metadata_program`      |          |        | Metaplex `TokenMetadata` program ID.                                                                    |
| `spl_token_program`           |          |        | `spl-token` program ID.                                                                                 |
| `spl_ata_program`             |          |        | (optional) `spl` associated token program.                                                              |
| `system_program`              |          |        | `SystemProgram` account.                                                                                |
| `sysvar_instructions`         |          |        | `sysvar::instructions` account.                                                                         |
| `recent_slothashes`           |          |        | SlotHashes sysvar cluster data.                                                                         |
| `authorization_rules_program` |          |        | (optional) Token Authorization Rules program.                                                           |
| `authorization_rules`         |          |        | (optional) Token Authorization Rules account.                                                           |
| _remaining accounts_          |          |        | (optional) A list of optional accounts required by individual guards.                                   |

</details>

<details>
  <summary>Arguments</summary>
  
| Argument        | Offset | Size | Description               |
| --------------- | ------ | ---- | ------------------------- |
| `mint_args`     | 0      | ~    | `[u8]` representing arguments for guards; an empty `[u8]` if there are no arguments. |
| `label`         | ~      | 6    | (optional) `string` representing the group label to use for validation of guards. |
</details>

### 📄 `route`

This instruction routes the transaction to a guard, allowing the execution of custom guard instructions. The transaction can include any additional accounts required by the guard instruction. The guard that will received the transaction and any additional parameters is specified in the `RouteArgs` struct.

<details>
  <summary>Accounts</summary>

| Name                 | Writable | Signer | Description                                                               |
| -------------------- | :------: | :----: | ------------------------------------------------------------------------- |
| `gumball_guard`      |          |        | The `GumballGuard` account PDA key.                                       |
| `candy_machine`      |    ✅    |        | The `GumballMachine` account.                                             |
| `payer`              |    ✅    |   ✅   | Payer of the transaction.                                                 |
| _remaining accounts_ |          |        | (optional) A list of optional accounts required by the guard instruction. |

</details>

<details>
  <summary>Arguments</summary>
  
| Argument     | Size | Description               |
| -------------| ---- | ------------------------- |
| `args`       |      | `RouteArgs` struct.       |
| - *guard*    | 1    | Value of enum `GuardType` |
| - *data*     | ~    | `[u8]` representing arguments for the instruction; an empty `[u8]` if there are no arguments. |
| `label`      | 6    | (optional) string representing the group label to use for retrieving the guards set. |
</details>

### 📄 `unwrap`

This instruction removes a Gumball Guard from a Gumball Machine, setting the mint authority of the Gumball Machine to be the Gumball Machine authority. The Gumball Gard `public key` must match the Gumball Machine `mint_authority` for this instruction to succeed.

<details>
  <summary>Accounts</summary>

| Name                      | Writable | Signer | Description                                  |
| ------------------------- | :------: | :----: | -------------------------------------------- |
| `gumball_guard`           |          |        | The `GumballGuard` account PDA key.          |
| `authority`               |          |   ✅   | Public key of the `gumball_guard` authority. |
| `candy_machine`           |    ✅    |        | The `GumballMachine` account.                |
| `candy_machine_authority` |          |   ✅   | Public key of the `candy_machine` authority. |
| `candy_machine_program`   |          |        | `GumballMachine` program ID.                 |

</details>

<details>
  <summary>Arguments</summary>
  
None.
</details>

### 📄 `update`

This instruction updates the Gumball Guard configuration. Given that there is a flexible number of guards and groups that can be present, this instruction will resize the account accordingly, either increasing or decreasing the account size. Therefore, there will be either a charge for rent or a withdraw of rent lamports.

<details>
  <summary>Accounts</summary>

| Name             | Writable | Signer | Description                                  |
| ---------------- | :------: | :----: | -------------------------------------------- |
| `gumball_guard`  |    ✅    |        | The `GumballGuard` account PDA key.          |
| `authority`      |          |        | Public key of the `gumball_guard` authority. |
| `payer`          |          |   ✅   | Payer of the transaction.                    |
| `system_program` |          |        | `SystemProgram` account.                     |

</details>

<details>
  <summary>Arguments</summary>
  
| Argument                      | Offset | Size | Description               |
| ----------------------------- | ------ | ---- | ------------------------- |
| `data`                        | 0      | ~    | Serialized `GumballGuardData` object as `[u8]`. |

The instruction uses a [custom serialization](https://docs.rs/mpl-candy-guard/0.1.1/mpl_gumball_guard/state/gumball_guard/struct.GumballGuardData.html#method.save) in order to maintain backwards compatibility with previous versions of the `GumballGuardData` struct.

</details>

### 📄 `withdraw`

This instruction withdraws the rent lamports from the account and closes it. After executing this instruction, the Gumball Guard account will not be operational.

<details>
  <summary>Accounts</summary>

| Name            | Writable | Signer | Description                                  |
| --------------- | :------: | :----: | -------------------------------------------- |
| `gumball_guard` |    ✅    |        | The `GumballGuard` account.                  |
| `authority`     |    ✅    |   ✅   | Public key of the `gumball_guard` authority. |

</details>

<details>
  <summary>Arguments</summary>
  
None.
</details>

### 📄 `wrap`

This instruction adds a Gumball Guard to a Gumball Machine. After the guard is added, minting is only allowed through the Gumball Guard.

<details>
  <summary>Accounts</summary>

| Name                      | Writable | Signer | Description                                  |
| ------------------------- | :------: | :----: | -------------------------------------------- |
| `gumball_guard`           |          |        | The `GumballGuard` account PDA key.          |
| `authority`               |          |   ✅   | Public key of the `gumball_guard` authority. |
| `candy_machine`           |    ✅    |        | The `GumballMachine` account.                |
| `candy_machine_authority` |          |   ✅   | Public key of the `candy_machine` authority. |
| `candy_machine_program`   |          |        | `GumballMachine` program ID.                 |

</details>

<details>
  <summary>Arguments</summary>
  
None.
</details>

## Guards

### `AddressGate`

```rust
pub struct AddressGate {
    address: Pubkey,
}
```

The `AddressGate` guard restricts the mint to a single `address` &mdash; the `address` must match the payer's address of the mint transaction.

### `Allocation`

```rust
pub struct Allocation {
    pub id: u8,
    pub size: u16,
}
```

The `Allocation` guard specifies the maximum number of mints allowed in a group (guard set). The `id` configuration represents the unique identification for the allocation &mdash; changing the `id` has the effect of restarting the limit, since a different tracking account will be created. The `size` indicates the maximum number of mints allocated.

<details>
  <summary>Accounts</summary>

| Name           | Writable | Signer | Description                                                                                                                       |
| -------------- | :------: | :----: | --------------------------------------------------------------------------------------------------------------------------------- |
| `mint_tracker` |    ✅    |        | Mint tracker PDA. The PDA is derived using the seed `["allocation", allocation id, gumball guard pubkey, gumball machine pubkey]` |

</details>

#### Route Instruction

The allocation PDA needs to be created before the first mint transaction is validated. This is done by a `route` instruction with the following accounts and `RouteArgs`:

<details>
  <summary>Accounts</summary>

| Name             | Writable | Signer | Description                                                                                                           |
| ---------------- | :------: | :----: | --------------------------------------------------------------------------------------------------------------------- |
| `proof_pda`      |    ✅    |        | PDA to represent the allocation (seed `["allocation", allocation id, gumball guard pubkey, gumball machine pubkey]`). |
| `authority`      |          |   ✅   | Gumball Guard authority                                                                                               |
| `system_program` |          |        | System program account.                                                                                               |

</details>
<details>
  <summary>Arguments</summary>
  
| Argument     | Size | Description               |
| -------------| ---- | ------------------------- |
| `args`       |      | `RouteArgs` struct        |
| - *guard*    | 1    | `GuardType.Allocation`    |
| - *data*     | 0    | Empty                     |
</details>

### `AllowList`

```rust
pub struct AllowList {
    pub merkle_root: [u8; 32],
}
```

The `AllowList` guard validates the payer's address against a merkle tree-based allow list of addresses. It required the root of the merkle tree as a configuration and the mint transaction must include the PDA of the merkle proof. The transaction will fail if no proof is specified.

<details>
  <summary>Accounts</summary>

| Name        | Writable | Signer | Description                                                                                                                  |
| ----------- | :------: | :----: | ---------------------------------------------------------------------------------------------------------------------------- |
| `proof_pda` |          |        | PDA of the merkle proof (seed `["allow_list", merkle tree root, minter key, gumball guard pubkey, gumball machine pubkey]`). |

</details>

#### Route Instruction

The merkle proof validation needs to be completed before the mint transaction. This is done by a `route` instruction with the following accounts and `RouteArgs`:

<details>
  <summary>Accounts</summary>

| Name             | Writable | Signer | Description                                                                                                                                  |
| ---------------- | :------: | :----: | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `proof_pda`      |    ✅    |        | PDA to represent the merkle proof (seed `["allow_list", merkle tree root, payer/minter key, gumball guard pubkey, gumball machine pubkey]`). |
| `system_program` |          |        | System program account.                                                                                                                      |
| `minter`         |          |        | (optional) Minter account to validate.                                                                                                       |

</details>
<details>
  <summary>Arguments</summary>
  
| Argument     | Size | Description               |
| -------------| ---- | ------------------------- |
| `args`       |      | `RouteArgs` struct         |
| - *guard*    | 1    | `GuardType.AllowList`    |
| - *data*     | ~    | `Vec` of the merkle proof hash values. |
</details>

### `BotTax`

```rust
pub struct BotTax {
    pub lamports: u64,
    pub last_instruction: bool,
}
```

The `BotTax` guard is used to:

- charge a penalty for invalid transactions. The value of the penalty is specified by the `lamports` configuration.
- validate that the mint transaction is the last transaction (`last_instruction = true`).

The `bot_tax` is applied to any error that occurs during the validation of the guards.

### `EndDate`

```rust
pub struct EndDate {
    pub date: i64,
}
```

The `EndDate` guard is used to specify a date to end the mint. Any transaction received after the end date will fail.

### `FreezeSolPayment`

```rust
pub struct FreezeSolPayment {
    pub lamports: u64,
    pub destination: Pubkey,
}
```

The `FreezeSolPayment` guard is used to charge an amount in SOL (lamports) for the mint with a freeze period. The funds are transferred a freeze escrow until all NFTs are thawed, which at this point, can be transferred (unlock) to the destination account.

**Note:** The freeze functionality must be initialized using the `initialize` route instruction before mint starts.

<details>
  <summary>Accounts</summary>

| Name         | Writable | Signer | Description                                                                                                                    |
| ------------ | :------: | :----: | ------------------------------------------------------------------------------------------------------------------------------ |
| `freeze_pda` |    ✅    |        | Freeze PDA to receive the funds (seeds `["freeze_escrow", destination pubkey, gumball guard pubkey, gumball machine pubkey]`). |
| `nft_ata`    |          |        | Associate token account of the NFT (seeds `[payer pubkey, token program pubkey, nft mint pubkey]`).                            |
| `rule_set`   |          |        | (optional) Authorization rule set for the minted pNFT.                                                                         |

</details>

#### Route Instructions

##### `initialize`: initializes the freeze escrow PDA.

<details>
  <summary>Accounts</summary>

| Name             | Writable | Signer | Description                                                                                                                    |
| ---------------- | :------: | :----: | ------------------------------------------------------------------------------------------------------------------------------ |
| `freeze_pda`     |    ✅    |        | Freeze PDA to receive the funds (seeds `["freeze_escrow", destination pubkey, gumball guard pubkey, gumball machine pubkey]`). |
| `authority`      |          |   ✅   | Gumball Guard authority.                                                                                                       |
| `system_program` |          |        | System program account.                                                                                                        |

</details>
<details>
  <summary>Arguments</summary>
  
| Argument     | Size | Description                                |
| -------------| ---- | ------------------------------------------ |
| `args`       |      | `RouteArgs` struct                         |
| - *guard*    | 1    | `GuardType.FreezeSolPayment`               |
| - *data*     | ~    |                                            |
| -- *ix*      | 1    | `FreezeInstruction.Initialize`             |
| -- *period*  | 8    | Freeze period in seconds (maximum 30 days) |
</details>

##### `thaw`: thaw an eligible NFT.

<details>
  <summary>Accounts</summary>

| Name                          | Writable | Signer | Description                                                                                                                    |
| ----------------------------- | :------: | :----: | ------------------------------------------------------------------------------------------------------------------------------ |
| `freeze_pda`                  |    ✅    |        | Freeze PDA to receive the funds (seeds `["freeze_escrow", destination pubkey, gumball guard pubkey, gumball machine pubkey]`). |
| `nft_mint`                    |          |        | Mint account for the NFT.                                                                                                      |
| `owner`                       |          |        | Address of the owner of the NFT.                                                                                               |
| `nft_ata`                     |    ✅    |        | Associate token account of the NFT (seeds `[owner pubkey, token program pubkey, nft mint pubkey]`).                            |
| `nft_master_edition`          |          |        | Master Edition account of the NFT.                                                                                             |
| `token_program`               |          |        | `spl-token` program ID.                                                                                                        |
| `token_metadata_program`      |          |        | Metaplex `TokenMetadata` program.                                                                                              |
|                               |          |        | _Below are accounts required for pNFTs:_                                                                                       |
| `nft_metadata`                |    ✅    |        | Metadata account of the NFT.                                                                                                   |
| `freeze_pda_ata`              |    ✅    |        | Freeze PDA associated token account of the NFT.                                                                                |
| `system_program`              |          |        | System program.                                                                                                                |
| `sysvar_instructions`         |          |        | Sysvar instructions account.                                                                                                   |
| `spl_ata_program`             |          |        | SPL Associated Token Account program.                                                                                          |
| `owner_token_record`          |    ✅    |        | Owner token record account.                                                                                                    |
| `freeze_pda_token_record`     |    ✅    |        | Freeze PDA token record account.                                                                                               |
| `authorization_rules_program` |          |        | (optional) Token Authorization Rules program.                                                                                  |
| `authorization_rules`         |          |        | (optional) Token Authorization Rules account.                                                                                  |

</details>
<details>
  <summary>Arguments</summary>
  
| Argument     | Size | Description                                |
| -------------| ---- | ------------------------------------------ |
| `args`       |      | `RouteArgs` struct                         |
| - *guard*    | 1    | `GuardType.FreezeSolPayment`             |
| - *data*     | 1    |                                            |
| -- *ix*      | 1    | `FreezeInstruction.Thaw`                   |
</details>

##### `unlock_funds`: unlocks frozen funds.

Unlock funds is only enabled after all frozen NFTs are thaw.

<details>
  <summary>Accounts</summary>

| Name             | Writable | Signer | Description                                                                                                                    |
| ---------------- | :------: | :----: | ------------------------------------------------------------------------------------------------------------------------------ |
| `freeze_pda`     |    ✅    |        | Freeze PDA to receive the funds (seeds `["freeze_escrow", destination pubkey, gumball guard pubkey, gumball machine pubkey]`). |
| `authority`      |          |   ✅   | Gumball Guard authority.                                                                                                       |
| `destination`    |    ✅    |        | Address to receive the funds (must match the `destination` address of the guard configuration).                                |
| `system_program` |          |        | `SystemProgram` account.                                                                                                       |

</details>
<details>
  <summary>Arguments</summary>
  
| Argument     | Size | Description                                |
| -------------| ---- | ------------------------------------------ |
| `args`       |      | `RouteArgs` struct                         |
| - *guard*    | 1    | `GuardType.FreezeSolPayment`             |
| - *data*     | 1    |                                            |
| -- *ix*      | 1    | `FreezeInstruction.UnlockFunds`            |
</details>

### `FreezeTokenPayment`

```rust
pub struct FreezeTokenPayment {
    pub amount: u64,
    pub mint: Pubkey,
    pub destination_ata: Pubkey,
}
```

The `FreezeTokenPayment` guard is used to charge an amount in a specified spl-token as payment for the mint with a freeze period. The funds are transferred a freeze escrow until all NFTs are thaw, which at this point, can be transferred (unlock) to the destination account.

**Note:** The freeze functionality must be initialized using the `initialize` route instruction before mint starts.

<details>
  <summary>Accounts</summary>

| Name            | Writable | Signer | Description                                                                                                                        |
| --------------- | :------: | :----: | ---------------------------------------------------------------------------------------------------------------------------------- |
| `freeze_pda`    |    ✅    |        | Freeze PDA to receive the funds (seeds `["freeze_escrow", destination_ata pubkey, gumball guard pubkey, gumball machine pubkey]`). |
| `nft_ata`       |          |        | Associate token account of the NFT (seeds `[payer pubkey, token program pubkey, nft mint pubkey]`).                                |
| `token_account` |    ✅    |        | Token account holding the required amount (seeds `[payer pubkey, token program pubkey, mint pubkey]`).                             |
| `freeze_ata`    |    ✅    |        | Associate token account of the Freeze PDA (seeds `[freeze PDA pubkey, token program pubkey, nft mint pubkey]`).                    |
| `rule_set`      |          |        | (optional) Authorization rule set for the minted pNFT.                                                                             |

</details>

#### Route Instructions

##### `initialize`: initializes the freeze escrow PDA.

<details>
  <summary>Accounts</summary>

| Name                      | Writable | Signer | Description                                                                                                                        |
| ------------------------- | :------: | :----: | ---------------------------------------------------------------------------------------------------------------------------------- |
| `freeze_pda`              |    ✅    |        | Freeze PDA to receive the funds (seeds `["freeze_escrow", destination_ata pubkey, gumball guard pubkey, gumball machine pubkey]`). |
| `authority`               |          |   ✅   | Gumball Guard authority.                                                                                                           |
| `system_program`          |          |        | System program account.                                                                                                            |
| `freeze_ata`              |    ✅    |        | Associate token account of the Freeze PDA (seeds `[freeze PDA pubkey, token program pubkey, nft mint pubkey]`).                    |
| `token_mint`              |          |        | Token mint account (must match the `mint` address of the guard configuration).                                                     |
| `token_program`           |          |        | `spl-token` program ID.                                                                                                            |
| `associate_token_program` |          |        | Associate token program account.                                                                                                   |
| `destination_ata`         |    ✅    |        | Address to receive the funds (must match the `destination_ata` address of the guard configuration).                                |

</details>
<details>
  <summary>Arguments</summary>
  
| Argument     | Size | Description                                |
| -------------| ---- | ------------------------------------------ |
| `args`       |      | `RouteArgs` struct                         |
| - *guard*    | 1    | `GuardType.FreezeTokenPayment`             |
| - *data*     | 9    |                                            |
| -- *ix*      | 1    | `FreezeInstruction.Initialize`             |
| -- *period*  | 8    | Freeze period in seconds (maximum 30 days) |
</details>

##### `thaw`: thaw an eligible NFT.

<details>
  <summary>Accounts</summary>

| Name                          | Writable | Signer | Description                                                                                                                        |
| ----------------------------- | :------: | :----: | ---------------------------------------------------------------------------------------------------------------------------------- |
| `freeze_pda`                  |    ✅    |        | Freeze PDA to receive the funds (seeds `["freeze_escrow", destination_ata pubkey, gumball guard pubkey, gumball machine pubkey]`). |
| `nft_mint`                    |          |        | Mint account for the NFT.                                                                                                          |
| `owner`                       |          |        | Address of the owner of the NFT.                                                                                                   |
| `nft_ata`                     |    ✅    |        | Associate token account of the NFT (seeds `[owner pubkey, token program pubkey, nft mint pubkey]`).                                |
| `nft_master_edition`          |          |        | Master Edition account of the NFT.                                                                                                 |
| `token_program`               |          |        | `spl-token` program ID.                                                                                                            |
| `system_program`              |          |        | `SystemProgram` account.                                                                                                           |
|                               |          |        | _Below are accounts required for pNFTs:_                                                                                           |
| `nft_metadata`                |    ✅    |        | Metadata account of the NFT.                                                                                                       |
| `freeze_pda_ata`              |    ✅    |        | Freeze PDA associated token account of the NFT.                                                                                    |
| `system_program`              |          |        | System program.                                                                                                                    |
| `sysvar_instructions`         |          |        | Sysvar instructions account.                                                                                                       |
| `spl_ata_program`             |          |        | SPL Associated Token Account program.                                                                                              |
| `owner_token_record`          |    ✅    |        | Owner token record account.                                                                                                        |
| `freeze_pda_token_record`     |    ✅    |        | Freeze PDA token record account.                                                                                                   |
| `authorization_rules_program` |          |        | (optional) Token Authorization Rules program.                                                                                      |
| `authorization_rules`         |          |        | (optional) Token Authorization Rules account.                                                                                      |

</details>
<details>
  <summary>Arguments</summary>
  
| Argument     | Size | Description                                |
| -------------| ---- | ------------------------------------------ |
| `args`       |      | `RouteArgs` struct                         |
| - *guard*    | 1    | `GuardType.FreezeTokenPayment`             |
| - *data*     | 1    |                                            |
| -- *ix*      | 1    | `FreezeInstruction.Thaw`                   |
</details>

##### `unlock_funds`: unlocks frozen funds.

Unlock funds is only enabled after all frozen NFTs are thaw.

<details>
  <summary>Accounts</summary>

| Name              | Writable | Signer | Description                                                                                                                        |
| ----------------- | :------: | :----: | ---------------------------------------------------------------------------------------------------------------------------------- |
| `freeze_pda`      |    ✅    |        | Freeze PDA to receive the funds (seeds `["freeze_escrow", destination_ata pubkey, gumball guard pubkey, gumball machine pubkey]`). |
| `authority`       |          |   ✅   | Gumball Guard authority.                                                                                                           |
| `freeze_ata`      |    ✅    |        | Associate token account of the Freeze PDA (seeds `[freeze PDA pubkey, token program pubkey, nft mint pubkey]`).                    |
| `destination_ata` |    ✅    |        | Address to receive the funds (must match the `destination_ata` address of the guard configuration).                                |
| `token_program`   |          |        | `spl-token` program ID.                                                                                                            |
| `system_program`  |          |        | `SystemProgram` account.                                                                                                           |

</details>
<details>
  <summary>Arguments</summary>
  
| Argument     | Size | Description                                |
| -------------| ---- | ------------------------------------------ |
| `args`       |      | `RouteArgs` struct                         |
| - *guard*    | 1    | `GuardType.FreezeTokenPayment`             |
| - *data*     | 1    |                                            |
| -- *ix*      | 1    | `FreezeInstruction.UnlockFunds`            |
</details>

### `Gatekeeper`

```rust
pub struct Gatekeeper {
    pub gatekeeper_network: Pubkey,
    pub expire_on_use: bool,
}
```

The `Gatekeeper` guard validates if the payer of the transaction has a _token_ from a specified gateway network &mdash; in most cases, a _token_ after completing a captcha challenge. The `expire_on_use` configuration is used to indicate whether or not the token should expire after minting.

<details>
  <summary>Accounts</summary>

| Name                       | Writable | Signer | Description                 |
| -------------------------- | :------: | :----: | --------------------------- |
| `gatekeeper_token_account` |    ✅    |        | Gatekeeper token account.   |
| `gatekeeper_program`       |          |        | Gatekeeper program account. |
| `network_expire_feature`   |          |        | Gatekeeper expire account.  |

</details>

### `MintLimit`

```rust
pub struct MintLimit {
    pub id: u8,
    pub limit: u16,
}
```

The `MintLimit` guard allows to specify a limit on the number of mints for each individual address. The `id` configuration represents the unique identification for the limit &mdash; changing the `id` has the effect of restarting the limit, since a different tracking account will be created. The `limit` indicated the maximum number of mints allowed.

<details>
  <summary>Accounts</summary>

| Name         | Writable | Signer | Description                                                                                                                                  |
| ------------ | :------: | :----: | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `mint_count` |    ✅    |        | Mint counter PDA. The PDA is derived using the seed `["mint_limit", mint guard id, payer key, gumball guard pubkey, gumball machine pubkey]` |

</details>

### `NftBurn`

```rust
pub struct NftBurn {
    pub required_collection: Pubkey,
}
```

The `NftBurn` guard restricts the mint to holders of another NFT (token), requiring that the NFT is burn in exchange of being allowed to mint.

<details>
  <summary>Accounts</summary>

| Name                           | Writable | Signer | Description                                |
| ------------------------------ | :------: | :----: | ------------------------------------------ |
| `nft_account`                  |    ✅    |        | Token account of the NFT.                  |
| `nft_metadata`                 |    ✅    |        | Metadata account of the NFT.               |
| `nft_edition`                  |    ✅    |        | Master Edition account of the NFT.         |
| `nft_mint_account`             |    ✅    |        | Mint account of the NFT.                   |
| `nft_mint_collection_metadata` |    ✅    |        | Collection metadata account of the NFT.    |
| `nft_token_record`             |    ✅    |        | (optional) Token Record of the NFT (pNFT). |

</details>

### `NftGate`

```rust
pub struct NftGate {
    pub required_collection: Pubkey,
}
```

The `NftGate` guard restricts the mint to holders of a specified `required_collection` NFT collection. The payer is required to hold at least one NFT of the collection.

<details>
  <summary>Accounts</summary>

| Name           | Writable | Signer | Description                  |
| -------------- | :------: | :----: | ---------------------------- |
| `nft_account`  |          |        | Token account of the NFT.    |
| `nft_metadata` |          |        | Metadata account of the NFT. |

</details>

### `NftPayment`

```rust
pub struct NftPayment {
    pub required_collection: Pubkey,
    pub destination: Pubkey,
}
```

The `NftPayment` guard is a payment guard that charges another NFT (token) from a specific collection for the mint. As a requirement of the mint, the specified NFT is transferred to the `destination` address.

<details>
  <summary>Accounts</summary>

| Name                          | Writable | Signer | Description                                                                            |
| ----------------------------- | :------: | :----: | -------------------------------------------------------------------------------------- |
| `nft_account`                 |    ✅    |        | Token account of the NFT.                                                              |
| `nft_metadata`                |    ✅    |        | Metadata account of the NFT.                                                           |
| `nft_mint_account`            |          |        | Mint account of the NFT.                                                               |
| `destination`                 |          |        | Account to receive the NFT.                                                            |
| `destination_ata`             |    ✅    |        | Destination PDA key (seeds `[destination pubkey, token program id, nft_mint pubkey]`). |
| `atoken_progam`               |          |        | `spl-associate-token` program.                                                         |
| `owner_token_record`          |    ✅    |        | (optional) Owner token record account (pNFT).                                          |
| `destination_token_record`    |    ✅    |        | (optional) Freeze PDA token record account (pNFT).                                     |
| `authorization_rules_program` |          |        | (optional) Token Authorization Rules program (pNFT).                                   |
| `authorization_rules`         |          |        | (optional) Token Authorization Rules account (pNFT).                                   |

</details>

### `ProgramGate`

```rust
pub struct ProgramGate {
    pub additional: Vec<Pubkey>,
}
```

The `ProgramGate` guard restricts the programs that can be in a mint transaction. The guard allows the necessary programs for the mint and any other program specified in the configuration.

### `RedeemedAmount`

```rust
pub struct RedeemedAmount {
    pub maximum: u64,
}
```

The `RedeemedAmount` guard stops the mint when the number of `items_redeemed` of the Gumball Machine reaches the configured `maximum` amount.

### `SolPayment`

```rust
pub struct SolPayment {
    pub lamports: u64,
    pub destination: Pubkey,
}
```

The `SolPayment` guard is used to charge an amount in SOL (lamports) for the mint. The funds are transferred to the configured `destination` address.

<details>
  <summary>Accounts</summary>

| Name          | Writable | Signer | Description                   |
| ------------- | :------: | :----: | ----------------------------- |
| `destination` |    ✅    |        | Address to receive the funds. |

</details>

### `StartDate`

```rust
pub struct StartDate {
    pub date: i64,
}
```

The `StartDate` guard determines the start date of the mint. If this guard is not specified, mint is allowed &mdash; similar to say any date is valid.

### `ThirdPartySigner`

```rust
pub struct ThirdPartySigner {
    pub signer_key: Pubkey,
}
```

The `ThirdPartySigner` guard required an extra signer on the transaction.

<details>
  <summary>Accounts</summary>

| Name         | Writable | Signer | Description                |
| ------------ | :------: | :----: | -------------------------- |
| `signer_key` |          |   ✅   | Signer of the transaction. |

</details>

### `TokenBurn`

```rust
pub struct TokenBurn {
    pub amount: u64,
    pub mint: Pubkey,
}
```

The `TokenBurn` restrict the mint to holder of a specified spl-token and required the burn of the tokens. The `amount` determines how many tokens are required.

<details>
  <summary>Accounts</summary>

| Name            | Writable | Signer | Description                                |
| --------------- | :------: | :----: | ------------------------------------------ |
| `token_account` |    ✅    |        | Token account holding the required amount. |
| `token_mint`    |    ✅    |        | Token mint account.                        |

</details>

### `TokenGate`

```rust
pub struct TokenGate {
    pub amount: u64,
    pub mint: Pubkey,
}
```

The `TokenGate` restrict the mint to holder of a specified spl-token. The `amount` determines how many tokens are required.

<details>
  <summary>Accounts</summary>

| Name            | Writable | Signer | Description                               |
| --------------- | :------: | :----: | ----------------------------------------- |
| `token_account` |          |        | oken account holding the required amount. |

</details>

### `TokenPayment`

```rust
pub struct TokenPayment {
    pub amount: u64,
    pub token_mint: Pubkey,
    pub destination_ata: Pubkey,
}
```

The `TokenPayment` restrict the mint to holder of a specified spl-token, transferring the required amount to the `destination_ata` address. The `amount` determines how many tokens are required.

<details>
  <summary>Accounts</summary>

| Name              | Writable | Signer | Description                                |
| ----------------- | :------: | :----: | ------------------------------------------ |
| `token_account`   |    ✅    |        | Token account holding the required amount. |
| `destination_ata` |    ✅    |        | Address of the ATA to receive the tokens.  |

</details>
