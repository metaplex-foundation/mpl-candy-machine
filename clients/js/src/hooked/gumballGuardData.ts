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

export type GumballGuardData<D extends GuardSet> = {
  guards: D;
  groups: Array<GuardGroup<D>>;
};

export type GumballGuardDataArgs<DA extends GuardSetArgs> = {
  guards: Partial<DA>;
  groups: Array<GuardGroupArgs<DA>>;
};

export function getGumballGuardDataSerializer<
  DA extends GuardSetArgs,
  D extends DA & GuardSet
>(
  context: { guards: GuardRepository },
  program: CandyGuardProgram
): Serializer<GumballGuardDataArgs<DA>, GumballGuardData<D>> {
  return struct<GumballGuardDataArgs<DA>, GumballGuardData<D>>(
    [
      ['guards', getGuardSetSerializer<DA, D>(context, program)],
      ['groups', array(getGuardGroupSerializer<DA, D>(context, program))],
    ],
    { description: 'GumballGuardData' }
  );
}
