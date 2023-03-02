import { createAccountWithRent } from '@metaplex-foundation/mpl-essentials';
import { createNft } from '@metaplex-foundation/mpl-token-metadata';
import {
  generateSigner,
  percentAmount,
  transactionBuilder,
} from '@metaplex-foundation/umi';
import test from 'ava';
import { initializeCandyMachine } from '../src';
import { createUmi } from './_setup';

/**
 * Note that most of the tests for the "initializeCandyMachine" instructions are
 * part of the "createCandyMachine" tests as they are more convenient to test.
 */

test('it can initialize a new candy machine account', async (t) => {
  // Given an empty candy machine account.
  const umi = await createUmi();
  const candyMachine = generateSigner(umi);
  await transactionBuilder(umi)
    .add(
      createAccountWithRent(umi, {
        newAccount: candyMachine,
        space: 1000,
        programId: umi.programs.get('mplCandyMachineCore').publicKey,
      })
    )
    .sendAndConfirm();

  // And a collection NFT.
  const collectionMint = generateSigner(umi);
  await transactionBuilder(umi)
    .add(
      createNft(umi, {
        mint: collectionMint,
        name: 'My collection NFT',
        sellerFeeBasisPoints: percentAmount(5.5),
        uri: 'https://example.com/my-collection-nft.json',
        isCollection: true,
      })
    )
    .sendAndConfirm();

  // When
  const creator = generateSigner(umi);
  await transactionBuilder(umi)
    .add(
      initializeCandyMachine(umi, {
        candyMachine: candyMachine.publicKey,
        collectionMint: collectionMint.publicKey,
        collectionUpdateAuthority: umi.identity,
        itemsAvailable: 100,
        sellerFeeBasisPoints: 500,
        creators: [
          { address: creator.publicKey, verified: false, percentageShare: 100 },
        ],
      })
    )
    .sendAndConfirm();

  // Then
  t.pass();
});
