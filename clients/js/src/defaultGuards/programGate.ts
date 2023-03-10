import { fixSerializer } from '@metaplex-foundation/umi';
import {
  ProgramGate,
  ProgramGateArgs,
  getProgramGateSerializer,
} from '../generated';
import { GuardManifest, noopParser } from '../guards';

/**
 * The programGate guard restricts the mint to a single
 * address which must match the minting wallet's address.
 */
export const programGateGuardManifest: GuardManifest<
  ProgramGateArgs,
  ProgramGate
> = {
  name: 'programGate',
  serializer: (context) =>
    fixSerializer(getProgramGateSerializer(context), 4 + 32 * 5),
  mintParser: noopParser,
  routeParser: noopParser,
};
