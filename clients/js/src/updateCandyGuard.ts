import { WrappedInstruction } from '@metaplex-foundation/umi';
import { DefaultGuardSetArgs } from './defaultGuards';
import {
  updateCandyGuard as baseUpdateCandyGuard,
  UpdateCandyGuardInstructionAccounts,
} from './generated/instructions/updateCandyGuard';
import { GuardRepository, GuardSet, GuardSetArgs } from './guards';
import {
  CandyGuardData,
  CandyGuardDataArgs,
  serializeCandyGuardDataWithLength,
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
): WrappedInstruction {
  const { guards, groups, ...rest } = input;
  const data = serializeCandyGuardDataWithLength<
    DA extends undefined ? DefaultGuardSetArgs : DA
  >(context, { guards, groups });

  return baseUpdateCandyGuard(context, { ...rest, data });
}
