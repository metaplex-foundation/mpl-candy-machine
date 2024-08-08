import {
  ACCOUNT_HEADER_SIZE,
  transactionBuilder,
  TransactionBuilder,
} from '@metaplex-foundation/umi';
import { GUMBALL_GUARD_DATA } from './constants';
import { DefaultGuardSetArgs } from './defaultGuards';
import {
  initializeGumballGuard,
  InitializeGumballGuardInstructionAccounts,
} from './generated/instructions/initializeGumballGuard';
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

export { InitializeGumballGuardInstructionAccounts };

export type CreateGumballGuardInstructionData<D extends GuardSet> = {
  discriminator: Array<number>;
} & GumballGuardData<D>;

export type CreateGumballGuardInstructionDataArgs<DA extends GuardSetArgs> =
  Partial<GumballGuardDataArgs<DA>>;

export function createGumballGuard<
  DA extends GuardSetArgs = DefaultGuardSetArgs
>(
  context: Parameters<typeof initializeGumballGuard>[0] & {
    guards: GuardRepository;
  },
  input: InitializeGumballGuardInstructionAccounts &
    CreateGumballGuardInstructionDataArgs<
      DA extends undefined ? DefaultGuardSetArgs : DA
    >
): TransactionBuilder {
  const { guards, groups, ...rest } = input;
  const program = context.programs.get<CandyGuardProgram>('mplCandyGuard');
  const serializer = getGumballGuardDataSerializer<
    DA extends undefined ? DefaultGuardSetArgs : DA,
    any
  >(context, program);
  const data = serializer.serialize({
    guards: guards ?? {},
    groups: groups ?? [],
  });

  return transactionBuilder([
    {
      ...initializeGumballGuard(context, { ...rest, data }).items[0],
      bytesCreatedOnChain:
        ACCOUNT_HEADER_SIZE + GUMBALL_GUARD_DATA + data.length,
    },
  ]);
}
