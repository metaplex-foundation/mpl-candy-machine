import {
  generateSigner,
  none,
  publicKey,
  transactionBuilder,
} from '@metaplex-foundation/umi';
import test from 'ava';
import { CandyMachine, fetchCandyMachine, setCollection } from '../src';
import { createCandyMachine, createCollectionNft, createUmi } from './_setup';

test('it can update the collection of a candy machine', async (t) => {
  // Given a Candy Machine associated with Collection A.
  const umi = await createUmi();
  const collectionUpdateAuthorityA = generateSigner(umi);
  const collectionA = await createCollectionNft(umi, {
    updateAuthority: collectionUpdateAuthorityA.publicKey,
    creators: none(),
  });
  const candyMachine = await createCandyMachine(umi, {
    collectionMint: collectionA.publicKey,
    collectionUpdateAuthority: collectionUpdateAuthorityA,
  });

  // When we update its collection to Collection B.
  const collectionUpdateAuthorityB = generateSigner(umi);
  const collectionB = await createCollectionNft(umi, {
    updateAuthority: collectionUpdateAuthorityB.publicKey,
    creators: none(),
  });
  await transactionBuilder(umi)
    .add(
      setCollection(umi, {
        candyMachine: candyMachine.publicKey,
        collectionMint: collectionA.publicKey,
        newCollectionMint: collectionB.publicKey,
        newCollectionUpdateAuthority: collectionUpdateAuthorityB,
      })
    )
    .sendAndConfirm();

  // Then the Candy Machine's collection was updated accordingly.
  const candyMachineAccount = await fetchCandyMachine(
    umi,
    candyMachine.publicKey
  );
  t.like(candyMachineAccount, <CandyMachine>{
    collectionMint: publicKey(collectionB.publicKey),
  });
});
