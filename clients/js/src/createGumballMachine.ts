import { createAccount } from '@metaplex-foundation/mpl-toolbox';
import {
  Context,
  Signer,
  transactionBuilder,
  TransactionBuilder,
} from '@metaplex-foundation/umi';
import { initializeGumballMachine } from './generated';
import { getGumballMachineSizeForItemCount } from './hooked';

export type CreateGumballMachineInput = Omit<
  Parameters<typeof initializeGumballMachine>[1],
  'gumballMachine'
> & {
  gumballMachine: Signer;
};

export const createGumballMachine = async (
  context: Parameters<typeof initializeGumballMachine>[0] &
    Pick<Context, 'rpc'>,
  input: CreateGumballMachineInput
): Promise<TransactionBuilder> => {
  const space = getGumballMachineSizeForItemCount(input.settings.itemCapacity);
  const lamports = await context.rpc.getRent(space);
  return transactionBuilder()
    .add(
      createAccount(context, {
        newAccount: input.gumballMachine,
        lamports,
        space,
        programId: context.programs.get('mallowGumball').publicKey,
      })
    )
    .add(
      initializeGumballMachine(context, {
        ...input,
        gumballMachine: input.gumballMachine.publicKey,
      })
    );
};
