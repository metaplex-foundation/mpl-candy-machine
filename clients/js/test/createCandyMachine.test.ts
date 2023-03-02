import {
  generateSigner,
  none,
  percentAmount,
  publicKey,
  some,
  transactionBuilder,
} from '@metaplex-foundation/umi';
import test from 'ava';
import {
  AccountVersion,
  CandyMachine,
  createCandyMachine,
  Creator,
  fetchCandyMachine,
} from '../src';
import { createCollectionNft, createUmi } from './_setup';

test('with minimum configuration', async (t) => {
  // Given an existing collection NFT.
  const umi = await createUmi();
  const collectionMint = await createCollectionNft(umi);

  // When we create a new candy machine for that collection.
  const candyMachine = generateSigner(umi);
  const creator = generateSigner(umi);
  await transactionBuilder(umi)
    .add(
      createCandyMachine(umi, {
        candyMachine,
        collectionMint: collectionMint.publicKey,
        collectionUpdateAuthority: umi.identity,
        itemsAvailable: 100,
        sellerFeeBasisPoints: percentAmount(1.23),
        creators: [
          { address: creator.publicKey, verified: false, percentageShare: 100 },
        ],
        configLineSettings: some({
          prefixName: 'My NFT #',
          nameLength: 8,
          prefixUri: 'https://example.com/',
          uriLength: 20,
          isSequential: false,
        }),
      })
    )
    .sendAndConfirm();

  // Then we expect the candy machine account to have the right data.
  const candyMachineAccount = await fetchCandyMachine(
    umi,
    candyMachine.publicKey
  );
  t.like(candyMachineAccount, <CandyMachine>{
    publicKey: publicKey(candyMachine),
    authority: publicKey(umi.identity),
    mintAuthority: publicKey(umi.identity),
    collectionMint: publicKey(collectionMint),
    version: AccountVersion.V1,
    tokenStandard: 0,
    itemsRedeemed: 0n,
    data: {
      itemsAvailable: 100n,
      symbol: '',
      sellerFeeBasisPoints: percentAmount(1.23),
      maxSupply: 0n,
      isMutable: true,
      creators: [
        {
          address: publicKey(creator),
          verified: false,
          percentageShare: 100,
        },
      ] as Creator[],
      configLineSettings: some({
        prefixName: 'My NFT #',
        nameLength: 8,
        prefixUri: 'https://example.com/',
        uriLength: 20,
        isSequential: false,
      }),
      hiddenSettings: none(),
    },
  });
});
