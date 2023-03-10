import { findAssociatedTokenPda } from '@metaplex-foundation/mpl-essentials';
import { findMetadataPda } from '@metaplex-foundation/mpl-token-metadata';
import { PublicKey } from '@metaplex-foundation/umi';
import {
  getNftPaymentSerializer,
  NftPayment,
  NftPaymentArgs,
} from '../generated';
import { GuardManifest, noopParser } from '../guards';

/**
 * The nftPayment guard allows minting by charging the
 * payer an NFT from a specified NFT collection.
 * The NFT will be transfered to a predefined destination.
 *
 * This means the mint address of the NFT to transfer must be
 * passed when minting. This guard alone does not limit how many
 * times a holder can mint. A holder can mint as many times
 * as they have NFTs from the required collection to pay with.
 */
export const nftPaymentGuardManifest: GuardManifest<
  NftPaymentArgs,
  NftPayment,
  NftPaymentMintArgs
> = {
  name: 'nftPayment',
  serializer: getNftPaymentSerializer,
  mintParser: (context, mintContext, args) => {
    const nftTokenAccount =
      args.tokenAccount ??
      findAssociatedTokenPda(context, {
        mint: args.mint,
        owner: mintContext.minter.publicKey,
      });
    const nftMetadata = findMetadataPda(context, { mint: args.mint });
    const destinationAta = findAssociatedTokenPda(context, {
      mint: args.mint,
      owner: args.destination,
    });
    const associatedTokenProgram = context.programs.getPublicKey(
      'splAssociatedToken',
      'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL'
    );
    return {
      data: new Uint8Array(),
      remainingAccounts: [
        { publicKey: nftTokenAccount, isWritable: true },
        { publicKey: nftMetadata, isWritable: true },
        { publicKey: args.mint, isWritable: false },
        { publicKey: args.destination, isWritable: false },
        { publicKey: destinationAta, isWritable: true },
        { publicKey: associatedTokenProgram, isWritable: false },
      ],
    };
  },
  routeParser: noopParser,
};

export type NftPaymentMintArgs = Omit<NftPaymentArgs, 'requiredCollection'> & {
  /**
   * The mint address of the NFT to pay with.
   * This must be part of the required collection and must
   * belong to the payer.
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
