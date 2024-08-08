import { getSplSystemProgramId } from '@metaplex-foundation/mpl-toolbox';
import { Signer } from '@metaplex-foundation/umi';
import {
  Allocation,
  AllocationArgs,
  findAllocationTrackerPda,
  getAllocationSerializer,
} from '../generated';
import { GuardManifest } from '../guards';

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
        publicKey: findAllocationTrackerPda(context, {
          id: args.id,
          gumballMachine: mintContext.gumballMachine,
          gumballGuard: mintContext.gumballGuard,
        })[0],
        isWritable: true,
      },
    ],
  }),
  routeParser: (context, routeContext, args) => ({
    data: new Uint8Array(),
    remainingAccounts: [
      {
        isWritable: true,
        publicKey: findAllocationTrackerPda(context, {
          id: args.id,
          gumballMachine: routeContext.gumballMachine,
          gumballGuard: routeContext.gumballGuard,
        })[0],
      },
      { isWritable: false, signer: args.gumballGuardAuthority },
      { isWritable: false, publicKey: getSplSystemProgramId(context) },
    ],
  }),
};

export type AllocationMintArgs = Omit<AllocationArgs, 'limit'>;

/**
 * The allocation guard arguments that should be provided
 * when accessing the guard's special "route" instruction.
 */
export type AllocationRouteArgs = Omit<AllocationArgs, 'limit'> & {
  /** The authority of the Gumball Guard as a Signer. */
  gumballGuardAuthority: Signer;
};
