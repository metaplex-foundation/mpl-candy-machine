import {
  findMintCounterPda,
  getMintLimitSerializer,
  MintLimit,
  MintLimitArgs,
} from '../generated';
import { GuardManifest, noopParser } from '../guards';

/**
 * The mintLimit guard allows to specify a limit on the
 * number of mints for each individual wallet.
 *
 * The limit is set per wallet, per candy machine and per
 * identified (provided in the settings) to allow multiple
 * mint limits within a Candy Machine. This is particularly
 * useful when using groups of guards and we want each of them
 * to have a different mint limit.
 */
export const mintLimitGuardManifest: GuardManifest<
  MintLimitArgs,
  MintLimit,
  MintLimitMintArgs
> = {
  name: 'mintLimit',
  serializer: getMintLimitSerializer,
  mintParser: (context, mintContext, args) => ({
    data: new Uint8Array(),
    remainingAccounts: [
      {
        publicKey: findMintCounterPda(context, {
          id: args.id,
          user: mintContext.minter.publicKey,
          candyMachine: mintContext.candyMachine,
          candyGuard: mintContext.candyGuard,
        })[0],
        isWritable: true,
      },
    ],
  }),
  routeParser: noopParser,
};

export type MintLimitMintArgs = Omit<MintLimitArgs, 'limit'>;
