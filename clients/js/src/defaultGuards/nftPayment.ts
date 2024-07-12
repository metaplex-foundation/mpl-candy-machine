import {
  findMasterEditionPda,
  findMetadataPda,
  findTokenRecordPda,
  isProgrammable,
  TokenStandard,
} from '@metaplex-foundation/mpl-token-metadata';
import {
  findAssociatedTokenPda,
  getSplAssociatedTokenProgramId,
} from '@metaplex-foundation/mpl-toolbox';
import { PublicKey } from '@metaplex-foundation/umi';
import {
  getNftPaymentSerializer,
  NftPayment,
  NftPaymentArgs,
} from '../generated';
import { GuardManifest, GuardRemainingAccount, noopParser } from '../guards';
import { getMplTokenAuthRulesProgramId } from '../programs';

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
        owner: mintContext.buyer.publicKey,
      })[0];
    const [nftMetadata] = findMetadataPda(context, { mint: args.mint });
    const [destinationAta] = findAssociatedTokenPda(context, {
      mint: args.mint,
      owner: args.destination,
    });

    const remainingAccounts: GuardRemainingAccount[] = [
      { publicKey: nftTokenAccount, isWritable: true },
      { publicKey: nftMetadata, isWritable: true },
      { publicKey: args.mint, isWritable: false },
      { publicKey: args.destination, isWritable: false },
      { publicKey: destinationAta, isWritable: true },
      {
        publicKey: getSplAssociatedTokenProgramId(context),
        isWritable: false,
      },
    ];

    if (isProgrammable(args.tokenStandard)) {
      const [nftMasterEdition] = findMasterEditionPda(context, {
        mint: args.mint,
      });
      const [ownerTokenRecord] = findTokenRecordPda(context, {
        mint: args.mint,
        token: nftTokenAccount,
      });
      const [destinationTokenRecord] = findTokenRecordPda(context, {
        mint: args.mint,
        token: destinationAta,
      });
      const tokenAuthRules = getMplTokenAuthRulesProgramId(context);
      remainingAccounts.push(
        ...[
          { publicKey: nftMasterEdition, isWritable: false },
          { publicKey: ownerTokenRecord, isWritable: true },
          { publicKey: destinationTokenRecord, isWritable: true },
        ]
      );

      if (args.ruleSet) {
        remainingAccounts.push(
          ...[
            { publicKey: tokenAuthRules, isWritable: false },
            { publicKey: args.ruleSet, isWritable: false },
          ]
        );
      }
    }

    return { data: new Uint8Array(), remainingAccounts };
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
   * The token standard of the NFT used to pay.
   */
  tokenStandard: TokenStandard;

  /**
   * The ruleSet of the PNFT used to pay, if any.
   *
   * @defaultValue Default to not using a ruleSet.
   */
  ruleSet?: PublicKey;

  /**
   * The token account linking the NFT with its owner.
   *
   * @defaultValue
   * Defaults to the associated token address using the
   * mint address of the NFT and the payer's address.
   */
  tokenAccount?: PublicKey;
};
