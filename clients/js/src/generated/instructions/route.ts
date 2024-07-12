/**
 * This code was AUTOGENERATED using the kinobi library.
 * Please DO NOT EDIT THIS FILE, instead use visitors
 * to add features, then rerun kinobi to update it.
 *
 * @see https://github.com/metaplex-foundation/kinobi
 */

import {
  Context,
  Option,
  OptionOrNullable,
  Pda,
  PublicKey,
  Signer,
  TransactionBuilder,
  transactionBuilder,
} from '@metaplex-foundation/umi';
import {
  array,
  bytes,
  mapSerializer,
  option,
  Serializer,
  string,
  struct,
  u32,
  u8,
} from '@metaplex-foundation/umi/serializers';
import { findCandyGuardPda } from '../../hooked';
import {
  expectPublicKey,
  getAccountMetasAndSigners,
  ResolvedAccount,
  ResolvedAccountsWithIndices,
} from '../shared';
import { getGuardTypeSerializer, GuardType, GuardTypeArgs } from '../types';

// Accounts.
export type RouteInstructionAccounts = {
  candyGuard?: PublicKey | Pda;
  candyMachine: PublicKey | Pda;
  payer?: Signer;
};

// Data.
export type RouteInstructionData = {
  discriminator: Array<number>;
  /** The target guard type. */
  guard: GuardType;
  /** Arguments for the guard instruction. */
  data: Uint8Array;
  group: Option<string>;
};

export type RouteInstructionDataArgs = {
  /** The target guard type. */
  guard: GuardTypeArgs;
  /** Arguments for the guard instruction. */
  data: Uint8Array;
  group: OptionOrNullable<string>;
};

export function getRouteInstructionDataSerializer(): Serializer<
  RouteInstructionDataArgs,
  RouteInstructionData
> {
  return mapSerializer<RouteInstructionDataArgs, any, RouteInstructionData>(
    struct<RouteInstructionData>(
      [
        ['discriminator', array(u8(), { size: 8 })],
        ['guard', getGuardTypeSerializer()],
        ['data', bytes({ size: u32() })],
        ['group', option(string())],
      ],
      { description: 'RouteInstructionData' }
    ),
    (value) => ({
      ...value,
      discriminator: [229, 23, 203, 151, 122, 227, 173, 42],
    })
  ) as Serializer<RouteInstructionDataArgs, RouteInstructionData>;
}

// Args.
export type RouteInstructionArgs = RouteInstructionDataArgs;

// Instruction.
export function route(
  context: Pick<Context, 'eddsa' | 'payer' | 'programs'>,
  input: RouteInstructionAccounts & RouteInstructionArgs
): TransactionBuilder {
  // Program ID.
  const programId = context.programs.getPublicKey(
    'mplCandyGuard',
    'Guard1JwRhJkVH6XZhzoYxeBVQe872VH6QggF4BWmS9g'
  );

  // Accounts.
  const resolvedAccounts: ResolvedAccountsWithIndices = {
    candyGuard: {
      index: 0,
      isWritable: false,
      value: input.candyGuard ?? null,
    },
    candyMachine: {
      index: 1,
      isWritable: true,
      value: input.candyMachine ?? null,
    },
    payer: { index: 2, isWritable: true, value: input.payer ?? null },
  };

  // Arguments.
  const resolvedArgs: RouteInstructionArgs = { ...input };

  // Default values.
  if (!resolvedAccounts.candyGuard.value) {
    resolvedAccounts.candyGuard.value = findCandyGuardPda(context, {
      base: expectPublicKey(resolvedAccounts.candyMachine.value),
    });
  }
  if (!resolvedAccounts.payer.value) {
    resolvedAccounts.payer.value = context.payer;
  }

  // Accounts in order.
  const orderedAccounts: ResolvedAccount[] = Object.values(
    resolvedAccounts
  ).sort((a, b) => a.index - b.index);

  // Keys and Signers.
  const [keys, signers] = getAccountMetasAndSigners(
    orderedAccounts,
    'programId',
    programId
  );

  // Data.
  const data = getRouteInstructionDataSerializer().serialize(
    resolvedArgs as RouteInstructionDataArgs
  );

  // Bytes Created On Chain.
  const bytesCreatedOnChain = 0;

  return transactionBuilder([
    { instruction: { keys, programId, data }, signers, bytesCreatedOnChain },
  ]);
}
