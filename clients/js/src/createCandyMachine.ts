import { createAccountWithRent } from '@metaplex-foundation/mpl-essentials';
import { none, Signer, WrappedInstruction } from '@metaplex-foundation/umi';
import { initializeCandyMachine } from './generated';
import { getCandyMachineSize } from './hooked';

export type CreateCandyMachineInput = Omit<
  Parameters<typeof initializeCandyMachine>[1],
  'candyMachine'
> & {
  candyMachine: Signer;
};

export const createCandyMachine = (
  context: Parameters<typeof initializeCandyMachine>[0],
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
  initializeCandyMachine(context, {
    ...input,
    candyMachine: input.candyMachine.publicKey,
  }),
];
