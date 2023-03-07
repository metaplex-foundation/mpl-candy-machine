import {
  ACCOUNT_HEADER_SIZE,
  mergeBytes,
  WrappedInstruction,
} from '@metaplex-foundation/umi';
import { CANDY_GUARD_DATA } from './constants';
import { DefaultGuardSetArgs } from './defaultGuards';
import {
  createCandyGuard as baseCreateCandyGuard,
  CreateCandyGuardInstructionAccounts,
} from './generated/instructions/createCandyGuard';
import {
  CandyGuardProgram,
  GuardRepository,
  GuardSet,
  GuardSetArgs,
} from './guards';
import {
  CandyGuardData,
  CandyGuardDataArgs,
  getCandyGuardDataSerializer,
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
  const program = context.programs.get<CandyGuardProgram>('mplCandyGuard');
  const { guards, groups, ...rest } = input;
  const serializer = getCandyGuardDataSerializer<
    DA extends undefined ? DefaultGuardSetArgs : DA
  >(context, program);
  const data = serializer.serialize({ guards, groups });
  const prefix = context.serializer.u32().serialize(data.length);
  const dataWithPrefix = mergeBytes([prefix, data]);

  return {
    ...baseCreateCandyGuard(context, { ...rest, data: dataWithPrefix }),
    bytesCreatedOnChain: ACCOUNT_HEADER_SIZE + CANDY_GUARD_DATA + data.length,
  };
}
