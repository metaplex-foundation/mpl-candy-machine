/**
 * This code was AUTOGENERATED using the kinobi library.
 * Please DO NOT EDIT THIS FILE, instead use visitors
 * to add features, then rerun kinobi to update it.
 *
 * @see https://github.com/metaplex-foundation/kinobi
 */

import { Context, Option, Serializer } from '@metaplex-foundation/umi';
import {
  Group,
  GroupArgs,
  GuardSet,
  GuardSetArgs,
  getGroupSerializer,
  getGuardSetSerializer,
} from '.';

export type CandyGuardData = {
  default: GuardSet;
  groups: Option<Array<Group>>;
};

export type CandyGuardDataArgs = {
  default: GuardSetArgs;
  groups: Option<Array<GroupArgs>>;
};

export function getCandyGuardDataSerializer(
  context: Pick<Context, 'serializer'>
): Serializer<CandyGuardDataArgs, CandyGuardData> {
  const s = context.serializer;
  return s.struct<CandyGuardData>(
    [
      ['default', getGuardSetSerializer(context)],
      ['groups', s.option(s.array(getGroupSerializer(context)))],
    ],
    { description: 'CandyGuardData' }
  ) as Serializer<CandyGuardDataArgs, CandyGuardData>;
}
