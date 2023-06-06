import { createAccountWithRent } from '@metaplex-foundation/mpl-toolbox';
import { TokenStandard } from '@metaplex-foundation/mpl-token-metadata';
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
  Creator,
  fetchCandyMachine,
  initializeCandyMachine,
} from '../src';
import { createCollectionNft, createUmi } from './_setup';

/**
 * Note that most of the tests for the "initializeCandyMachine" instructions are
 * part of the "createCandyMachine" tests as they are more convenient to test.
 */

test('it can initialize a new candy machine account', async (t) => {
  // Given an empty candy machine account with a big enough size.
  const umi = await createUmi();
  const candyMachine = generateSigner(umi);
  await transactionBuilder()
    .add(
      createAccountWithRent(umi, {
        newAccount: candyMachine,
        space: 5000,
        programId: umi.programs.get('mplCandyMachineCore').publicKey,
      })
    )
    .sendAndConfirm(umi);

  // And a collection NFT.
  const collectionMint = await createCollectionNft(umi);

  // When we initialize a candy machine at this address.
  const creator = generateSigner(umi);
  await transactionBuilder()
    .add(
      initializeCandyMachine(umi, {
        candyMachine: candyMachine.publicKey,
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
    .sendAndConfirm(umi);

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
    tokenStandard: TokenStandard.NonFungible,
    itemsRedeemed: 0n,
    data: {
      itemsAvailable: 100n,
      symbol: '',
      sellerFeeBasisPoints: percentAmount(1.23),
      maxEditionSupply: 0n,
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
