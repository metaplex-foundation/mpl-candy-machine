import { createAccount } from '@metaplex-foundation/mpl-toolbox';
import {
  Context,
  none,
  Signer,
  transactionBuilder,
  TransactionBuilder,
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
): Promise<TransactionBuilder> => {
  const space = getCandyMachineSize(
    input.itemsAvailable,
    input.configLineSettings ?? none(),
    input.tokenStandard
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
      initializeCandyMachineV2(context, {
        ...input,
        candyMachine: input.candyMachine.publicKey,
      })
    );
};
