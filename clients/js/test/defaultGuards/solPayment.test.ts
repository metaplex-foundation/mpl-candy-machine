import {
  generateSigner,
  isEqualToAmount,
  sol,
  some,
  transactionBuilder,
} from '@metaplex-foundation/umi';
import test from 'ava';
import { generateSignerWithSol } from '@metaplex-foundation/umi-bundle-tests';
import { setComputeUnitLimit } from '@metaplex-foundation/mpl-toolbox';
import {
  assertBotTax,
  assertSuccessfulMint,
  createCollectionNft,
  createUmi,
  createV2,
} from '../_setup';
import { mintV2 } from '../../src';

test('it transfers SOL from the payer to the destination', async (t) => {
  // Given a loaded Candy Machine with a solPayment guard.
  const umi = await createUmi();
  const destination = generateSigner(umi).publicKey;
  const collectionMint = (await createCollectionNft(umi)).publicKey;
  const { publicKey: candyMachine } = await createV2(umi, {
    collectionMint,
    configLines: [{ name: 'Degen #1', uri: 'https://example.com/degen/1' }],
    guards: {
      solPayment: some({ lamports: sol(1), destination }),
    },
  });

  // When we mint for another owner using an explicit payer.
  const payer = await generateSignerWithSol(umi, sol(10));
  const minter = generateSigner(umi);
  const mint = generateSigner(umi);
  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      mintV2(umi, {
        candyMachine,
        nftMint: mint,
        minter,
        payer,
        collectionMint,
        collectionUpdateAuthority: umi.identity.publicKey,
        mintArgs: { solPayment: some({ destination }) },
      })
    )
    .sendAndConfirm(umi);

  // Then minting was successful.
  await assertSuccessfulMint(t, umi, { mint, owner: minter });

  // And the treasury received SOLs.
  const treasuryBalance = await umi.rpc.getBalance(destination);
  t.true(isEqualToAmount(treasuryBalance, sol(1)), 'treasury received SOLs');

  // And the payer lost SOLs.
  const payerBalance = await umi.rpc.getBalance(payer.publicKey);
  t.true(isEqualToAmount(payerBalance, sol(9), sol(0.1)), 'payer lost SOLs');
});

test('it fails if the payer does not have enough funds', async (t) => {
  // Given a loaded Candy Machine with a solPayment guard costing 5 SOLs.
  const umi = await createUmi();
  const destination = generateSigner(umi).publicKey;
  const collectionMint = (await createCollectionNft(umi)).publicKey;
  const { publicKey: candyMachine } = await createV2(umi, {
    collectionMint,
    configLines: [{ name: 'Degen #1', uri: 'https://example.com/degen/1' }],
    guards: {
      solPayment: some({ lamports: sol(5), destination }),
    },
  });

  // When we mint from it using a payer that only has 4 SOL.
  const payer = await generateSignerWithSol(umi, sol(4));
  const mint = generateSigner(umi);
  const promise = transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      mintV2(umi, {
        candyMachine,
        nftMint: mint,
        payer,
        collectionMint,
        collectionUpdateAuthority: umi.identity.publicKey,
        mintArgs: { solPayment: some({ destination }) },
      })
    )
    .sendAndConfirm(umi);

  // Then we expect an error.
  await t.throwsAsync(promise, { message: /NotEnoughSOL/ });

  // And the payer didn't loose any SOL.
  const payerBalance = await umi.rpc.getBalance(payer.publicKey);
  t.true(isEqualToAmount(payerBalance, sol(4)), 'payer did not lose SOLs');
});

test('it charges a bot tax if the payer does not have enough funds', async (t) => {
  // Given a loaded Candy Machine with a solPayment guard costing 5 SOLs and a botTax guard.
  const umi = await createUmi();
  const destination = generateSigner(umi).publicKey;
  const collectionMint = (await createCollectionNft(umi)).publicKey;
  const { publicKey: candyMachine } = await createV2(umi, {
    collectionMint,
    configLines: [{ name: 'Degen #1', uri: 'https://example.com/degen/1' }],
    guards: {
      botTax: some({ lamports: sol(0.1), lastInstruction: true }),
      solPayment: some({ lamports: sol(5), destination }),
    },
  });

  // When we mint from it using a payer that only has 4 SOL.
  const payer = await generateSignerWithSol(umi, sol(4));
  const mint = generateSigner(umi);
  const { signature } = await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      mintV2(umi, {
        candyMachine,
        nftMint: mint,
        payer,
        collectionMint,
        collectionUpdateAuthority: umi.identity.publicKey,
        mintArgs: { solPayment: some({ destination }) },
      })
    )
    .sendAndConfirm(umi);

  // Then we expect a bot tax error.
  await assertBotTax(t, umi, mint, signature, /NotEnoughSOL/);
});
