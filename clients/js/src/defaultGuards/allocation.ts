import { getSplSystemProgramId } from '@metaplex-foundation/mpl-essentials';
import {
  findMintTrackerPda,
  getAllocationSerializer,
  Allocation,
  AllocationArgs,
} from '../generated';
import { GuardManifest } from '../guards';
import { Signer } from '@metaplex-foundation/umi';

/**
 * Guard to specify the maximum number of mints in a guard set.
 *
 */
export const allocationGuardManifest: GuardManifest<
  AllocationArgs,
  Allocation,
  AllocationMintArgs,
  AllocationRouteArgs
> = {
  name: 'allocation',
  serializer: getAllocationSerializer,
  mintParser: (context, mintContext, args) => ({
    data: new Uint8Array(),
    remainingAccounts: [
      {
        publicKey: findMintTrackerPda(context, {
          id: args.id,
          candyMachine: mintContext.candyMachine,
          candyGuard: mintContext.candyGuard,
        }),
        isWritable: true,
      },
    ],
  }),
  routeParser: (context, routeContext, args) => ({
    data: new Uint8Array(),
    remainingAccounts: [
      {
        isWritable: true,
        publicKey: findMintTrackerPda(context, {
          id: args.id,
          candyMachine: routeContext.candyMachine,
          candyGuard: routeContext.candyGuard,
        }),
      },
      { isWritable: false, signer: args.candyGuardAuthority },
      { isWritable: false, publicKey: getSplSystemProgramId(context) },
    ],
  }),
};

export type AllocationMintArgs = Omit<AllocationArgs, 'size'>;

/**
 * The allocation guard arguments that should be provided
 * when accessing the guard's special "route" instruction.
 */
export type AllocationRouteArgs = Omit<AllocationArgs, 'size'> & {
  /** The authority of the Candy Guard as a Signer. */
  candyGuardAuthority: Signer;
};
