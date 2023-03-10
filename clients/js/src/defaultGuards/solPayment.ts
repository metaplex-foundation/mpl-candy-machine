import {
  getSolPaymentSerializer,
  SolPayment,
  SolPaymentArgs,
} from '../generated';
import { GuardManifest, noopParser } from '../guards';

/**
 * The solPayment guard is used to charge an
 * amount in SOL for the minted NFT.
 */
export const solPaymentGuardManifest: GuardManifest<
  SolPaymentArgs,
  SolPayment,
  SolPaymentMintArgs
> = {
  name: 'solPayment',
  serializer: getSolPaymentSerializer,
  mintParser: (context, mintContext, args) => ({
    data: new Uint8Array(),
    remainingAccounts: [{ publicKey: args.destination, isWritable: true }],
  }),
  routeParser: noopParser,
};

export type SolPaymentMintArgs = Omit<SolPaymentArgs, 'lamports'>;
