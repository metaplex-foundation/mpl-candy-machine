import { setComputeUnitLimit } from '@metaplex-foundation/mpl-toolbox';
import {
  generateSigner,
  sol,
  some,
  transactionBuilder,
} from '@metaplex-foundation/umi';
import test from 'ava';
import {
  fetchAllocationTracker,
  findCandyGuardPda,
  findAllocationTrackerPda,
  mintV2,
  route,
} from '../../src';
import {
  assertBotTax,
  assertSuccessfulMint,
  createCollectionNft,
  createUmi,
  createV2,
} from '../_setup';

test('it allows minting when the allocation limit is not reached', async (t) => {
  // Given a loaded Candy Machine with an allocation limit of 5.
  const umi = await createUmi();
  const collectionMint = (await createCollectionNft(umi)).publicKey;
  const { publicKey: candyMachine } = await createV2(umi, {
    collectionMint,
    configLines: [
      { name: 'Degen #1', uri: 'https://example.com/degen/1' },
      { name: 'Degen #2', uri: 'https://example.com/degen/2' },
    ],
    guards: {
      allocation: some({ id: 1, limit: 5 }),
    },
  });

  // And initialize the allocation PDA.
  await transactionBuilder()
    .add(
      route(umi, {
        candyMachine,
        guard: 'allocation',
        routeArgs: {
          id: 1,
          candyGuardAuthority: umi.identity,
        },
      })
    )
    .sendAndConfirm(umi);

  // When we mint from it.
  const mint = generateSigner(umi);
  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      mintV2(umi, {
        candyMachine,
        nftMint: mint,
        collectionMint,
        collectionUpdateAuthority: umi.identity.publicKey,
        mintArgs: { allocation: some({ id: 1 }) },
      })
    )
    .sendAndConfirm(umi);

  // Then minting was successful.
  await assertSuccessfulMint(t, umi, { mint, owner: umi.identity });

  // And the mint tracker PDA was incremented.
  const trackerPda = findAllocationTrackerPda(umi, {
    id: 1,
    candyMachine,
    candyGuard: findCandyGuardPda(umi, { base: candyMachine })[0],
  });
  const trackerPdaAccount = await fetchAllocationTracker(umi, trackerPda);
  t.is(trackerPdaAccount.count, 1);
});

test('it forbids minting when the allocation limit is reached', async (t) => {
  // Given a loaded Candy Machine with an allocation limit of 1.
  const umi = await createUmi();
  const collectionMint = (await createCollectionNft(umi)).publicKey;
  const { publicKey: candyMachine } = await createV2(umi, {
    collectionMint,
    configLines: [
      { name: 'Degen #1', uri: 'https://example.com/degen/1' },
      { name: 'Degen #2', uri: 'https://example.com/degen/2' },
    ],
    guards: {
      allocation: some({ id: 1, limit: 1 }),
    },
  });

  // And initialize the allocation PDA.
  await transactionBuilder()
    .add(
      route(umi, {
        candyMachine,
        guard: 'allocation',
        routeArgs: {
          id: 1,
          candyGuardAuthority: umi.identity,
        },
      })
    )
    .sendAndConfirm(umi);

  // And we already minted from it.
  const mint = generateSigner(umi);
  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      mintV2(umi, {
        candyMachine,
        nftMint: mint,
        collectionMint,
        collectionUpdateAuthority: umi.identity.publicKey,
        mintArgs: { allocation: some({ id: 1 }) },
      })
    )
    .sendAndConfirm(umi);

  // When we try to mint again.
  const promise = transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      mintV2(umi, {
        candyMachine,
        nftMint: mint,
        collectionMint,
        collectionUpdateAuthority: umi.identity.publicKey,
        mintArgs: { allocation: some({ id: 1 }) },
      })
    )
    .sendAndConfirm(umi);

  // Then we expect an error.
  await t.throwsAsync(promise, { message: /Allocation limit was reached/ });
});

