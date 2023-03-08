import {
  ACCOUNT_HEADER_SIZE,
  WrappedInstruction,
} from '@metaplex-foundation/umi';
import { CANDY_GUARD_DATA } from './constants';
import { DefaultGuardSetArgs } from './defaultGuards';
import {
  createCandyGuard as baseCreateCandyGuard,
  CreateCandyGuardInstructionAccounts,
} from './generated/instructions/createCandyGuard';
import { GuardRepository, GuardSet, GuardSetArgs } from './guards';
import {
  CandyGuardData,
  CandyGuardDataArgs,
  serializeCandyGuardDataWithLength,
} from './hooked';

export { CreateCandyGuardInstructionAccounts };

export type CreateCandyGuardInstructionData<D extends GuardSet> = {
  discriminator: Array<number>;
} & CandyGuardData<D>;

export type CreateCandyGuardInstructionDataArgs<DA extends GuardSetArgs> =
  CandyGuardDataArgs<DA>;

export function createCandyGuard<DA extends GuardSetArgs = DefaultGuardSetArgs>(
  context: Parameters<typeof baseCreateCandyGuard>[0] & {
    guards: GuardRepository;
  },
  input: CreateCandyGuardInstructionAccounts &
    CreateCandyGuardInstructionDataArgs<
      DA extends undefined ? DefaultGuardSetArgs : DA
    >
): WrappedInstruction {
  const { guards, groups, ...rest } = input;
  const data = serializeCandyGuardDataWithLength<
    DA extends undefined ? DefaultGuardSetArgs : DA
  >(context, { guards, groups });

  return {
    ...baseCreateCandyGuard(context, { ...rest, data }),
    bytesCreatedOnChain:
      ACCOUNT_HEADER_SIZE + CANDY_GUARD_DATA + data.length - 4,
  };
}
