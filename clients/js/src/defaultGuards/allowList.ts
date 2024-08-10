import { getSplSystemProgramId } from '@metaplex-foundation/mpl-toolbox';
import { PublicKey, publicKey, Signer } from '@metaplex-foundation/umi';
import { array, bytes } from '@metaplex-foundation/umi/serializers';
import {
  AllowList,
  AllowListArgs,
  findAllowListProofPda,
  getAllowListSerializer,
} from '../generated';
import { GuardManifest } from '../guards';

/**
 * The allowList guard validates the minting wallet against
 * a predefined list of wallets.
 *
 * Instead of passing the entire list of wallets as settings,
 * this guard accepts the Root of a Merkle Tree created from
 * this allow list. The program can then validate that the minting
 * wallet is part of the allow list by requiring a Merkle Proof.
 * Minting will fail if either the minting address is not part of
 * the merkle tree or if no Merkle Proof is specified.
 *
 * You may use the `getMerkleRoot` and `getMerkleProof` helper
 * functions provided by the SDK to help you set up this guard.
 * Here is an example.
 *
 * ```ts
 * import { getMerkleProof, getMerkleRoot } from '@metaplex-foundation/mallow-gumball';
 * const allowList = [
 *   'Ur1CbWSGsXCdedknRbJsEk7urwAvu1uddmQv51nAnXB',
 *   'GjwcWFQYzemBtpUoN5fMAP2FZviTtMRWCmrppGuTthJS',
 *   'AT8nPwujHAD14cLojTcB1qdBzA1VXnT6LVGuUd6Y73Cy',
 * ];
 * const merkleRoot = getMerkleRoot(allowList);
 * const validMerkleProof = getMerkleProof(allowList, 'Ur1CbWSGsXCdedknRbJsEk7urwAvu1uddmQv51nAnXB');
 * const invalidMerkleProof = getMerkleProof(allowList, 'invalid-address');
 * ```
 *
 * Note that you will need to provide the Merkle Proof for the
 * minting wallet before calling the mint instruction via the
 * special "route" instruction of the guard.
 * See {@link AllowListRouteArgs} for more information.
 */
export const allowListGuardManifest: GuardManifest<
  AllowListArgs,
  AllowList,
  AllowListMintArgs,
  AllowListRouteArgs
> = {
  name: 'allowList',
  serializer: getAllowListSerializer,
  mintParser: (context, mintContext, args) => ({
    data: new Uint8Array(),
    remainingAccounts: [
      {
        isWritable: false,
        publicKey: findAllowListProofPda(context, {
          merkleRoot: args.merkleRoot,
          user: mintContext.buyer.publicKey,
          gumballMachine: mintContext.gumballMachine,
          gumballGuard: mintContext.gumballGuard,
        })[0],
      },
    ],
  }),
  routeParser: (context, routeContext, args) => ({
    data: array(bytes({ size: 32 })).serialize(args.merkleProof),
    remainingAccounts: [
      {
        isWritable: true,
        publicKey: findAllowListProofPda(context, {
          merkleRoot: args.merkleRoot,
          user: publicKey(args.buyer ?? routeContext.payer),
          gumballMachine: routeContext.gumballMachine,
          gumballGuard: routeContext.gumballGuard,
        })[0],
      },
      { isWritable: false, publicKey: getSplSystemProgramId(context) },
      ...(args.buyer !== undefined
        ? [{ isWritable: false, publicKey: publicKey(args.buyer) }]
        : []),
    ],
  }),
};

export type AllowListMintArgs = AllowListArgs;

/**
 * The settings for the allowList guard that should be provided
 * when accessing the guard's special "route" instruction.
 *
 * ## Proof
 * The `proof` path allows you to provide a Merkle Proof
 * for a specific wallet in order to allow minting for that wallet.
 * This will create a small PDA account on the Program as a proof
 * that the wallet has been allowed to mint.
 *
 * ```ts
 * route(umi, {
 *   // ...
 *   guard: 'allowList',
 *   routeArgs: {
 *     path: 'proof',
 * .   merkleRoot: getMerkleRoot(allowList),
 *     merkleProof: getMerkleProof(allowList, base58PublicKey(umi.identity)),
 *   },
 * });
 *
 * // You are now allows to mint with this wallet.
 * ```
 */
export type AllowListRouteArgs = AllowListArgs & {
  /** Selects the path to execute in the route instruction. */
  path: 'proof';

  /**
   * The Proof that the minting wallet is part of the
   * Merkle Tree-based allow list. You may use the
   * `getMerkleProof` helper function to generate this.
   */
  merkleProof: Uint8Array[];

  /**
   * The address of the minter to validate if it is not the payer.
   * Here, we allow it to be a Signer for backwards compatibility
   * but the account will not be used as a signer.
   */
  buyer?: PublicKey | Signer;
};
