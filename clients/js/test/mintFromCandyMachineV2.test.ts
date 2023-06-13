import {
  createAssociatedToken,
  createMint,
  createMintWithAssociatedToken,
  setComputeUnitLimit,
} from '@metaplex-foundation/mpl-toolbox';
import { findCollectionAuthorityRecordPda } from '@metaplex-foundation/mpl-token-metadata';
import { generateSigner, transactionBuilder } from '@metaplex-foundation/umi';
import test from 'ava';
import {
  CandyMachine,
  fetchCandyMachine,
  findCandyMachineAuthorityPda,
  mintFromCandyMachineV2,
} from '../src';
import {
  assertSuccessfulMint,
  createCollectionNft,
  createUmi,
  createV1,
  createV2,
} from './_setup';

test('it can mint directly from a candy machine as the mint authority', async (t) => {
  // Given a loaded candy machine.
  const umi = await createUmi();
  const collectionMint = (await createCollectionNft(umi)).publicKey;
  const candyMachineSigner = await createV2(umi, {
    collectionMint,
    configLines: [
      { name: 'Degen #1', uri: 'https://example.com/degen/1' },
      { name: 'Degen #2', uri: 'https://example.com/degen/2' },
    ],
  });
  const candyMachine = candyMachineSigner.publicKey;

  // When we mint a new NFT directly from the candy machine as the mint authority.
  const mint = generateSigner(umi);
  const owner = generateSigner(umi).publicKey;
  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 400000 }))
    .add(
      mintFromCandyMachineV2(umi, {
        candyMachine,
        mintAuthority: umi.identity,
        nftOwner: owner,
        nftMint: mint,
        collectionMint,
        collectionUpdateAuthority: umi.identity.publicKey,
      })
    )
    .sendAndConfirm(umi);

  // Then the mint was successful.
  await assertSuccessfulMint(t, umi, { mint, owner });

  // And the candy machine was updated.
  const candyMachineAccount = await fetchCandyMachine(umi, candyMachine);
  t.like(candyMachineAccount, <CandyMachine>{ itemsRedeemed: 1n });
});

test('it can mint whilst creating the mint and token accounts beforehand', async (t) => {
  // Given a loaded candy machine.
  const umi = await createUmi();
  const collectionMint = (await createCollectionNft(umi)).publicKey;
  const candyMachineSigner = await createV2(umi, {
    collectionMint,
    configLines: [
      { name: 'Degen #1', uri: 'https://example.com/degen/1' },
      { name: 'Degen #2', uri: 'https://example.com/degen/2' },
    ],
  });
  const candyMachine = candyMachineSigner.publicKey;

  // When we mint a new NFT directly from the candy machine as the mint authority.
  const mint = generateSigner(umi);
  const owner = generateSigner(umi).publicKey;
  await transactionBuilder()
    .add(createMint(umi, { mint }))
    .add(createAssociatedToken(umi, { mint: mint.publicKey, owner }))
    .add(
      mintFromCandyMachineV2(umi, {
        candyMachine,
        mintAuthority: umi.identity,
        nftOwner: owner,
        nftMint: mint.publicKey,
        collectionMint,
        collectionUpdateAuthority: umi.identity.publicKey,
      })
    )
    .sendAndConfirm(umi);

  // Then the mint was successful.
  await assertSuccessfulMint(t, umi, { mint, owner });
});

