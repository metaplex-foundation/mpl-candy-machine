import { Signer } from '@metaplex-foundation/umi';
import {
  getThirdPartySignerSerializer,
  ThirdPartySigner,
  ThirdPartySignerArgs,
} from '../generated';
import { GuardManifest, noopParser } from '../guards';

/**
 * The thirdPartySigner guard requires a predefined
 * address to sign the mint transaction. The signer will need
 * to be passed within the mint settings of this guard.
 *
 * This allows for more centralized mints where every single
 * mint transaction has to go through a specific signer.
 */
export const thirdPartySignerGuardManifest: GuardManifest<
  ThirdPartySignerArgs,
  ThirdPartySigner,
  ThirdPartySignerMintArgs
> = {
  name: 'thirdPartySigner',
  serializer: getThirdPartySignerSerializer,
  mintParser: (context, mintContext, args) => ({
    data: new Uint8Array(),
    remainingAccounts: [{ signer: args.signer, isWritable: true }],
  }),
  routeParser: noopParser,
};

export type ThirdPartySignerMintArgs = {
  signer: Signer;
};
