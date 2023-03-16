import {
  transactionBuilder,
  TransactionBuilder,
} from '@metaplex-foundation/umi';
import {
  createCandyGuard,
  CreateCandyGuardInstructionDataArgs,
} from './createCandyGuard';
import { createCandyMachineV2 } from './createCandyMachineV2';
import { DefaultGuardSetArgs } from './defaultGuards';
import { wrap } from './generated';
import { GuardRepository, GuardSetArgs } from './guards';
import { findCandyGuardPda } from './hooked';

export type CreateInput<DA extends GuardSetArgs = DefaultGuardSetArgs> =
  Parameters<typeof createCandyMachineV2>[1] &
    CreateCandyGuardInstructionDataArgs<DA>;

export const create = async <DA extends GuardSetArgs = DefaultGuardSetArgs>(
  context: Parameters<typeof createCandyMachineV2>[0] & {
    guards: GuardRepository;
  },
  input: CreateInput<DA extends undefined ? DefaultGuardSetArgs : DA>
): Promise<TransactionBuilder> => {
  const { guards, groups, ...rest } = input;
  const candyGuard = findCandyGuardPda(context, {
    base: input.candyMachine.publicKey,
  });
  return transactionBuilder()
    .add(await createCandyMachineV2(context, rest))
    .add(
      createCandyGuard(context, {
        base: input.candyMachine,
        guards,
        groups,
      })
    )
    .add(
      wrap(context, {
        candyGuard,
        candyMachine: input.candyMachine.publicKey,
      })
    );
};
