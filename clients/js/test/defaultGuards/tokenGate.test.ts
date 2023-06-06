import {
  createMintWithAssociatedToken,
  fetchToken,
  findAssociatedTokenPda,
  setComputeUnitLimit,
} from '@metaplex-foundation/mpl-toolbox';
import {
  generateSigner,
  sol,
  some,
  transactionBuilder,
} from '@metaplex-foundation/umi';
import test from 'ava';
import { mintV2 } from '../../src';
import {
  assertBotTax,
  assertSuccessfulMint,
  createCollectionNft,
  createUmi,
  createV2,
} from '../_setup';

test('it allows minting when the payer owns a specific token', async (t) => {
  // Given a payer with one token.
  const umi = await createUmi();
  const tokenMint = generateSigner(umi);
  await transactionBuilder()
    .add(
      createMintWithAssociatedToken(umi, {
        mint: tokenMint,
        owner: umi.identity.publicKey,
        amount: 1,
      })
    )
    .sendAndConfirm(umi);

  // And a loaded Candy Machine with the token gate guard.
  const collectionMint = (await createCollectionNft(umi)).publicKey;
  const { publicKey: candyMachine } = await createV2(umi, {
    collectionMint,
    configLines: [{ name: 'Degen #1', uri: 'https://example.com/degen/1' }],
    guards: {
      tokenGate: some({ mint: tokenMint.publicKey, amount: 1 }),
    },
  });

  // When the payer mints from it.
  const mint = generateSigner(umi);
  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      mintV2(umi, {
        candyMachine,
        nftMint: mint,
        collectionMint,
        collectionUpdateAuthority: umi.identity.publicKey,
        mintArgs: {
          tokenGate: some({ mint: tokenMint.publicKey }),
        },
      })
    )
    .sendAndConfirm(umi);

  // Then minting was successful.
  await assertSuccessfulMint(t, umi, { mint, owner: umi.identity });
});

test('it allows minting even when the payer is different from the minter', async (t) => {
  // Given an explicit minter with one token.
  const umi = await createUmi();
  const minter = generateSigner(umi);
  const tokenMint = generateSigner(umi);
  await transactionBuilder()
    .add(
      createMintWithAssociatedToken(umi, {
        mint: tokenMint,
        owner: minter.publicKey,
        amount: 1,
      })
    )
    .sendAndConfirm(umi);

  // And a loaded Candy Machine with the token gate guard.
  const collectionMint = (await createCollectionNft(umi)).publicKey;
  const { publicKey: candyMachine } = await createV2(umi, {
    collectionMint,
    configLines: [{ name: 'Degen #1', uri: 'https://example.com/degen/1' }],
    guards: {
      tokenGate: some({ mint: tokenMint.publicKey, amount: 1 }),
    },
  });

  // When the minter mints from it.
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
        mintArgs: {
          tokenGate: some({ mint: tokenMint.publicKey }),
        },
      })
    )
    .sendAndConfirm(umi);

  // Then minting was successful.
  await assertSuccessfulMint(t, umi, { mint, owner: minter });
});

test('it allows minting when the payer owns multiple tokens from a specific mint', async (t) => {
  // Given a payer with 42 tokens.
  const umi = await createUmi();
  const tokenMint = generateSigner(umi);
  await transactionBuilder()
    .add(
      createMintWithAssociatedToken(umi, {
        mint: tokenMint,
        owner: umi.identity.publicKey,
        amount: 42,
      })
    )
    .sendAndConfirm(umi);

  // And a loaded Candy Machine with the token gate guard that requires 5 tokens.
  const collectionMint = (await createCollectionNft(umi)).publicKey;
  const { publicKey: candyMachine } = await createV2(umi, {
    collectionMint,
    configLines: [{ name: 'Degen #1', uri: 'https://example.com/degen/1' }],
    guards: {
      tokenGate: some({ mint: tokenMint.publicKey, amount: 5 }),
    },
  });

  // When the payer mints from it.
  const mint = generateSigner(umi);
  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      mintV2(umi, {
        candyMachine,
        nftMint: mint,
        collectionMint,
        collectionUpdateAuthority: umi.identity.publicKey,
        mintArgs: {
          tokenGate: some({ mint: tokenMint.publicKey }),
        },
      })
    )
    .sendAndConfirm(umi);

  // Then minting was successful.
  await assertSuccessfulMint(t, umi, { mint, owner: umi.identity });

  // And the payer still has 42 tokens.
  const tokenAccount = await fetchToken(
    umi,
    findAssociatedTokenPda(umi, {
      mint: tokenMint.publicKey,
      owner: umi.identity.publicKey,
    })
  );
  t.is(tokenAccount.amount, 42n);
});

