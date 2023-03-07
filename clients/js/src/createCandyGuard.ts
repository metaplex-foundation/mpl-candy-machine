import {
  base16,
  mergeBytes,
  WrappedInstruction,
} from '@metaplex-foundation/umi';
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
  context: Parameters<typeof baseCreateCandyGuard>[0] & {
    guards: GuardRepository;
  },
  input: CreateCandyGuardInstructionAccounts &
    CreateCandyGuardInstructionDataArgs<DA>
): WrappedInstruction {
  const program = context.programs.get<CandyGuardProgram>('mplCandyGuard');
  const { guards, groups, ...rest } = input;
  const serializer = getCandyGuardDataSerializer<DA>(context, program);
  const data = serializer.serialize({ guards, groups });
  const prefix = context.serializer.u32().serialize(data.length);
  const dataWithPrefix = mergeBytes([prefix, data]);
  console.log({
    prefix: base16.deserialize(prefix),
    data: base16.deserialize(data),
    dataWithPrefix: base16.deserialize(dataWithPrefix),
  });
  const ix = baseCreateCandyGuard(context, { ...rest, data: dataWithPrefix });
  return { ...ix, bytesCreatedOnChain: CANDY_GUARD_DATA + data.length };
}
