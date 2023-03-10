import { WrappedInstruction } from '@metaplex-foundation/umi';
import {
  createCandyGuard,
  CreateCandyGuardInstructionDataArgs,
} from './createCandyGuard';
import { createCandyMachine } from './createCandyMachine';
import { DefaultGuardSetArgs } from './defaultGuards';
import { wrap } from './generated';
import { GuardRepository, GuardSetArgs } from './guards';
import { findCandyGuardPda } from './hooked';

export type CreateInput<DA extends GuardSetArgs = DefaultGuardSetArgs> =
  Parameters<typeof createCandyMachine>[1] &
    CreateCandyGuardInstructionDataArgs<DA>;

export const create = async <DA extends GuardSetArgs = DefaultGuardSetArgs>(
  context: Parameters<typeof createCandyMachine>[0] & {
    guards: GuardRepository;
  },
  input: CreateInput<DA extends undefined ? DefaultGuardSetArgs : DA>
): Promise<WrappedInstruction[]> => {
  const { guards, groups, ...rest } = input;
  const candyGuard = findCandyGuardPda(context, {
    base: input.candyMachine.publicKey,
  });
  return [
    ...(await createCandyMachine(context, rest)),
    createCandyGuard(context, { base: input.candyMachine, guards, groups }),
    wrap(context, { candyGuard, candyMachine: input.candyMachine.publicKey }),
  ];
};
