import {
  array,
  Serializer,
  struct,
} from '@metaplex-foundation/umi/serializers';
import {
  CandyGuardProgram,
  getGuardGroupSerializer,
  getGuardSetSerializer,
  GuardGroup,
  GuardGroupArgs,
  GuardRepository,
  GuardSet,
  GuardSetArgs,
} from '../guards';

export type CandyGuardData<D extends GuardSet> = {
  guards: D;
  groups: Array<GuardGroup<D>>;
};

export type CandyGuardDataArgs<DA extends GuardSetArgs> = {
  guards: Partial<DA>;
  groups: Array<GuardGroupArgs<DA>>;
};

export function getCandyGuardDataSerializer<
  DA extends GuardSetArgs,
  D extends DA & GuardSet
>(
  context: { guards: GuardRepository },
  program: CandyGuardProgram
): Serializer<CandyGuardDataArgs<DA>, CandyGuardData<D>> {
  return struct<CandyGuardDataArgs<DA>, CandyGuardData<D>>(
    [
      ['guards', getGuardSetSerializer<DA, D>(context, program)],
      ['groups', array(getGuardGroupSerializer<DA, D>(context, program))],
    ],
    { description: 'CandyGuardData' }
  );
}
