import { createAccount } from '@metaplex-foundation/mpl-toolbox';
import {
  Context,
  Signer,
  transactionBuilder,
  TransactionBuilder,
} from '@metaplex-foundation/umi';
import { initializeCandyMachineV2 } from './generated';
import { getCandyMachineSizeForItemCount } from './hooked';

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
): Promise<TransactionBuilder> => {
  const space = getCandyMachineSizeForItemCount(input.itemCount);
  const lamports = await context.rpc.getRent(space);
  return transactionBuilder()
    .add(
      createAccount(context, {
        newAccount: input.candyMachine,
        lamports,
        space,
        programId: context.programs.get('mplCandyMachineCore').publicKey,
      })
    )
    .add(
      initializeCandyMachineV2(context, {
        ...input,
        candyMachine: input.candyMachine.publicKey,
      })
    );
};
