import { findAssociatedTokenPda } from '@metaplex-foundation/mpl-essentials';
import {
  getToken2022PaymentSerializer,
  Token2022Payment,
  Token2022PaymentArgs,
} from '../generated';
import { GuardManifest, noopParser } from '../guards';

/**
 * The token2022Payment guard allows minting by charging the
 * payer a specific amount of tokens from a certain mint acount
 * using Token2022. The tokens will be transfered to a predefined
 * destination.
 *
 * This guard alone does not limit how many times a holder
 * can mint. A holder can mint as many times as they have
 * the required amount of tokens to pay with.
 */
export const token2022PaymentGuardManifest: GuardManifest<
  Token2022PaymentArgs,
  Token2022Payment,
  Token2022PaymentMintArgs
> = {
  name: 'token2022Payment',
  serializer: getToken2022PaymentSerializer,
  mintParser: (context, mintContext, args) => {
    const sourceAta = findAssociatedTokenPda(context, {
      mint: args.mint,
      owner: mintContext.minter.publicKey,
    });
    return {
      data: new Uint8Array(),
      remainingAccounts: [
        { publicKey: sourceAta, isWritable: true },
        { publicKey: args.destinationAta, isWritable: true },
      ],
    };
  },
  routeParser: noopParser,
};

export type Token2022PaymentMintArgs = Omit<Token2022PaymentArgs, 'amount'>;
