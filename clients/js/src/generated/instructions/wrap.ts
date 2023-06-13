/**
 * This code was AUTOGENERATED using the kinobi library.
 * Please DO NOT EDIT THIS FILE, instead use visitors
 * to add features, then rerun kinobi to update it.
 *
 * @see https://github.com/metaplex-foundation/kinobi
 */

import {
  AccountMeta,
  Context,
  Pda,
  PublicKey,
  Serializer,
  Signer,
  TransactionBuilder,
  mapSerializer,
  transactionBuilder,
} from '@metaplex-foundation/umi';
import { addAccountMeta, addObjectProperty } from '../shared';

// Accounts.
export type WrapInstructionAccounts = {
  candyGuard: PublicKey | Pda;
  authority?: Signer;
  candyMachine: PublicKey | Pda;
  candyMachineProgram?: PublicKey | Pda;
  candyMachineAuthority?: Signer;
};

// Data.
export type WrapInstructionData = { discriminator: Array<number> };

export type WrapInstructionDataArgs = {};

export function getWrapInstructionDataSerializer(
  context: Pick<Context, 'serializer'>
): Serializer<WrapInstructionDataArgs, WrapInstructionData> {
  const s = context.serializer;
  return mapSerializer<WrapInstructionDataArgs, any, WrapInstructionData>(
    s.struct<WrapInstructionData>(
      [['discriminator', s.array(s.u8(), { size: 8 })]],
      { description: 'WrapInstructionData' }
    ),
    (value) => ({
      ...value,
      discriminator: [178, 40, 10, 189, 228, 129, 186, 140],
    })
  ) as Serializer<WrapInstructionDataArgs, WrapInstructionData>;
}

// Instruction.
export function wrap(
  context: Pick<Context, 'serializer' | 'programs' | 'identity'>,
  input: WrapInstructionAccounts
): TransactionBuilder {
  const signers: Signer[] = [];
  const keys: AccountMeta[] = [];

  // Program ID.
  const programId = context.programs.getPublicKey(
    'mplCandyGuard',
    'Guard1JwRhJkVH6XZhzoYxeBVQe872VH6QggF4BWmS9g'
  );

  // Resolved inputs.
  const resolvedAccounts = {
    candyGuard: [input.candyGuard, false] as const,
    candyMachine: [input.candyMachine, true] as const,
  };
  addObjectProperty(
    resolvedAccounts,
    'authority',
    input.authority
      ? ([input.authority, false] as const)
      : ([context.identity, false] as const)
  );
  addObjectProperty(
    resolvedAccounts,
    'candyMachineProgram',
    input.candyMachineProgram
      ? ([input.candyMachineProgram, false] as const)
      : ([
          context.programs.getPublicKey(
            'mplCandyMachine',
            'CndyV3LdqHUfDLmE5naZjVN8rBZz4tqhdefbAnjHG3JR'
          ),
          false,
        ] as const)
  );
  addObjectProperty(
    resolvedAccounts,
    'candyMachineAuthority',
    input.candyMachineAuthority
      ? ([input.candyMachineAuthority, false] as const)
      : ([context.identity, false] as const)
  );

  addAccountMeta(keys, signers, resolvedAccounts.candyGuard, false);
  addAccountMeta(keys, signers, resolvedAccounts.authority, false);
  addAccountMeta(keys, signers, resolvedAccounts.candyMachine, false);
  addAccountMeta(keys, signers, resolvedAccounts.candyMachineProgram, false);
  addAccountMeta(keys, signers, resolvedAccounts.candyMachineAuthority, false);

  // Data.
  const data = getWrapInstructionDataSerializer(context).serialize({});

  // Bytes Created On Chain.
  const bytesCreatedOnChain = 0;

  return transactionBuilder([
    { instruction: { keys, programId, data }, signers, bytesCreatedOnChain },
  ]);
}
