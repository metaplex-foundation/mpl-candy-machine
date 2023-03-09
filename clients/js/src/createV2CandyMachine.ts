import { createAccount } from '@metaplex-foundation/mpl-essentials';
import {
  Context,
  none,
  Signer,
  WrappedInstruction,
} from '@metaplex-foundation/umi';
import { initializeV2CandyMachine } from './generated';
import { getCandyMachineSize } from './hooked';

export type CreateV2CandyMachineInput = Omit<
  Parameters<typeof initializeV2CandyMachine>[1],
  'candyMachine'
> & {
  candyMachine: Signer;
};

export const createV2CandyMachine = async (
  context: Parameters<typeof initializeV2CandyMachine>[0] &
    Pick<Context, 'rpc'>,
  input: CreateV2CandyMachineInput
): Promise<WrappedInstruction[]> => {
  const space = getCandyMachineSize(
    input.itemsAvailable,
    input.configLineSettings ?? none()
  );
  const lamports = await context.rpc.getRent(space);
  return [
    createAccount(context, {
      newAccount: input.candyMachine,
      lamports,
      space,
      programId: context.programs.get('mplCandyMachineCore').publicKey,
    }),
    initializeV2CandyMachine(context, {
      ...input,
      candyMachine: input.candyMachine.publicKey,
    }),
  ];
};
