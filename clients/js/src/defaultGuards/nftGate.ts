import { findMetadataPda } from '@metaplex-foundation/mpl-token-metadata';
import { findAssociatedTokenPda } from '@metaplex-foundation/mpl-toolbox';
import { PublicKey } from '@metaplex-foundation/umi';
import { getNftGateSerializer, NftGate, NftGateArgs } from '../generated';
import { GuardManifest, noopParser } from '../guards';

/**
 * The nftGate guard restricts minting to holders
 * of a specified NFT collection.
 *
 * This means the mint address of an NFT from this
 * collection must be passed when minting.
 */
export const nftGateGuardManifest: GuardManifest<
  NftGateArgs,
  NftGate,
  NftGateMintArgs
> = {
  name: 'nftGate',
  serializer: getNftGateSerializer,
  mintParser: (context, mintContext, args) => {
    const tokenAccount =
      args.tokenAccount ??
      findAssociatedTokenPda(context, {
        mint: args.mint,
        owner: mintContext.buyer.publicKey,
      })[0];
    const [tokenMetadata] = findMetadataPda(context, { mint: args.mint });
    return {
      data: new Uint8Array(),
      remainingAccounts: [
        { publicKey: tokenAccount, isWritable: false },
        { publicKey: tokenMetadata, isWritable: false },
      ],
    };
  },
  routeParser: noopParser,
};

export type NftGateMintArgs = {
  /**
   * The mint address of an NFT from the required
   * collection that belongs to the payer.
   */
  mint: PublicKey;

  /**
   * The token account linking the NFT with its owner.
   *
   * @defaultValue
   * Defaults to the associated token address using the
   * mint address of the NFT and the payer's address.
   */
  tokenAccount?: PublicKey;
};
