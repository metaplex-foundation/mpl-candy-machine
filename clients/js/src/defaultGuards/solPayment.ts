import {
  getSolPaymentSerializer,
  SolPayment,
  SolPaymentArgs,
} from '../generated';
import { GuardManifest, noopParser } from '../guards';
import { findCandyMachineAuthorityPda } from '../hooked';

/**
 * The solPayment guard is used to charge an
 * amount in SOL for the minted NFT.
 */
export const solPaymentGuardManifest: GuardManifest<
  SolPaymentArgs,
  SolPayment
> = {
  name: 'solPayment',
  serializer: getSolPaymentSerializer,
  mintParser: (context, mintContext, args) => ({
    data: new Uint8Array(),
    remainingAccounts: [
      {
        publicKey: findCandyMachineAuthorityPda(context, {
          candyMachine: mintContext.candyMachine,
        })[0],
        isWritable: true,
      },
    ],
  }),
  routeParser: noopParser,
};
