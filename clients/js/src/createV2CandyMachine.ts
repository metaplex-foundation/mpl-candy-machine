import { createAccountWithRent } from '@metaplex-foundation/mpl-essentials';
import { none, Signer, WrappedInstruction } from '@metaplex-foundation/umi';
import { initializeV2CandyMachine } from './generated';
import { getCandyMachineSize } from './hooked';

export type CreateCandyMachineInput = Omit<
  Parameters<typeof initializeV2CandyMachine>[1],
  'candyMachine'
> & {
  candyMachine: Signer;
};

export const createCandyMachine = (
  context: Parameters<typeof initializeV2CandyMachine>[0],
  input: CreateCandyMachineInput
): WrappedInstruction[] => [
  createAccountWithRent(context, {
    newAccount: input.candyMachine,
    space: getCandyMachineSize(
      input.itemsAvailable,
      input.configLineSettings ?? none()
    ),
    programId: context.programs.get('mplCandyMachineCore').publicKey,
    systemProgram: input.systemProgram,
  }),
  initializeV2CandyMachine(context, {
    ...input,
    candyMachine: input.candyMachine.publicKey,
  }),
];
