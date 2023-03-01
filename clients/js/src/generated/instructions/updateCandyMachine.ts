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
import {
  CandyMachineData,
  CandyMachineDataArgs,
  getCandyMachineDataSerializer,
} from '../types';

// Accounts.
export type UpdateCandyMachineInstructionAccounts = {
  candyMachine: PublicKey;
  authority?: Signer;
};

// Arguments.
export type UpdateCandyMachineInstructionData = {
  discriminator: Array<number>;
  data: CandyMachineData;
};

export type UpdateCandyMachineInstructionDataArgs = {
  data: CandyMachineDataArgs;
};

export function getUpdateCandyMachineInstructionDataSerializer(
  context: Pick<Context, 'serializer'>
): Serializer<
  UpdateCandyMachineInstructionDataArgs,
  UpdateCandyMachineInstructionData
> {
  const s = context.serializer;
  return mapSerializer<
    UpdateCandyMachineInstructionDataArgs,
    UpdateCandyMachineInstructionData,
    UpdateCandyMachineInstructionData
  >(
    s.struct<UpdateCandyMachineInstructionData>(
      [
        ['discriminator', s.array(s.u8(), { size: 8 })],
        ['data', getCandyMachineDataSerializer(context)],
      ],
      { description: 'UpdateCandyMachineInstructionData' }
    ),
    (value) =>
      ({
        ...value,
        discriminator: [219, 200, 88, 176, 158, 63, 253, 127],
      } as UpdateCandyMachineInstructionData)
  ) as Serializer<
    UpdateCandyMachineInstructionDataArgs,
    UpdateCandyMachineInstructionData
  >;
}

// Instruction.
export function updateCandyMachine(
  context: Pick<Context, 'serializer' | 'programs' | 'identity'>,
  input: UpdateCandyMachineInstructionAccounts &
    UpdateCandyMachineInstructionDataArgs
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
    getUpdateCandyMachineInstructionDataSerializer(context).serialize(input);

  // Bytes Created On Chain.
  const bytesCreatedOnChain = 0;

  return {
    instruction: { keys, programId, data },
    signers,
    bytesCreatedOnChain,
  };
}