test('the allocation limit is local to each id', async (t) => {
  // Given a loaded Candy Machine with two allocation limits of 1.
  const umi = await createUmi();
  const collectionMint = (await createCollectionNft(umi)).publicKey;
  const { publicKey: candyMachine } = await createV2(umi, {
    collectionMint,
    configLines: [
      { name: 'Degen #1', uri: 'https://example.com/degen/1' },
      { name: 'Degen #2', uri: 'https://example.com/degen/2' },
    ],
    guards: {},
    groups: [
      {
        label: 'GROUPA',
        guards: {
          allocation: some({ id: 1, limit: 1 }),
        },
      },
      {
        label: 'GROUPB',
        guards: {
          allocation: some({ id: 2, limit: 1 }),
        },
      },
    ],
  });

  // And initialize the allocation PDA.
  await transactionBuilder()
    .add(
      route(umi, {
        candyMachine,
        guard: 'allocation',
        routeArgs: {
          id: 1,
          candyGuardAuthority: umi.identity,
        },
        group: some('GROUPA'),
      })
    )
    .add(
      route(umi, {
        candyMachine,
        guard: 'allocation',
        routeArgs: {
          id: 2,
          candyGuardAuthority: umi.identity,
        },
        group: some('GROUPB'),
      })
    )
    .sendAndConfirm(umi);

  // And minter A already minted their NFT.
  const minterA = generateSigner(umi);
  const mintA = generateSigner(umi);
  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      mintV2(umi, {
        candyMachine,
        nftMint: mintA,
        minter: minterA,
        collectionMint,
        collectionUpdateAuthority: umi.identity.publicKey,
        mintArgs: { allocation: some({ id: 1 }) },
        group: some('GROUPA'),
      })
    )
    .sendAndConfirm(umi);
  await assertSuccessfulMint(t, umi, { mint: mintA, owner: minterA });

  // When minter B mints from the same Candy Machine but from a different group.
  const minterB = generateSigner(umi);
  const mintB = generateSigner(umi);
  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      mintV2(umi, {
        candyMachine,
        nftMint: mintB,
        minter: minterB,
        collectionMint,
        collectionUpdateAuthority: umi.identity.publicKey,
        mintArgs: { allocation: some({ id: 2 }) },
        group: some('GROUPB'),
      })
    )
    .sendAndConfirm(umi);

  // Then minting was successful as the limit is per id.
  await assertSuccessfulMint(t, umi, { mint: mintB, owner: minterB });
});

test('it charges a bot tax when trying to mint after the limit', async (t) => {
  // Given a loaded Candy Machine with an allocation limit of 1 and a bot tax guard.
  const umi = await createUmi();
  const collectionMint = (await createCollectionNft(umi)).publicKey;
  const { publicKey: candyMachine } = await createV2(umi, {
    collectionMint,
    configLines: [
      { name: 'Degen #1', uri: 'https://example.com/degen/1' },
      { name: 'Degen #2', uri: 'https://example.com/degen/2' },
    ],
    guards: {
      botTax: some({ lamports: sol(0.1), lastInstruction: true }),
      allocation: some({ id: 1, limit: 1 }),
    },
  });

  // And initialize the allocation PDA.
  await transactionBuilder()
    .add(
      route(umi, {
        candyMachine,
        guard: 'allocation',
        routeArgs: {
          id: 1,
          candyGuardAuthority: umi.identity,
        },
      })
    )
    .sendAndConfirm(umi);

  // And the identity already minted their NFT.
  const mintA = generateSigner(umi);
  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      mintV2(umi, {
        candyMachine,
        nftMint: mintA,
        collectionMint,
        collectionUpdateAuthority: umi.identity.publicKey,
        mintArgs: { allocation: some({ id: 1 }) },
      })
    )
    .sendAndConfirm(umi);

  // When the identity tries to mint from the same Candy Machine again.
  const mintB = generateSigner(umi);
  const { signature } = await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      mintV2(umi, {
        candyMachine,
        nftMint: mintB,
        collectionMint,
        collectionUpdateAuthority: umi.identity.publicKey,
        mintArgs: { allocation: some({ id: 1 }) },
      })
    )
    .sendAndConfirm(umi);

  // Then we expect a bot tax error.
  await assertBotTax(t, umi, mintB, signature, /Allocation limit was reached/);
});
