import { createAccount } from '@metaplex-foundation/mpl-toolbox';
import {
  Context,
  none,
  Signer,
  transactionBuilder,
  TransactionBuilder,
} from '@metaplex-foundation/umi';
import { initializeCandyMachine } from './generated';
import { getCandyMachineSize } from './hooked';

export type CreateCandyMachineInput = Omit<
  Parameters<typeof initializeCandyMachine>[1],
  'candyMachine'
> & {
  candyMachine: Signer;
};

export const createCandyMachine = async (
  context: Parameters<typeof initializeCandyMachine>[0] & Pick<Context, 'rpc'>,
  input: CreateCandyMachineInput
): Promise<TransactionBuilder> => {
  const space = getCandyMachineSize(
    input.itemsAvailable,
    input.configLineSettings ?? none()
  );
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
      initializeCandyMachine(context, {
        ...input,
        candyMachine: input.candyMachine.publicKey,
      })
    );
};
