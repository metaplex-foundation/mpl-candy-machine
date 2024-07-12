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
  array,
  mapSerializer,
  publicKey as publicKeySerializer,
  Serializer,
  struct,
  u8,
} from '@metaplex-foundation/umi/serializers';
import {
  getAccountMetasAndSigners,
  ResolvedAccount,
  ResolvedAccountsWithIndices,
} from '../shared';

// Accounts.
export type SetCandyMachineAuthorityInstructionAccounts = {
  /** Candy Machine account. */
  candyMachine: PublicKey | Pda;
  /** Autority of the candy machine. */
  authority?: Signer;
};

// Data.
export type SetCandyMachineAuthorityInstructionData = {
  discriminator: Array<number>;
  newAuthority: PublicKey;
};

export type SetCandyMachineAuthorityInstructionDataArgs = {
  newAuthority: PublicKey;
};

export function getSetCandyMachineAuthorityInstructionDataSerializer(): Serializer<
  SetCandyMachineAuthorityInstructionDataArgs,
  SetCandyMachineAuthorityInstructionData
> {
  return mapSerializer<
    SetCandyMachineAuthorityInstructionDataArgs,
    any,
    SetCandyMachineAuthorityInstructionData
  >(
    struct<SetCandyMachineAuthorityInstructionData>(
      [
        ['discriminator', array(u8(), { size: 8 })],
        ['newAuthority', publicKeySerializer()],
      ],
      { description: 'SetCandyMachineAuthorityInstructionData' }
    ),
    (value) => ({
      ...value,
      discriminator: [133, 250, 37, 21, 110, 163, 26, 121],
    })
  ) as Serializer<
    SetCandyMachineAuthorityInstructionDataArgs,
    SetCandyMachineAuthorityInstructionData
  >;
}

// Args.
export type SetCandyMachineAuthorityInstructionArgs =
  SetCandyMachineAuthorityInstructionDataArgs;

// Instruction.
export function setCandyMachineAuthority(
  context: Pick<Context, 'identity' | 'programs'>,
  input: SetCandyMachineAuthorityInstructionAccounts &
    SetCandyMachineAuthorityInstructionArgs
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
    authority: { index: 1, isWritable: false, value: input.authority ?? null },
  };

  // Arguments.
  const resolvedArgs: SetCandyMachineAuthorityInstructionArgs = { ...input };

  // Default values.
  if (!resolvedAccounts.authority.value) {
    resolvedAccounts.authority.value = context.identity;
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
  const data = getSetCandyMachineAuthorityInstructionDataSerializer().serialize(
    resolvedArgs as SetCandyMachineAuthorityInstructionDataArgs
  );

  // Bytes Created On Chain.
  const bytesCreatedOnChain = 0;

  return transactionBuilder([
    { instruction: { keys, programId, data }, signers, bytesCreatedOnChain },
  ]);
}
