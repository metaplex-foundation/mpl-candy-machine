import { Context, WrappedInstruction } from '@metaplex-foundation/umi';
import { CANDY_GUARD_DATA } from './constants';
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

export function createCandyGuard<DA extends GuardSetArgs>(
  context: Pick<Context, 'serializer' | 'programs' | 'identity' | 'payer'> & {
    guards: GuardRepository;
  },
  input: CreateCandyGuardInstructionAccounts &
    CreateCandyGuardInstructionDataArgs<DA>
): WrappedInstruction {
  const program = context.programs.get<CandyGuardProgram>('mplCandyGuard');
  const serializer = getCandyGuardDataSerializer<DA>(context, program);
  const { guards, groups, ...rest } = input;
  const data = serializer.serialize({ guards, groups });
  const ix = baseCreateCandyGuard(context, { ...rest, data });
  return { ...ix, bytesCreatedOnChain: CANDY_GUARD_DATA + data.length };
}
