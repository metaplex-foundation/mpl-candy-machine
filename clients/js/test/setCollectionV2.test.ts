import {
  generateSigner,
  publicKey,
  transactionBuilder,
} from '@metaplex-foundation/umi';
import test from 'ava';
import {
  findCollectionAuthorityRecordPda,
  updateV1,
} from '@metaplex-foundation/mpl-token-metadata';
import {
  AccountVersion,
  CandyMachine,
  fetchCandyMachine,
  findCandyMachineAuthorityPda,
  mintFromCandyMachineV2,
  setCollectionV2,
} from '../src';
import { createCollectionNft, createUmi, createV1, createV2 } from './_setup';
import { setComputeUnitLimit } from '@metaplex-foundation/mpl-toolbox';

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
      })[0],
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

test('it cannot update the collection of a candy machine when mint is in progress', async (t) => {
  // Given a Candy Machine associated with Collection A.
  const umi = await createUmi();
  const collectionUpdateAuthorityA = umi.identity;
  const collectionA = await createCollectionNft(umi);
  const candyMachine = await createV2(umi, {
    collectionMint: collectionA.publicKey,
    collectionUpdateAuthority: collectionUpdateAuthorityA,
    configLines: [
      { name: 'Degen #1', uri: 'https://example.com/degen/1' },
      { name: 'Degen #2', uri: 'https://example.com/degen/2' },
    ],
  });

  // And we mint an NFT from the candy machine.
  const mint = generateSigner(umi);
  const owner = generateSigner(umi).publicKey;
  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 400000 }))
    .add(
      mintFromCandyMachineV2(umi, {
        candyMachine: publicKey(candyMachine),
        mintAuthority: umi.identity,
        nftOwner: owner,
        nftMint: mint,
        collectionMint: publicKey(collectionA),
        collectionUpdateAuthority: publicKey(collectionUpdateAuthorityA),
      })
    )
    .sendAndConfirm(umi);

  // When we try to update its collection to Collection B.
  const collectionUpdateAuthorityB = generateSigner(umi);
  const collectionB = await createCollectionNft(umi, {
    authority: collectionUpdateAuthorityB,
  });
  const promise = setCollectionV2(umi, {
    candyMachine: candyMachine.publicKey,
    collectionMint: collectionA.publicKey,
    collectionUpdateAuthority: collectionUpdateAuthorityA.publicKey,
    newCollectionMint: collectionB.publicKey,
    newCollectionUpdateAuthority: collectionUpdateAuthorityB,
  }).sendAndConfirm(umi);

  // Then we expect a client error.
  await t.throwsAsync(promise, {
    name: 'NoChangingCollectionDuringMint',
  });
});

test.only('it can set the same collection of a candy machine when mint is in progress', async (t) => {
  // Given a Candy Machine associated with Collection A.
  const umi = await createUmi();
  const collectionUpdateAuthorityA = umi.identity;
  const collectionA = await createCollectionNft(umi);
  const candyMachine = await createV2(umi, {
    collectionMint: collectionA.publicKey,
    collectionUpdateAuthority: collectionUpdateAuthorityA,
    configLines: [
      { name: 'Degen #1', uri: 'https://example.com/degen/1' },
      { name: 'Degen #2', uri: 'https://example.com/degen/2' },
    ],
  });

  // And we mint an NFT from the candy machine.
  const mint = generateSigner(umi);
  const owner = generateSigner(umi).publicKey;
  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 400000 }))
    .add(
      mintFromCandyMachineV2(umi, {
        candyMachine: publicKey(candyMachine),
        mintAuthority: umi.identity,
        nftOwner: owner,
        nftMint: mint,
        collectionMint: publicKey(collectionA),
        collectionUpdateAuthority: publicKey(collectionUpdateAuthorityA),
      })
    )
    .sendAndConfirm(umi);

  // And we update the collection update authority to Authority B.
  const collectionUpdateAuthorityB = generateSigner(umi);
  await updateV1(umi, {
    mint: collectionA.publicKey,
    newUpdateAuthority: collectionUpdateAuthorityB.publicKey,
  }).sendAndConfirm(umi);

  // When we set the same collection.
  await setCollectionV2(umi, {
    candyMachine: candyMachine.publicKey,
    collectionMint: collectionA.publicKey,
    collectionUpdateAuthority: collectionUpdateAuthorityA.publicKey,
    newCollectionMint: collectionA.publicKey,
    newCollectionUpdateAuthority: collectionUpdateAuthorityB,
  }).sendAndConfirm(umi);

  // Then the transaction suceeds and the Candy Machine collection is still the same.
  const candyMachineAccount = await fetchCandyMachine(
    umi,
    candyMachine.publicKey
  );
  t.like(candyMachineAccount, <CandyMachine>{
    collectionMint: publicKey(collectionA.publicKey),
  });
});
