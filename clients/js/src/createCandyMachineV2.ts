import { createAccount } from '@metaplex-foundation/mpl-essentials';
import {
  Context,
  none,
  Signer,
  WrappedInstruction,
} from '@metaplex-foundation/umi';
import { initializeCandyMachineV2 } from './generated';
import { getCandyMachineSize } from './hooked';

export type CreateCandyMachineV2Input = Omit<
  Parameters<typeof initializeCandyMachineV2>[1],
  'candyMachine'
> & {
  candyMachine: Signer;
};

export const createCandyMachineV2 = async (
  context: Parameters<typeof initializeCandyMachineV2>[0] &
    Pick<Context, 'rpc'>,
  input: CreateCandyMachineV2Input
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
    initializeCandyMachineV2(context, {
      ...input,
      candyMachine: input.candyMachine.publicKey,
    }),
  ];
};