test('it can mint whilst creating only the mint account beforehand', async (t) => {
  // Given a loaded candy machine.
  const umi = await createUmi();
  const collectionMint = (await createCollectionNft(umi)).publicKey;
  const candyMachineSigner = await createV2(umi, {
    collectionMint,
    configLines: [
      { name: 'Degen #1', uri: 'https://example.com/degen/1' },
      { name: 'Degen #2', uri: 'https://example.com/degen/2' },
    ],
  });
  const candyMachine = candyMachineSigner.publicKey;

  // When we mint a new NFT directly from the candy machine as the mint authority.
  const mint = generateSigner(umi);
  const owner = generateSigner(umi).publicKey;
  await transactionBuilder()
    .add(createMint(umi, { mint }))
    .add(
      mintFromCandyMachineV2(umi, {
        candyMachine,
        mintAuthority: umi.identity,
        nftOwner: owner,
        nftMint: mint.publicKey,
        collectionMint,
        collectionUpdateAuthority: umi.identity.publicKey,
      })
    )
    .sendAndConfirm(umi);

  // Then the mint was successful.
  await assertSuccessfulMint(t, umi, { mint, owner });
});

test('it cannot mint directly from a candy machine if we are not the mint authority', async (t) => {
  // Given a loaded candy machine with a mint authority A.
  const umi = await createUmi();
  const mintAuthorityA = generateSigner(umi);
  const collectionMint = await createCollectionNft(umi, {
    authority: mintAuthorityA,
  });
  const candyMachineSigner = await createV2(umi, {
    authority: mintAuthorityA.publicKey,
    collectionMint: collectionMint.publicKey,
    collectionUpdateAuthority: mintAuthorityA,
    configLines: [
      { name: 'Degen #1', uri: 'https://example.com/degen/1' },
      { name: 'Degen #2', uri: 'https://example.com/degen/2' },
    ],
  });
  const candyMachine = candyMachineSigner.publicKey;

  // When we try to mint directly from the candy machine as mint authority B.
  const mintAuthorityB = generateSigner(umi);
  const mint = generateSigner(umi);
  const owner = generateSigner(umi).publicKey;
  const promise = transactionBuilder()
    .add(createMintWithAssociatedToken(umi, { mint, owner, amount: 1 }))
    .add(
      mintFromCandyMachineV2(umi, {
        candyMachine,
        mintAuthority: mintAuthorityB,
        nftMint: mint.publicKey,
        nftOwner: owner,
        collectionMint: collectionMint.publicKey,
        collectionUpdateAuthority: umi.identity.publicKey,
      })
    )
    .sendAndConfirm(umi);

  // Then we expect a program error.
  await t.throwsAsync(promise, {
    message: /A has one constraint was violated/,
  });

  // And the candy machine stayed the same.
  const candyMachineAccount = await fetchCandyMachine(umi, candyMachine);
  t.like(candyMachineAccount, <CandyMachine>{ itemsRedeemed: 0n });
});

test('it can mint from a candy machine v1', async (t) => {
  // Given a loaded candy machine v1.
  const umi = await createUmi();
  const collectionMint = (await createCollectionNft(umi)).publicKey;
  const candyMachineSigner = await createV1(umi, {
    collectionMint,
    configLines: [
      { name: 'Degen #1', uri: 'https://example.com/degen/1' },
      { name: 'Degen #2', uri: 'https://example.com/degen/2' },
    ],
  });
  const candyMachine = candyMachineSigner.publicKey;

  // When mint from it directly usint the mint v2 instruction.
  const mint = generateSigner(umi);
  const owner = generateSigner(umi).publicKey;
  await transactionBuilder()
    .add(createMintWithAssociatedToken(umi, { mint, owner, amount: 1 }))
    .add(
      mintFromCandyMachineV2(umi, {
        candyMachine,
        mintAuthority: umi.identity,
        nftMint: mint.publicKey,
        nftOwner: owner,
        collectionMint,
        collectionUpdateAuthority: umi.identity.publicKey,
        // We have to explicitly provide the collection authority record
        // because v2 defaults to the new way of deriving delegate records.
        collectionDelegateRecord: findCollectionAuthorityRecordPda(umi, {
          mint: collectionMint,
          collectionAuthority: findCandyMachineAuthorityPda(umi, {
            candyMachine,
          })[0],
        }),
      })
    )
    .sendAndConfirm(umi);

  // Then the mint was successful.
  await assertSuccessfulMint(t, umi, { mint, owner });
});
