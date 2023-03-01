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
  PublicKey,
  Serializer,
  Signer,
  WrappedInstruction,
  checkForIsWritableOverride as isWritable,
  mapSerializer,
} from '@metaplex-foundation/umi';
import { ConfigLine, ConfigLineArgs, getConfigLineSerializer } from '../types';

// Accounts.
export type AddConfigLinesInstructionAccounts = {
  candyMachine: PublicKey;
  authority?: Signer;
};

// Arguments.
export type AddConfigLinesInstructionData = {
  discriminator: Array<number>;
  index: number;
  configLines: Array<ConfigLine>;
};

export type AddConfigLinesInstructionDataArgs = {
  index: number;
  configLines: Array<ConfigLineArgs>;
};

export function getAddConfigLinesInstructionDataSerializer(
  context: Pick<Context, 'serializer'>
): Serializer<
  AddConfigLinesInstructionDataArgs,
  AddConfigLinesInstructionData
> {
  const s = context.serializer;
  return mapSerializer<
    AddConfigLinesInstructionDataArgs,
    AddConfigLinesInstructionData,
    AddConfigLinesInstructionData
  >(
    s.struct<AddConfigLinesInstructionData>(
      [
        ['discriminator', s.array(s.u8(), { size: 8 })],
        ['index', s.u32()],
        ['configLines', s.array(getConfigLineSerializer(context))],
      ],
      { description: 'AddConfigLinesInstructionData' }
    ),
    (value) =>
      ({
        ...value,
        discriminator: [223, 50, 224, 227, 151, 8, 115, 106],
      } as AddConfigLinesInstructionData)
  ) as Serializer<
    AddConfigLinesInstructionDataArgs,
    AddConfigLinesInstructionData
  >;
}

// Instruction.
export function addConfigLines(
  context: Pick<Context, 'serializer' | 'programs' | 'identity'>,
  input: AddConfigLinesInstructionAccounts & AddConfigLinesInstructionDataArgs
): WrappedInstruction {
  const signers: Signer[] = [];
  const keys: AccountMeta[] = [];

  // Program ID.
  const programId: PublicKey = context.programs.get(
    'mplCandyMachineCore'
  ).publicKey;

  // Resolved accounts.
  const candyMachineAccount = input.candyMachine;
  const authorityAccount = input.authority ?? context.identity;

  // Candy Machine.
  keys.push({
    pubkey: candyMachineAccount,
    isSigner: false,
    isWritable: isWritable(candyMachineAccount, true),
  });

  // Authority.
  signers.push(authorityAccount);
  keys.push({
    pubkey: authorityAccount.publicKey,
    isSigner: true,
    isWritable: isWritable(authorityAccount, false),
  });

  // Data.
  const data =
    getAddConfigLinesInstructionDataSerializer(context).serialize(input);

  // Bytes Created On Chain.
  const bytesCreatedOnChain = 0;

  return {
    instruction: { keys, programId, data },
    signers,
    bytesCreatedOnChain,
  };
}
