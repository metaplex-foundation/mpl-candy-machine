import { EndDate, EndDateArgs, getEndDateSerializer } from '../generated';
import { GuardManifest, noopParser } from '../guards';

/**
 * The endDate guard is used to specify a date to end the mint.
 * Any transaction received after the end date will fail.
 */
export const endDateGuardManifest: GuardManifest<EndDateArgs, EndDate> = {
  name: 'endDate',
  serializer: getEndDateSerializer,
  mintParser: noopParser,
  routeParser: noopParser,
};
