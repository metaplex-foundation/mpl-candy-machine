import { TransactionBuilder } from '@metaplex-foundation/umi';
import { DefaultGuardSetArgs } from './defaultGuards';
import {
  updateGumballGuard as baseUpdateGumballGuard,
  UpdateGumballGuardInstructionAccounts,
} from './generated/instructions/updateGumballGuard';
import {
  CandyGuardProgram,
  GuardRepository,
  GuardSet,
  GuardSetArgs,
} from './guards';
import {
  getGumballGuardDataSerializer,
  GumballGuardData,
  GumballGuardDataArgs,
} from './hooked';

export { UpdateGumballGuardInstructionAccounts };

export type UpdateGumballGuardInstructionData<D extends GuardSet> = {
  discriminator: Array<number>;
} & GumballGuardData<D>;

export type UpdateGumballGuardInstructionDataArgs<DA extends GuardSetArgs> =
  GumballGuardDataArgs<DA>;

export function updateGumballGuard<
  DA extends GuardSetArgs = DefaultGuardSetArgs
>(
  context: Parameters<typeof baseUpdateGumballGuard>[0] & {
    guards: GuardRepository;
  },
  input: UpdateGumballGuardInstructionAccounts &
    UpdateGumballGuardInstructionDataArgs<
      DA extends undefined ? DefaultGuardSetArgs : DA
    >
): TransactionBuilder {
  const { guards, groups, ...rest } = input;
  const program = context.programs.get<CandyGuardProgram>('mplCandyGuard');
  const serializer = getGumballGuardDataSerializer<
    DA extends undefined ? DefaultGuardSetArgs : DA,
    any
  >(context, program);
  const data = serializer.serialize({ guards, groups });

  return baseUpdateGumballGuard(context, { ...rest, data });
}
