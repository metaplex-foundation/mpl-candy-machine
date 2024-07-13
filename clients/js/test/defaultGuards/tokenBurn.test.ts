import {
  createMintWithAssociatedToken,
  fetchToken,
  findAssociatedTokenPda,
  setComputeUnitLimit,
} from '@metaplex-foundation/mpl-toolbox';
import {
  generateSigner,
  publicKey,
  sol,
  some,
  transactionBuilder,
} from '@metaplex-foundation/umi';
import test from 'ava';
import { mintV2 } from '../../src';
import { assertBotTax, assertItemBought, createUmi, createV2 } from '../_setup';

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

  const { publicKey: candyMachine } = await createV2(umi, {
    items: [
      {
        id: (await createNft(umi)).publicKey,
        tokenStandard: TokenStandard.NonFungible,
      },
    ],
    startSale: true,
    guards: {
      tokenBurn: some({ mint: tokenMint.publicKey, amount: 1 }),
    },
  });

  // When the payer mints from it.

  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      mintV2(umi, {
        candyMachine,

        mintArgs: {
          tokenBurn: some({ mint: tokenMint.publicKey }),
        },
      })
    )
    .sendAndConfirm(umi);

  // Then minting was successful.
  await assertItemBought(t, umi, { candyMachine });

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

test('it allows minting even when the payer is different from the buyer', async (t) => {
  // Given an explicit buyer with one token.
  const umi = await createUmi();
  const buyer = generateSigner(umi);
  const tokenMint = generateSigner(umi);
  await transactionBuilder()
    .add(
      createMintWithAssociatedToken(umi, {
        mint: tokenMint,
        owner: buyer.publicKey,
        amount: 1,
      })
    )
    .sendAndConfirm(umi);

  // And a loaded Candy Machine with the tokenBurn guard.

  const { publicKey: candyMachine } = await createV2(umi, {
    items: [
      {
        id: (await createNft(umi)).publicKey,
        tokenStandard: TokenStandard.NonFungible,
      },
    ],
    startSale: true,
    guards: {
      tokenBurn: some({ mint: tokenMint.publicKey, amount: 1 }),
    },
  });

  // When the buyer mints from it.

  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      mintV2(umi, {
        candyMachine,

        buyer,

        mintArgs: {
          tokenBurn: some({ mint: tokenMint.publicKey }),
        },
      })
    )
    .sendAndConfirm(umi);

  // Then minting was successful.
  await assertItemBought(t, umi, { candyMachine, buyer: publicKey(buyer) });

  // And the buyer's token was burned.
  const tokenAccount = await fetchToken(
    umi,
    findAssociatedTokenPda(umi, {
      mint: tokenMint.publicKey,
      owner: buyer.publicKey,
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

  const { publicKey: candyMachine } = await createV2(umi, {
    items: [
      {
        id: (await createNft(umi)).publicKey,
        tokenStandard: TokenStandard.NonFungible,
      },
    ],
    startSale: true,
    guards: {
      tokenBurn: some({ mint: tokenMint.publicKey, amount: 5 }),
    },
  });

  // When the payer mints from it.

  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      mintV2(umi, {
        candyMachine,

        mintArgs: {
          tokenBurn: some({ mint: tokenMint.publicKey }),
        },
      })
    )
    .sendAndConfirm(umi);

  // Then minting was successful.
  await assertItemBought(t, umi, { candyMachine });

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

  const { publicKey: candyMachine } = await createV2(umi, {
    items: [
      {
        id: (await createNft(umi)).publicKey,
        tokenStandard: TokenStandard.NonFungible,
      },
    ],
    startSale: true,
    guards: {
      tokenBurn: some({ mint: tokenMint.publicKey, amount: 2 }),
    },
  });

  // When the payer tries to mint from it.

  const promise = transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      mintV2(umi, {
        candyMachine,

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

  const { publicKey: candyMachine } = await createV2(umi, {
    items: [
      {
        id: (await createNft(umi)).publicKey,
        tokenStandard: TokenStandard.NonFungible,
      },
    ],
    startSale: true,
    guards: {
      botTax: some({ lamports: sol(0.1), lastInstruction: true }),
      tokenBurn: some({ mint: tokenMint.publicKey, amount: 2 }),
    },
  });

  // When the payer tries to mint from it.

  const { signature } = await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      mintV2(umi, {
        candyMachine,

        mintArgs: {
          tokenBurn: some({ mint: tokenMint.publicKey }),
        },
      })
    )
    .sendAndConfirm(umi);

  // Then we expect a silent bot tax error.
  await assertBotTax(t, umi, signature, /NotEnoughTokens/);

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