test('it forbids minting when the owner does not own any required tokens', async (t) => {
  // Given a payer with zero tokens.
  const umi = await createUmi();
  const tokenMint = generateSigner(umi);
  await transactionBuilder()
    .add(
      createMintWithAssociatedToken(umi, {
        mint: tokenMint,
        owner: umi.identity.publicKey,
        amount: 0,
      })
    )
    .sendAndConfirm(umi);

  // And a loaded Candy Machine with the token gate guard.
  const collectionMint = (await createCollectionNft(umi)).publicKey;
  const { publicKey: candyMachine } = await createV2(umi, {
    collectionMint,
    configLines: [{ name: 'Degen #1', uri: 'https://example.com/degen/1' }],
    guards: {
      tokenGate: some({ mint: tokenMint.publicKey, amount: 1 }),
    },
  });

  // When the payer tries to mint from it.
  const mint = generateSigner(umi);
  const promise = transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      mintV2(umi, {
        candyMachine,
        nftMint: mint,
        collectionMint,
        collectionUpdateAuthority: umi.identity.publicKey,
        mintArgs: {
          tokenGate: some({ mint: tokenMint.publicKey }),
        },
      })
    )
    .sendAndConfirm(umi);

  // Then we expect an error.
  await t.throwsAsync(promise, { message: /NotEnoughTokens/ });
});

test('it forbids minting when the owner does not own enough tokens', async (t) => {
  // Given a payer with 5 tokens.
  const umi = await createUmi();
  const tokenMint = generateSigner(umi);
  await transactionBuilder()
    .add(
      createMintWithAssociatedToken(umi, {
        mint: tokenMint,
        owner: umi.identity.publicKey,
        amount: 5,
      })
    )
    .sendAndConfirm(umi);

  // And a loaded Candy Machine with the token gate guard that requires 10 tokens.
  const collectionMint = (await createCollectionNft(umi)).publicKey;
  const { publicKey: candyMachine } = await createV2(umi, {
    collectionMint,
    configLines: [{ name: 'Degen #1', uri: 'https://example.com/degen/1' }],
    guards: {
      tokenGate: some({ mint: tokenMint.publicKey, amount: 10 }),
    },
  });

  // When the payer tries to mint from it.
  const mint = generateSigner(umi);
  const promise = transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      mintV2(umi, {
        candyMachine,
        nftMint: mint,
        collectionMint,
        collectionUpdateAuthority: umi.identity.publicKey,
        mintArgs: {
          tokenGate: some({ mint: tokenMint.publicKey }),
        },
      })
    )
    .sendAndConfirm(umi);

  // Then we expect an error.
  await t.throwsAsync(promise, { message: /NotEnoughTokens/ });
});

test('it charges a bot tax when trying to mint without the right amount of tokens', async (t) => {
  // Given a payer with zero tokens.
  const umi = await createUmi();
  const tokenMint = generateSigner(umi);
  await transactionBuilder()
    .add(
      createMintWithAssociatedToken(umi, {
        mint: tokenMint,
        owner: umi.identity.publicKey,
        amount: 0,
      })
    )
    .sendAndConfirm(umi);

  // And a loaded Candy Machine with the token gate guard and a bot tax guard.
  const collectionMint = (await createCollectionNft(umi)).publicKey;
  const { publicKey: candyMachine } = await createV2(umi, {
    collectionMint,
    configLines: [{ name: 'Degen #1', uri: 'https://example.com/degen/1' }],
    guards: {
      botTax: some({ lamports: sol(0.1), lastInstruction: true }),
      tokenGate: some({ mint: tokenMint.publicKey, amount: 1 }),
    },
  });

  // When the payer tries to mint from it.
  const mint = generateSigner(umi);
  const { signature } = await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      mintV2(umi, {
        candyMachine,
        nftMint: mint,
        collectionMint,
        collectionUpdateAuthority: umi.identity.publicKey,
        mintArgs: {
          tokenGate: some({ mint: tokenMint.publicKey }),
        },
      })
    )
    .sendAndConfirm(umi);

  // Then we expect a silent bot tax error.
  await assertBotTax(t, umi, mint, signature, /NotEnoughTokens/);
});
