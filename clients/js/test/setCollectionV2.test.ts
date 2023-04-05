import { generateSigner, publicKey } from '@metaplex-foundation/umi';
import test from 'ava';
import {
  AccountVersion,
  CandyMachine,
  fetchCandyMachine,
  findCandyMachineAuthorityPda,
  setCollectionV2,
} from '../src';
import { createCollectionNft, createUmi, createV1, createV2 } from './_setup';
import { findCollectionAuthorityRecordPda } from '@metaplex-foundation/mpl-token-metadata';

test('it can update the collection of a candy machine v2', async (t) => {
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

test('it can update the collection of a candy machine v1', async (t) => {
  // Given a Candy Machine associated with Collection A.
  const umi = await createUmi();
  const collectionUpdateAuthorityA = generateSigner(umi);
  const collectionA = await createCollectionNft(umi, {
    authority: collectionUpdateAuthorityA,
  });
  const candyMachine = await createV1(umi, {
    collectionMint: collectionA.publicKey,
    collectionUpdateAuthority: collectionUpdateAuthorityA,
  });

  // When we update its collection to Collection B from a V1 Candy Machine.
  const collectionUpdateAuthorityB = generateSigner(umi);
  const collectionB = await createCollectionNft(umi, {
    authority: collectionUpdateAuthorityB,
  });
  await setCollectionV2(umi, {
    candyMachine: candyMachine.publicKey,
    collectionMint: collectionA.publicKey,
    collectionUpdateAuthority: collectionUpdateAuthorityA.publicKey,
    // We have to explicitly provide the collection authority record
    // because v2 defaults to the new way of deriving delegate records.
    collectionDelegateRecord: findCollectionAuthorityRecordPda(umi, {
      mint: collectionA.publicKey,
      collectionAuthority: findCandyMachineAuthorityPda(umi, {
        candyMachine: candyMachine.publicKey,
      }),
    }),
    newCollectionMint: collectionB.publicKey,
    newCollectionUpdateAuthority: collectionUpdateAuthorityB,
  }).sendAndConfirm(umi);

  // Then the Candy Machine's collection was updated accordingly and
  // the version was upgraded to V2.
  const candyMachineAccount = await fetchCandyMachine(
    umi,
    candyMachine.publicKey
  );
  t.like(candyMachineAccount, <CandyMachine>{
    collectionMint: publicKey(collectionB.publicKey),
    version: AccountVersion.V2,
  });
});
