import {
  generateSigner,
  publicKey,
  transactionBuilder,
} from '@metaplex-foundation/umi';
import test from 'ava';
import {
  CandyMachine,
  fetchCandyMachine,
  setCollection,
  setCollectionV2,
} from '../src';
import { createCollectionNft, createUmi, createV1, createV2 } from './_setup';

test.only('it can update the collection of a candy machine v2', async (t) => {
  // Given a Candy Machine associated with Collection A.
  const umi = await createUmi();
  const collectionUpdateAuthorityA = generateSigner(umi);
  const collectionA = await createCollectionNft(umi, {
    authority: collectionUpdateAuthorityA,
  });
  const candyMachine = await createV2(umi, {
    collectionMint: collectionA.publicKey,
    collectionUpdateAuthority: collectionUpdateAuthorityA,
  });

  // When we update its collection to Collection B.
  const collectionUpdateAuthorityB = generateSigner(umi);
  const collectionB = await createCollectionNft(umi, {
    authority: collectionUpdateAuthorityB,
  });
  await setCollectionV2(umi, {
    candyMachine: candyMachine.publicKey,
    collectionMint: collectionA.publicKey,
    collectionUpdateAuthority: collectionUpdateAuthorityA.publicKey,
    newCollectionMint: collectionB.publicKey,
    newCollectionUpdateAuthority: collectionUpdateAuthorityB,
  }).sendAndConfirm(umi);

  // Then the Candy Machine's collection was updated accordingly.
  const candyMachineAccount = await fetchCandyMachine(
    umi,
    candyMachine.publicKey
  );
  t.like(candyMachineAccount, <CandyMachine>{
    collectionMint: publicKey(collectionB.publicKey),
  });
});

test('it cannot update the collection of a candy machine v1', async (t) => {
  // Given a Candy Machine v2 associated with Collection A.
  const umi = await createUmi();
  const collectionUpdateAuthorityA = generateSigner(umi);
  const collectionA = await createCollectionNft(umi, {
    authority: collectionUpdateAuthorityA,
  });
  const candyMachine = await createV1(umi, {
    collectionMint: collectionA.publicKey,
    collectionUpdateAuthority: collectionUpdateAuthorityA,
  });

  // When we try to update its collection using the setCollection v1 instruction.
  const collectionUpdateAuthorityB = generateSigner(umi);
  const collectionB = await createCollectionNft(umi, {
    authority: collectionUpdateAuthorityB,
  });
  const promise = transactionBuilder()
    .add(
      setCollection(umi, {
        candyMachine: candyMachine.publicKey,
        collectionMint: collectionA.publicKey,
        newCollectionMint: collectionB.publicKey,
        newCollectionUpdateAuthority: collectionUpdateAuthorityB,
      })
    )
    .sendAndConfirm(umi);

  // Then we expect a program error.
  await t.throwsAsync(promise, {
    message: /it cannot update the collection of a candy machine v1/,
  });
});
