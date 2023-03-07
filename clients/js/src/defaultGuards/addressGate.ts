import {
  AddressGate,
  AddressGateArgs,
  getAddressGateSerializer,
} from '../generated';
import { GuardManifest, noopParser } from '../guards';

/**
 * The addressGate guard restricts the mint to a single
 * address which must match the minting wallet's address.
 */
export const addressGateGuardManifest: GuardManifest<
  AddressGateArgs,
  AddressGate
> = {
  name: 'addressGate',
  serializer: getAddressGateSerializer,
  mintParser: noopParser,
  routeParser: noopParser,
};
