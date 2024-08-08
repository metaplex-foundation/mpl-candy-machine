import {
  getRedeemedAmountSerializer,
  RedeemedAmount,
  RedeemedAmountArgs,
} from '../generated';
import { GuardManifest, noopParser } from '../guards';

/**
 * The redeemedAmount guard forbids minting when the
 * number of minted NFTs for the entire Gumball Machine
 * reaches the configured maximum amount.
 */
export const redeemedAmountGuardManifest: GuardManifest<
  RedeemedAmountArgs,
  RedeemedAmount,
  RedeemedAmountMintArgs
> = {
  name: 'redeemedAmount',
  serializer: getRedeemedAmountSerializer,
  mintParser: noopParser,
  routeParser: noopParser,
};

export type RedeemedAmountMintArgs = Omit<RedeemedAmountArgs, 'limit'>;
