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
  Serializer,
  struct,
  u8,
} from '@metaplex-foundation/umi/serializers';
import {
  getAccountMetasAndSigners,
  ResolvedAccount,
  ResolvedAccountsWithIndices,
} from '../shared';
import {
  getGumballSettingsSerializer,
  GumballSettings,
  GumballSettingsArgs,
} from '../types';

// Accounts.
export type UpdateSettingsInstructionAccounts = {
  /** Candy machine account. */
  candyMachine: PublicKey | Pda;
  /** Candy Machine authority. This is the address that controls the upate of the candy machine. */
  authority?: Signer;
};

// Data.
export type UpdateSettingsInstructionData = {
  discriminator: Array<number>;
  settings: GumballSettings;
};

export type UpdateSettingsInstructionDataArgs = {
  settings: GumballSettingsArgs;
};

export function getUpdateSettingsInstructionDataSerializer(): Serializer<
  UpdateSettingsInstructionDataArgs,
  UpdateSettingsInstructionData
> {
  return mapSerializer<
    UpdateSettingsInstructionDataArgs,
    any,
    UpdateSettingsInstructionData
  >(
    struct<UpdateSettingsInstructionData>(
      [
        ['discriminator', array(u8(), { size: 8 })],
        ['settings', getGumballSettingsSerializer()],
      ],
      { description: 'UpdateSettingsInstructionData' }
    ),
    (value) => ({
      ...value,
      discriminator: [81, 166, 51, 213, 158, 84, 157, 108],
    })
  ) as Serializer<
    UpdateSettingsInstructionDataArgs,
    UpdateSettingsInstructionData
  >;
}

// Args.
export type UpdateSettingsInstructionArgs = UpdateSettingsInstructionDataArgs;

// Instruction.
export function updateSettings(
  context: Pick<Context, 'identity' | 'programs'>,
  input: UpdateSettingsInstructionAccounts & UpdateSettingsInstructionArgs
): TransactionBuilder {
  // Program ID.
  const programId = context.programs.getPublicKey(
    'mplCandyMachine',
    'MGUMqztv7MHgoHBYWbvMyL3E3NJ4UHfTwgLJUQAbKGa'
  );

  // Accounts.
  const resolvedAccounts: ResolvedAccountsWithIndices = {
    candyMachine: {
      index: 0,
      isWritable: true,
      value: input.candyMachine ?? null,
    },
    authority: { index: 1, isWritable: true, value: input.authority ?? null },
  };

  // Arguments.
  const resolvedArgs: UpdateSettingsInstructionArgs = { ...input };

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
  const data = getUpdateSettingsInstructionDataSerializer().serialize(
    resolvedArgs as UpdateSettingsInstructionDataArgs
  );

  // Bytes Created On Chain.
  const bytesCreatedOnChain = 0;

  return transactionBuilder([
    { instruction: { keys, programId, data }, signers, bytesCreatedOnChain },
  ]);
}
