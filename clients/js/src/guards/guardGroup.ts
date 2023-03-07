import { Context, Serializer } from '@metaplex-foundation/umi';
import { CANDY_GUARD_LABEL_SIZE } from '../constants';
import { CandyGuardProgram, GuardRepository } from './guardRepository';
import { getGuardSetSerializer, GuardSet, GuardSetArgs } from './guardSet';

/**
 * A group represent a specific set of guards. When groups are used, transactions
 * must specify which group should be used during validation.
 */
export type GuardGroup<D extends GuardSet> = {
  label: string;
  guards: D;
};

export type GuardGroupArgs<DA extends GuardSetArgs> = {
  label: string;
  guards: Partial<DA>;
};

export function getGuardGroupSerializer<
  DA extends GuardSetArgs,
  D extends DA & GuardSet = DA
>(
  context: Pick<Context, 'serializer'> & { guards: GuardRepository },
  program: CandyGuardProgram
): Serializer<GuardGroupArgs<DA>, GuardGroup<D>> {
  const s = context.serializer;
  return s.struct(
    [
      ['label', s.string({ size: CANDY_GUARD_LABEL_SIZE })],
      ['guards', getGuardSetSerializer<DA, D>(context, program)],
    ],
    { description: 'GuardGroup' }
  ) as Serializer<GuardGroupArgs<DA>, GuardGroup<D>>;
}
