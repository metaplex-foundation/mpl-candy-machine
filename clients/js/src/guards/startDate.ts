import { DateTime, DateTimeInput } from '@metaplex-foundation/umi';
import { getStartDateSerializer, StartDate, StartDateArgs } from '../generated';
import { GuardManifest, noopParser } from './core';

/**
 * The startDate guard determines the start date of the mint.
 * Before this date, minting is not allowed.
 */
export const startDateGuardManifest: GuardManifest<StartDateArgs, StartDate> = {
  name: 'startDate',
  serializer: getStartDateSerializer,
  mintParser: noopParser,
  routeParser: noopParser,
};
