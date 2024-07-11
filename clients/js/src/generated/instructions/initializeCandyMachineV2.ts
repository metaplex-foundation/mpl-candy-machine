/**
 * This code was AUTOGENERATED using the kinobi library.
 * Please DO NOT EDIT THIS FILE, instead use visitors
 * to add features, then rerun kinobi to update it.
 *
 * @see https://github.com/metaplex-foundation/kinobi
 */

import {
  Context,
  Pda,
  PublicKey,
  Signer,
  TransactionBuilder,
  transactionBuilder,
} from '@metaplex-foundation/umi';
import {
  Serializer,
  array,
  mapSerializer,
  struct,
  u64,
  u8,
} from '@metaplex-foundation/umi/serializers';
import { findCandyMachineAuthorityPda } from '../../hooked';
import {
  ResolvedAccount,
  ResolvedAccountsWithIndices,
  expectPublicKey,
  getAccountMetasAndSigners,
} from '../shared';

// Accounts.
export type InitializeCandyMachineV2InstructionAccounts = {
  /**
   * Candy Machine account. The account space must be allocated to allow accounts larger
   * than 10kb.
   *
   */

  candyMachine: PublicKey | Pda;
  /**
   * Authority PDA used to verify minted NFTs to the collection.
   *
   */

  authorityPda?: PublicKey | Pda;
  /**
   * Candy Machine authority. This is the address that controls the upate of the candy machine.
   *
   */

  authority?: PublicKey | Pda;
  /** Payer of the transaction. */
  payer?: Signer;
};

// Data.
export type InitializeCandyMachineV2InstructionData = {
  discriminator: Array<number>;
  itemCount: bigint;
};

export type InitializeCandyMachineV2InstructionDataArgs = {
  itemCount: number | bigint;
};

export function getInitializeCandyMachineV2InstructionDataSerializer(): Serializer<
  InitializeCandyMachineV2InstructionDataArgs,
  InitializeCandyMachineV2InstructionData
> {
  return mapSerializer<
    InitializeCandyMachineV2InstructionDataArgs,
    any,
    InitializeCandyMachineV2InstructionData
  >(
    struct<InitializeCandyMachineV2InstructionData>(
      [
        ['discriminator', array(u8(), { size: 8 })],
        ['itemCount', u64()],
      ],
      { description: 'InitializeCandyMachineV2InstructionData' }
    ),
    (value) => ({
      ...value,
      discriminator: [67, 153, 175, 39, 218, 16, 38, 32],
    })
  ) as Serializer<
    InitializeCandyMachineV2InstructionDataArgs,
    InitializeCandyMachineV2InstructionData
  >;
}

// Args.
export type InitializeCandyMachineV2InstructionArgs =
  InitializeCandyMachineV2InstructionDataArgs;

// Instruction.
export function initializeCandyMachineV2(
  context: Pick<Context, 'eddsa' | 'identity' | 'payer' | 'programs'>,
  input: InitializeCandyMachineV2InstructionAccounts &
    InitializeCandyMachineV2InstructionArgs
): TransactionBuilder {
  // Program ID.
  const programId = context.programs.getPublicKey(
    'mplCandyMachineCore',
    'CndyV3LdqHUfDLmE5naZjVN8rBZz4tqhdefbAnjHG3JR'
  );

  // Accounts.
  const resolvedAccounts: ResolvedAccountsWithIndices = {
    candyMachine: {
      index: 0,
      isWritable: true,
      value: input.candyMachine ?? null,
    },
    authorityPda: {
      index: 1,
      isWritable: true,
      value: input.authorityPda ?? null,
    },
    authority: { index: 2, isWritable: false, value: input.authority ?? null },
    payer: { index: 3, isWritable: true, value: input.payer ?? null },
  };

  // Arguments.
  const resolvedArgs: InitializeCandyMachineV2InstructionArgs = { ...input };

  // Default values.
  if (!resolvedAccounts.authorityPda.value) {
    resolvedAccounts.authorityPda.value = findCandyMachineAuthorityPda(
      context,
      { candyMachine: expectPublicKey(resolvedAccounts.candyMachine.value) }
    );
  }
  if (!resolvedAccounts.authority.value) {
    resolvedAccounts.authority.value = context.identity.publicKey;
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
  const data = getInitializeCandyMachineV2InstructionDataSerializer().serialize(
    resolvedArgs as InitializeCandyMachineV2InstructionDataArgs
  );

  // Bytes Created On Chain.
  const bytesCreatedOnChain = 0;

  return transactionBuilder([
    { instruction: { keys, programId, data }, signers, bytesCreatedOnChain },
  ]);
}
