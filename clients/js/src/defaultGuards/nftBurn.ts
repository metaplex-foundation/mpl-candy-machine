import {
  findMasterEditionPda,
  findMetadataPda,
  findTokenRecordPda,
  isProgrammable,
  TokenStandard,
} from '@metaplex-foundation/mpl-token-metadata';
import { findAssociatedTokenPda } from '@metaplex-foundation/mpl-toolbox';
import { PublicKey } from '@metaplex-foundation/umi';
import { getNftBurnSerializer, NftBurn, NftBurnArgs } from '../generated';
import { GuardManifest, GuardRemainingAccount, noopParser } from '../guards';

/**
 * The nftBurn guard restricts the mint to holders of a predefined
 * NFT Collection and burns the holder's NFT when minting.
 *
 * This means the mint address of the NFT to burn must be
 * passed when minting. This guard alone does not limit how many
 * times a holder can mint. A holder can mint as many times
 * as they have NFTs from the required collection to burn.
 */
export const nftBurnGuardManifest: GuardManifest<
  NftBurnArgs,
  NftBurn,
  NftBurnMintArgs
> = {
  name: 'nftBurn',
  serializer: getNftBurnSerializer,
  mintParser: (context, mintContext, args) => {
    const nftTokenAccount =
      args.tokenAccount ??
      findAssociatedTokenPda(context, {
        mint: args.mint,
        owner: mintContext.buyer.publicKey,
      })[0];
    const [nftMetadata] = findMetadataPda(context, { mint: args.mint });
    const [nftMasterEdition] = findMasterEditionPda(context, {
      mint: args.mint,
    });
    const [collectionMetadata] = findMetadataPda(context, {
      mint: args.requiredCollection,
    });

    const remainingAccounts: GuardRemainingAccount[] = [
      { publicKey: nftTokenAccount, isWritable: true },
      { publicKey: nftMetadata, isWritable: true },
      { publicKey: nftMasterEdition, isWritable: true },
      { publicKey: args.mint, isWritable: true },
      { publicKey: collectionMetadata, isWritable: true },
    ];

    if (isProgrammable(args.tokenStandard)) {
      const [nftTokenRecord] = findTokenRecordPda(context, {
        mint: args.mint,
        token: nftTokenAccount,
      });
      remainingAccounts.push({ publicKey: nftTokenRecord, isWritable: true });
    }

    return { data: new Uint8Array(), remainingAccounts };
  },
  routeParser: noopParser,
};

export type NftBurnMintArgs = NftBurnArgs & {
  /**
   * The mint address of the NFT to burn.
   * This must be part of the required collection and must
   * belong to the payer.
   */
  mint: PublicKey;

  /**
   * The token standard of the NFT to burn.
   */
  tokenStandard: TokenStandard;

  /**
   * The token account linking the NFT with its owner.
   *
   * @defaultValue
   * Defaults to the associated token address using the
   * mint address of the NFT and the payer's address.
   */
  tokenAccount?: PublicKey;
};
