import { getStartDateSerializer, StartDate, StartDateArgs } from '../generated';
import { GuardManifest, noopParser } from '../guards';

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
