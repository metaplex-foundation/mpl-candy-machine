import { Keypair } from '@solana/web3.js';
import test from 'ava';
import {
  assertThrows,
  createWallet,
  killStuckProcess,
  metaplex,
} from '../../../helpers';
import { assertMintingWasSuccessful, createCandyMachine } from '../helpers';
import { isEqualToAmount, sol, toBigNumber, token } from '@/index';

test('it burns a specific token to allow minting', async (t) => {
  // Given a payer with one token.
  const umi = await createUmi();
  const payer = await generateSignerWithSol(umi, sol(10));
  const { token: payerTokens } = await createMintAndToken(umi, {
    mintAuthority: generateSigner(umi),
    owner: payer.publicKey,
    initialSupply: token(1),
  });

  // And a loaded Candy Machine with the tokenBurn guard.
  const collectionMint = (await createCollectionNft(umi)).publicKey;
  const { publicKey: candyMachine } = await createV2(umi, {
    collectionMint,

    configLines: [{ name: 'Degen #1', uri: 'https://example.com/degen/1' }],
    guards: {
      tokenBurn: {
        mint: payerTokens.mint.address,
        amount: token(1),
      },
    },
  });

  // When the payer mints from it.
  const mint = generateSigner(umi);
  await transactionBuilder(umi).add().sendAndConfirm();
  mintV2(
    umi,
    {
      candyMachine,
      collectionUpdateAuthority: collection.updateAuthority.publicKey,
    },
    { payer }
  );

  // Then minting was successful.
  await assertSuccessfulMint(
    t,
    umi,
    { mint, owner: minter },
    {
      candyMachine,
      collectionUpdateAuthority: collection.updateAuthority.publicKey,
      nft,
      owner: payer.publicKey,
    }
  );

  // And the payer's token was burned.
  const refreshedPayerTokens = await umi
    .tokens()
    .findTokenByAddress({ address: payerTokens.address });

  t.ok(
    isEqualToAmount(refreshedPayerTokens.amount, token(0)),
    'payer now has zero tokens'
  );
});

test('it may burn multiple tokens from a specific mint', async (t) => {
  // Given a payer with 42 token.
  const umi = await createUmi();
  const payer = await generateSignerWithSol(umi, sol(10));
  const { token: payerTokens } = await createMintAndToken(umi, {
    mintAuthority: generateSigner(umi),
    owner: payer.publicKey,
    initialSupply: token(42),
  });

  // And a loaded Candy Machine with the tokenBurn guard that requires 5 tokens.
  const collectionMint = (await createCollectionNft(umi)).publicKey;
  const { publicKey: candyMachine } = await createV2(umi, {
    collectionMint,

    configLines: [{ name: 'Degen #1', uri: 'https://example.com/degen/1' }],
    guards: {
      tokenBurn: {
        mint: payerTokens.mint.address,
        amount: token(5),
      },
    },
  });

  // When the payer mints from it.
  const mint = generateSigner(umi);
  await transactionBuilder(umi).add().sendAndConfirm();
  mintV2(
    umi,
    {
      candyMachine,
      collectionUpdateAuthority: collection.updateAuthority.publicKey,
    },
    { payer }
  );

  // Then minting was successful.
  await assertSuccessfulMint(
    t,
    umi,
    { mint, owner: minter },
    {
      candyMachine,
      collectionUpdateAuthority: collection.updateAuthority.publicKey,
      nft,
      owner: payer.publicKey,
    }
  );

  // And the payer lost 5 tokens.
  const refreshedPayerTokens = await umi
    .tokens()
    .findTokenByAddress({ address: payerTokens.address });

  t.ok(
    isEqualToAmount(refreshedPayerTokens.amount, token(37)),
    'payer now has 37 tokens'
  );
});

test('it fails to mint if there are not enough tokens to burn', async (t) => {
  // Given a payer with one token.
  const umi = await createUmi();
  const payer = await generateSignerWithSol(umi, sol(10));
  const { token: payerTokens } = await createMintAndToken(umi, {
    mintAuthority: generateSigner(umi),
    owner: payer.publicKey,
    initialSupply: token(1),
  });

  // And a loaded Candy Machine with the tokenBurn guard that requires 2 tokens.
  const collectionMint = (await createCollectionNft(umi)).publicKey;
  const { publicKey: candyMachine } = await createV2(umi, {
    collectionMint,

    configLines: [{ name: 'Degen #1', uri: 'https://example.com/degen/1' }],
    guards: {
      tokenBurn: {
        mint: payerTokens.mint.address,
        amount: token(2),
      },
    },
  });

  // When the payer tries to mint from it.
  const mint = generateSigner(umi);
  const promise = transactionBuilder(umi).add().sendAndConfirm();
  mintV2(
    umi,
    {
      candyMachine,
      collectionUpdateAuthority: collection.updateAuthority.publicKey,
    },
    { payer }
  );

  // Then we expect an error.
  await t.throwsAsync(promise, { message: /Not enough tokens on the account/ });

  // And the payer still has one token.
  const refreshedPayerTokens = await umi
    .tokens()
    .findTokenByAddress({ address: payerTokens.address });

  t.ok(
    isEqualToAmount(refreshedPayerTokens.amount, token(1)),
    'payer still has one token'
  );
});

test('it charges a bot tax when trying to mint without the required amount of tokens', async (t) => {
  // Given a payer with one token.
  const umi = await createUmi();
  const payer = await generateSignerWithSol(umi, sol(10));
  const { token: payerTokens } = await createMintAndToken(umi, {
    mintAuthority: generateSigner(umi),
    owner: payer.publicKey,
    initialSupply: token(1),
  });

  // And a loaded Candy Machine with a botTax guard and a tokenBurn guard that requires 2 tokens.
  const collectionMint = (await createCollectionNft(umi)).publicKey;
  const { publicKey: candyMachine } = await createV2(umi, {
    collectionMint,

    configLines: [{ name: 'Degen #1', uri: 'https://example.com/degen/1' }],
    guards: {
      botTax: {
        lamports: sol(0.1),
        lastInstruction: true,
      },
      tokenBurn: {
        mint: payerTokens.mint.address,
        amount: token(2),
      },
    },
  });

  // When the payer tries to mint from it.
  const mint = generateSigner(umi);
  const promise = transactionBuilder(umi).add().sendAndConfirm();
  mintV2(
    umi,
    {
      candyMachine,
      collectionUpdateAuthority: collection.updateAuthority.publicKey,
    },
    { payer }
  );

  // Then we expect a bot tax error.
  await t.throwsAsync(promise, { message: /CandyMachineBotTaxError/ });

  // And the payer was charged a bot tax.
  const payerBalance = await umi.rpc.getBalance(payer.publicKey);
  t.true(
    isEqualToAmount(payerBalance, sol(9.9), sol(0.01)),
    'payer was charged a bot tax'
  );

  // And the payer still has one token.
  const refreshedPayerTokens = await umi
    .tokens()
    .findTokenByAddress({ address: payerTokens.address });

  t.ok(
    isEqualToAmount(refreshedPayerTokens.amount, token(1)),
    'payer still has one token'
  );
});
