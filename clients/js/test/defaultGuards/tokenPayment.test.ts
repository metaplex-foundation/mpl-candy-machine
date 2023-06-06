import {
  fetchToken,
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
  createMintWithHolders,
  createUmi,
  createV2,
} from '../_setup';

test('it transfers tokens from the payer to the destination', async (t) => {
  // Given a mint account such that:
  // - The destination treasury has 100 tokens.
  // - The payer has 12 tokens.
  const umi = await createUmi();
  const destination = generateSigner(umi).publicKey;
  const [tokenMint, destinationAta, identityAta] = await createMintWithHolders(
    umi,
    {
      holders: [
        { owner: destination, amount: 100 },
        { owner: umi.identity, amount: 12 },
      ],
    }
  );

  // And a loaded Candy Machine with a tokenPayment guard that requires 5 tokens.
  const collectionMint = (await createCollectionNft(umi)).publicKey;
  const { publicKey: candyMachine } = await createV2(umi, {
    collectionMint,
    configLines: [{ name: 'Degen #1', uri: 'https://example.com/degen/1' }],
    guards: {
      tokenPayment: some({
        mint: tokenMint.publicKey,
        destinationAta,
        amount: 5,
      }),
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
        mintArgs: {
          tokenPayment: some({ mint: tokenMint.publicKey, destinationAta }),
        },
      })
    )
    .sendAndConfirm(umi);

  // Then minting was successful.
  await assertSuccessfulMint(t, umi, { mint, owner: umi.identity });

  // And the treasury token received 5 tokens.
  const destinationTokenAccount = await fetchToken(umi, destinationAta);
  t.is(destinationTokenAccount.amount, 105n);

  // And the payer lost 5 tokens.
  const payerTokenAccount = await fetchToken(umi, identityAta);
  t.is(payerTokenAccount.amount, 7n);
});

test('it allows minting even when the payer is different from the minter', async (t) => {
  // Given a mint account such that:
  // - The destination treasury has 100 tokens.
  // - An explicit minter has 12 tokens.
  const umi = await createUmi();
  const minter = generateSigner(umi);
  const destination = generateSigner(umi).publicKey;
  const [tokenMint, destinationAta, minterAta] = await createMintWithHolders(
    umi,
    {
      holders: [
        { owner: destination, amount: 100 },
        { owner: minter, amount: 12 },
      ],
    }
  );

  // And a loaded Candy Machine with a tokenPayment guard that requires 5 tokens.
  const collectionMint = (await createCollectionNft(umi)).publicKey;
  const { publicKey: candyMachine } = await createV2(umi, {
    collectionMint,
    configLines: [{ name: 'Degen #1', uri: 'https://example.com/degen/1' }],
    guards: {
      tokenPayment: some({
        mint: tokenMint.publicKey,
        destinationAta,
        amount: 5,
      }),
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
          tokenPayment: some({ mint: tokenMint.publicKey, destinationAta }),
        },
      })
    )
    .sendAndConfirm(umi);

  // Then minting was successful.
  await assertSuccessfulMint(t, umi, { mint, owner: minter });

  // And the treasury token received 5 tokens.
  const destinationTokenAccount = await fetchToken(umi, destinationAta);
  t.is(destinationTokenAccount.amount, 105n);

  // And the minter lost 5 tokens.
  const minterTokenAccount = await fetchToken(umi, minterAta);
  t.is(minterTokenAccount.amount, 7n);
});

test('it fails if the payer does not have enough tokens', async (t) => {
  // Given a mint account such that the payer has 4 tokens.
  const umi = await createUmi();
  const destination = generateSigner(umi).publicKey;
  const [tokenMint, destinationAta, identityAta] = await createMintWithHolders(
    umi,
    {
      holders: [
        { owner: destination, amount: 0 },
        { owner: umi.identity, amount: 4 },
      ],
    }
  );

  // And a loaded Candy Machine with a tokenPayment guard that requires 5 tokens.
  const collectionMint = (await createCollectionNft(umi)).publicKey;
  const { publicKey: candyMachine } = await createV2(umi, {
    collectionMint,
    configLines: [{ name: 'Degen #1', uri: 'https://example.com/degen/1' }],
    guards: {
      tokenPayment: some({
        mint: tokenMint.publicKey,
        destinationAta,
        amount: 5,
      }),
    },
  });

  // When we try to mint from it.
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
          tokenPayment: some({ mint: tokenMint.publicKey, destinationAta }),
        },
      })
    )
    .sendAndConfirm(umi);

  // Then we expect a program error.
  await t.throwsAsync(promise, { message: /NotEnoughTokens/ });

  // And the payer still has 4 tokens.
  const payerTokenAccount = await fetchToken(umi, identityAta);
  t.is(payerTokenAccount.amount, 4n);
});

test('it charges a bot tax if the payer does not have enough tokens', async (t) => {
  // Given a mint account such that the payer has 4 tokens.
  const umi = await createUmi();
  const destination = generateSigner(umi).publicKey;
  const [tokenMint, destinationAta, identityAta] = await createMintWithHolders(
    umi,
    {
      holders: [
        { owner: destination, amount: 0 },
        { owner: umi.identity, amount: 4 },
      ],
    }
  );

  // And a loaded Candy Machine with a bot tax guard and a tokenPayment guard that requires 5 tokens.
  const collectionMint = (await createCollectionNft(umi)).publicKey;
  const { publicKey: candyMachine } = await createV2(umi, {
    collectionMint,
    configLines: [{ name: 'Degen #1', uri: 'https://example.com/degen/1' }],
    guards: {
      botTax: some({ lamports: sol(0.1), lastInstruction: true }),
      tokenPayment: some({
        mint: tokenMint.publicKey,
        destinationAta,
        amount: 5,
      }),
    },
  });

  // When we try to mint from it.
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
          tokenPayment: some({ mint: tokenMint.publicKey, destinationAta }),
        },
      })
    )
    .sendAndConfirm(umi);

  // Then we expect a silent bot tax error.
  await assertBotTax(t, umi, mint, signature, /NotEnoughTokens/);

  // And the payer still has 4 tokens.
  const payerTokenAccount = await fetchToken(umi, identityAta);
  t.is(payerTokenAccount.amount, 4n);
});
