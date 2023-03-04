/* eslint-disable import/no-extraneous-dependencies */
import { createNft } from '@metaplex-foundation/mpl-token-metadata';
import {
  generateSigner,
  percentAmount,
  Signer,
  some,
  transactionBuilder,
  Umi,
} from '@metaplex-foundation/umi';
import { createUmi as basecreateUmi } from '@metaplex-foundation/umi-bundle-tests';
import {
  mplCandyMachine,
  createCandyMachine as baseCreateCandyMachine,
} from '../src';

export const createUmi = async () =>
  (await basecreateUmi()).use(mplCandyMachine());

export const createCollectionNft = async (
  umi: Umi,
  input: Partial<Parameters<typeof createNft>[1]> = {}
): Promise<Signer> => {
  const collectionMint = generateSigner(umi);
  await transactionBuilder(umi)
    .add(
      createNft(umi, {
        mint: collectionMint,
        name: 'My collection NFT',
        sellerFeeBasisPoints: percentAmount(10),
        uri: 'https://example.com/my-collection-nft.json',
        isCollection: true,
        ...input,
      })
    )
    .sendAndConfirm();

  return collectionMint;
};

export const createCandyMachine = async (
  umi: Umi,
  input: Partial<Parameters<typeof baseCreateCandyMachine>[1]> = {}
) => {
  const candyMachine = input.candyMachine ?? generateSigner(umi);
  const collectionMint =
    input.collectionMint ?? (await createCollectionNft(umi)).publicKey;
  await transactionBuilder(umi)
    .add(
      baseCreateCandyMachine(umi, {
        collectionUpdateAuthority: umi.identity,
        itemsAvailable: 100,
        sellerFeeBasisPoints: percentAmount(10),
        creators: [],
        configLineSettings: some({
          prefixName: '',
          nameLength: 32,
          prefixUri: '',
          uriLength: 200,
          isSequential: false,
        }),
        ...input,
        candyMachine,
        collectionMint,
      })
    )
    .sendAndConfirm();

  return candyMachine;
};
