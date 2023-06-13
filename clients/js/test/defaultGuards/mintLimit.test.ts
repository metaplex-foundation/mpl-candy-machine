import { setComputeUnitLimit } from '@metaplex-foundation/mpl-toolbox';
import {
  generateSigner,
  sol,
  some,
  transactionBuilder,
} from '@metaplex-foundation/umi';
import test from 'ava';
import {
  fetchMintCounter,
  findCandyGuardPda,
  findMintCounterPda,
  mintV2,
} from '../../src';
import {
  assertBotTax,
  assertSuccessfulMint,
  createCollectionNft,
  createUmi,
  createV2,
} from '../_setup';

test('it allows minting when the mint limit is not reached', async (t) => {
  // Given a loaded Candy Machine with a mint limit of 5.
  const umi = await createUmi();
  const collectionMint = (await createCollectionNft(umi)).publicKey;
  const { publicKey: candyMachine } = await createV2(umi, {
    collectionMint,
    configLines: [
      { name: 'Degen #1', uri: 'https://example.com/degen/1' },
      { name: 'Degen #2', uri: 'https://example.com/degen/2' },
    ],
    guards: {
      mintLimit: some({ id: 1, limit: 5 }),
    },
  });

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
        mintArgs: { mintLimit: some({ id: 1 }) },
      })
    )
    .sendAndConfirm(umi);

  // Then minting was successful.
  await assertSuccessfulMint(t, umi, { mint, owner: umi.identity });

  // And the mint limit PDA was incremented.
  const counterPda = findMintCounterPda(umi, {
    id: 1,
    user: umi.identity.publicKey,
    candyMachine,
    candyGuard: findCandyGuardPda(umi, { base: candyMachine })[0],
  });
  const counterAccount = await fetchMintCounter(umi, counterPda);
  t.is(counterAccount.count, 1);
});

test('it allows minting even when the payer is different from the minter', async (t) => {
  // Given a loaded Candy Machine with a mint limit of 5.
  const umi = await createUmi();
  const collectionMint = (await createCollectionNft(umi)).publicKey;
  const { publicKey: candyMachine } = await createV2(umi, {
    collectionMint,
    configLines: [
      { name: 'Degen #1', uri: 'https://example.com/degen/1' },
      { name: 'Degen #2', uri: 'https://example.com/degen/2' },
    ],
    guards: {
      mintLimit: some({ id: 1, limit: 5 }),
    },
  });

  // When we mint from it using a separate minter.
  const minter = generateSigner(umi);
  const mint = generateSigner(umi);
  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      mintV2(umi, {
        candyMachine,
        nftMint: mint,
        minter,
        collectionMint,
        collectionUpdateAuthority: umi.identity.publicKey,
        mintArgs: { mintLimit: some({ id: 1 }) },
      })
    )
    .sendAndConfirm(umi);

  // Then minting was successful.
  await assertSuccessfulMint(t, umi, { mint, owner: minter });

  // And the mint limit PDA was incremented for that minter.
  const counterPda = findMintCounterPda(umi, {
    id: 1,
    user: minter.publicKey,
    candyMachine,
    candyGuard: findCandyGuardPda(umi, { base: candyMachine })[0],
  });
  const counterAccount = await fetchMintCounter(umi, counterPda);
  t.is(counterAccount.count, 1);
});

test('it forbids minting when the mint limit is reached', async (t) => {
  // Given a loaded Candy Machine with a mint limit of 1.
  const umi = await createUmi();
  const collectionMint = (await createCollectionNft(umi)).publicKey;
  const { publicKey: candyMachine } = await createV2(umi, {
    collectionMint,
    configLines: [
      { name: 'Degen #1', uri: 'https://example.com/degen/1' },
      { name: 'Degen #2', uri: 'https://example.com/degen/2' },
    ],
    guards: {
      mintLimit: some({ id: 42, limit: 1 }),
    },
  });

  // And the identity already minted their NFT.
  const mint = generateSigner(umi);
  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      mintV2(umi, {
        candyMachine,
        nftMint: mint,
        collectionMint,
        collectionUpdateAuthority: umi.identity.publicKey,
        mintArgs: { mintLimit: some({ id: 42 }) },
      })
    )
    .sendAndConfirm(umi);

  // When that same identity tries to mint from the same Candy Machine again.
  const promise = transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      mintV2(umi, {
        candyMachine,
        nftMint: generateSigner(umi),
        collectionMint,
        collectionUpdateAuthority: umi.identity.publicKey,
        mintArgs: { mintLimit: some({ id: 42 }) },
      })
    )
    .sendAndConfirm(umi);

  // Then we expect an error.
  await t.throwsAsync(promise, { message: /AllowedMintLimitReached/ });
});

test('the mint limit is local to each wallet', async (t) => {
  // Given a loaded Candy Machine with a mint limit of 1.
  const umi = await createUmi();
  const collectionMint = (await createCollectionNft(umi)).publicKey;
  const { publicKey: candyMachine } = await createV2(umi, {
    collectionMint,
    configLines: [
      { name: 'Degen #1', uri: 'https://example.com/degen/1' },
      { name: 'Degen #2', uri: 'https://example.com/degen/2' },
    ],
    guards: {
      mintLimit: some({ id: 42, limit: 1 }),
    },
  });

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
        mintArgs: { mintLimit: some({ id: 42 }) },
      })
    )
    .sendAndConfirm(umi);
  await assertSuccessfulMint(t, umi, { mint: mintA, owner: minterA });

  // When minter B mints from the same Candy Machine.
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
        mintArgs: { mintLimit: some({ id: 42 }) },
      })
    )
    .sendAndConfirm(umi);

  // Then minting was successful as the limit is per wallet.
  await assertSuccessfulMint(t, umi, { mint: mintB, owner: minterB });
});

test('it charges a bot tax when trying to mint after the limit', async (t) => {
  // Given a loaded Candy Machine with a mint limit of 1 and a bot tax guard.
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
      mintLimit: some({ id: 42, limit: 1 }),
    },
  });

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
        mintArgs: { mintLimit: some({ id: 42 }) },
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
        mintArgs: { mintLimit: some({ id: 42 }) },
      })
    )
    .sendAndConfirm(umi);

  // Then we expect a bot tax error.
  await assertBotTax(t, umi, mintB, signature, /AllowedMintLimitReached/);
});
