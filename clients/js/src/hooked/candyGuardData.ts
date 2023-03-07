import {
  Context,
  mapSerializer,
  none,
  Option,
  Serializer,
} from '@metaplex-foundation/umi';
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
  groups: Option<Array<GuardGroup<D>>>;
};

export type CandyGuardDataArgs<DA extends GuardSetArgs> = {
  guards?: Partial<DA>;
  groups?: Option<Array<GuardGroupArgs<DA>>>;
};

export function getCandyGuardDataSerializer<
  DA extends GuardSetArgs,
  D extends DA & GuardSet = DA
>(
  context: Pick<Context, 'serializer'> & { guards: GuardRepository },
  program: CandyGuardProgram
): Serializer<CandyGuardDataArgs<DA>, CandyGuardData<D>> {
  const s = context.serializer;
  return mapSerializer(
    s.struct<Required<CandyGuardDataArgs<DA>>, CandyGuardData<D>>(
      [
        ['guards', getGuardSetSerializer<DA, D>(context, program)],
        [
          'groups',
          s.option(s.array(getGuardGroupSerializer<DA, D>(context, program))),
        ],
      ],
      { description: 'CandyGuardData' }
    ),
    (args) => ({ guards: args.guards ?? {}, groups: args.groups ?? none() })
  ) as Serializer<CandyGuardDataArgs<DA>, CandyGuardData<D>>;
}
