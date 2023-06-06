import {
  generateSigner,
  sol,
  some,
  transactionBuilder,
} from '@metaplex-foundation/umi';
import test from 'ava';
import {
  createMintWithAssociatedToken,
  fetchToken,
  findAssociatedTokenPda,
  setComputeUnitLimit,
} from '@metaplex-foundation/mpl-toolbox';
import {
  assertBotTax,
  assertSuccessfulMint,
  createCollectionNft,
  createUmi,
  createV2,
} from '../_setup';
import { mintV2 } from '../../src';

test('it burns a specific token to allow minting', async (t) => {
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

  // And a loaded Candy Machine with the tokenBurn guard.
  const collectionMint = (await createCollectionNft(umi)).publicKey;
  const { publicKey: candyMachine } = await createV2(umi, {
    collectionMint,
    configLines: [{ name: 'Degen #1', uri: 'https://example.com/degen/1' }],
    guards: {
      tokenBurn: some({ mint: tokenMint.publicKey, amount: 1 }),
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
          tokenBurn: some({ mint: tokenMint.publicKey }),
        },
      })
    )
    .sendAndConfirm(umi);

  // Then minting was successful.
  await assertSuccessfulMint(t, umi, { mint, owner: umi.identity });

  // And the payer's token was burned.
  const tokenAccount = await fetchToken(
    umi,
    findAssociatedTokenPda(umi, {
      mint: tokenMint.publicKey,
      owner: umi.identity.publicKey,
    })
  );
  t.is(tokenAccount.amount, 0n);
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

  // And a loaded Candy Machine with the tokenBurn guard.
  const collectionMint = (await createCollectionNft(umi)).publicKey;
  const { publicKey: candyMachine } = await createV2(umi, {
    collectionMint,
    configLines: [{ name: 'Degen #1', uri: 'https://example.com/degen/1' }],
    guards: {
      tokenBurn: some({ mint: tokenMint.publicKey, amount: 1 }),
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
          tokenBurn: some({ mint: tokenMint.publicKey }),
        },
      })
    )
    .sendAndConfirm(umi);

  // Then minting was successful.
  await assertSuccessfulMint(t, umi, { mint, owner: minter });

  // And the minter's token was burned.
  const tokenAccount = await fetchToken(
    umi,
    findAssociatedTokenPda(umi, {
      mint: tokenMint.publicKey,
      owner: minter.publicKey,
    })
  );
  t.is(tokenAccount.amount, 0n);
});

test('it may burn multiple tokens from a specific mint', async (t) => {
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

  // And a loaded Candy Machine with the tokenBurn guard that requires 5 tokens.
  const collectionMint = (await createCollectionNft(umi)).publicKey;
  const { publicKey: candyMachine } = await createV2(umi, {
    collectionMint,
    configLines: [{ name: 'Degen #1', uri: 'https://example.com/degen/1' }],
    guards: {
      tokenBurn: some({ mint: tokenMint.publicKey, amount: 5 }),
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
          tokenBurn: some({ mint: tokenMint.publicKey }),
        },
      })
    )
    .sendAndConfirm(umi);

  // Then minting was successful.
  await assertSuccessfulMint(t, umi, { mint, owner: umi.identity });

  // And the payer lost 5 tokens.
  const tokenAccount = await fetchToken(
    umi,
    findAssociatedTokenPda(umi, {
      mint: tokenMint.publicKey,
      owner: umi.identity.publicKey,
    })
  );
  t.is(tokenAccount.amount, 37n);
});

test('it fails to mint if there are not enough tokens to burn', async (t) => {
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

  // And a loaded Candy Machine with the tokenBurn guard that requires 2 tokens.
  const collectionMint = (await createCollectionNft(umi)).publicKey;
  const { publicKey: candyMachine } = await createV2(umi, {
    collectionMint,
    configLines: [{ name: 'Degen #1', uri: 'https://example.com/degen/1' }],
    guards: {
      tokenBurn: some({ mint: tokenMint.publicKey, amount: 2 }),
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
          tokenBurn: some({ mint: tokenMint.publicKey }),
        },
      })
    )
    .sendAndConfirm(umi);

  // Then we expect a program error.
  await t.throwsAsync(promise, { message: /NotEnoughTokens/ });

  // And the payer still has one token.
  const tokenAccount = await fetchToken(
    umi,
    findAssociatedTokenPda(umi, {
      mint: tokenMint.publicKey,
      owner: umi.identity.publicKey,
    })
  );
  t.is(tokenAccount.amount, 1n);
});

test('it charges a bot tax when trying to mint without the required amount of tokens', async (t) => {
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

  // And a loaded Candy Machine with a botTax guard and a tokenBurn guard that requires 2 tokens.
  const collectionMint = (await createCollectionNft(umi)).publicKey;
  const { publicKey: candyMachine } = await createV2(umi, {
    collectionMint,
    configLines: [{ name: 'Degen #1', uri: 'https://example.com/degen/1' }],
    guards: {
      botTax: some({ lamports: sol(0.1), lastInstruction: true }),
      tokenBurn: some({ mint: tokenMint.publicKey, amount: 2 }),
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
          tokenBurn: some({ mint: tokenMint.publicKey }),
        },
      })
    )
    .sendAndConfirm(umi);

  // Then we expect a silent bot tax error.
  await assertBotTax(t, umi, mint, signature, /NotEnoughTokens/);

  // And the payer still has one token.
  const tokenAccount = await fetchToken(
    umi,
    findAssociatedTokenPda(umi, {
      mint: tokenMint.publicKey,
      owner: umi.identity.publicKey,
    })
  );
  t.is(tokenAccount.amount, 1n);
});
