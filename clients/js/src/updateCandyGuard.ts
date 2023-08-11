import { TransactionBuilder } from '@metaplex-foundation/umi';
import { DefaultGuardSetArgs } from './defaultGuards';
import {
  updateCandyGuard as baseUpdateCandyGuard,
  UpdateCandyGuardInstructionAccounts,
} from './generated/instructions/updateCandyGuard';
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

export { UpdateCandyGuardInstructionAccounts };

export type UpdateCandyGuardInstructionData<D extends GuardSet> = {
  discriminator: Array<number>;
} & CandyGuardData<D>;

export type UpdateCandyGuardInstructionDataArgs<DA extends GuardSetArgs> =
  CandyGuardDataArgs<DA>;

export function updateCandyGuard<DA extends GuardSetArgs = DefaultGuardSetArgs>(
  context: Parameters<typeof baseUpdateCandyGuard>[0] & {
    guards: GuardRepository;
  },
  input: UpdateCandyGuardInstructionAccounts &
    UpdateCandyGuardInstructionDataArgs<
      DA extends undefined ? DefaultGuardSetArgs : DA
    >
): TransactionBuilder {
  const { guards, groups, ...rest } = input;
  const program = context.programs.get<CandyGuardProgram>('mplCandyGuard');
  const serializer = getCandyGuardDataSerializer<
    DA extends undefined ? DefaultGuardSetArgs : DA,
    any
  >(context, program);
  const data = serializer.serialize({ guards, groups });

  return baseUpdateCandyGuard(context, { ...rest, data });
}
