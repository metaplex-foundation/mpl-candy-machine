import { createMintWithAssociatedToken } from '@metaplex-foundation/mpl-toolbox';
import {
  generateSigner,
  isEqualToAmount,
  sol,
  transactionBuilder,
} from '@metaplex-foundation/umi';
import { generateSignerWithSol } from '@metaplex-foundation/umi-bundle-tests';
import test from 'ava';
import { CandyMachine, fetchCandyMachine, mint as mintV1 } from '../src';
import {
  assertSuccessfulMint,
  createCollectionNft,
  createUmi,
  createV1,
  tomorrow,
  yesterday,
} from './_setup';

test('it can mint from a candy guard with no guards', async (t) => {
  // Given a candy machine with a candy guard that has no guards.
  const umi = await createUmi();
  const collectionMint = (await createCollectionNft(umi)).publicKey;
  const candyMachineSigner = await createV1(umi, {
    collectionMint,
    configLines: [{ name: 'Degen #1', uri: 'https://example.com/degen/1' }],
    guards: {},
    groups: [],
  });
  const candyMachine = candyMachineSigner.publicKey;

  // When we mint from the candy guard.
  const mint = generateSigner(umi);
  const owner = generateSigner(umi).publicKey;
  await transactionBuilder()
    .add(createMintWithAssociatedToken(umi, { mint, owner, amount: 1 }))
    .add(
      mintV1(umi, {
        candyMachine,
        nftMint: mint.publicKey,
        collectionMint,
        collectionUpdateAuthority: umi.identity.publicKey,
      })
    )
    .sendAndConfirm(umi);

  // Then the mint was successful.
  await assertSuccessfulMint(t, umi, { mint, owner, name: 'Degen #1' });

  // And the candy machine was updated.
  const candyMachineAccount = await fetchCandyMachine(umi, candyMachine);
  t.like(candyMachineAccount, <CandyMachine>{ itemsRedeemed: 1n });
});

test('it can mint from a candy guard with guards', async (t) => {
  // Given a candy machine with some guards.
  const umi = await createUmi();
  const collectionMint = (await createCollectionNft(umi)).publicKey;
  const destination = generateSigner(umi).publicKey;
  const candyMachineSigner = await createV1(umi, {
    collectionMint,
    configLines: [{ name: 'Degen #1', uri: 'https://example.com/degen/1' }],
    guards: {
      botTax: { lamports: sol(0.01), lastInstruction: true },
      solPayment: { lamports: sol(2), destination },
    },
  });
  const candyMachine = candyMachineSigner.publicKey;

  // When we mint from the candy guard.
  const mint = generateSigner(umi);
  const owner = generateSigner(umi).publicKey;
  const payer = await generateSignerWithSol(umi, sol(10));
  await transactionBuilder()
    .add(createMintWithAssociatedToken(umi, { mint, owner, amount: 1 }))
    .add(
      mintV1(umi, {
        candyMachine,
        nftMint: mint.publicKey,
        payer,
        collectionMint,
        collectionUpdateAuthority: umi.identity.publicKey,
        mintArgs: {
          solPayment: { destination },
        },
      })
    )
    .sendAndConfirm(umi);

  // Then the mint was successful.
  await assertSuccessfulMint(t, umi, { mint, owner, name: 'Degen #1' });

  // And the payer was charged.
  const payerBalance = await umi.rpc.getBalance(payer.publicKey);
  t.true(isEqualToAmount(payerBalance, sol(8), sol(0.02)));

  // And the candy machine was updated.
  const candyMachineAccount = await fetchCandyMachine(umi, candyMachine);
  t.like(candyMachineAccount, <CandyMachine>{ itemsRedeemed: 1n });
});

test('it can mint from a candy guard with groups', async (t) => {
  // Given a candy machine with guard groups.
  const umi = await createUmi();
  const collectionMint = (await createCollectionNft(umi)).publicKey;
  const destination = generateSigner(umi).publicKey;
  const candyMachineSigner = await createV1(umi, {
    collectionMint,
    configLines: [{ name: 'Degen #1', uri: 'https://example.com/degen/1' }],
    guards: {
      botTax: { lamports: sol(0.01), lastInstruction: true },
      solPayment: { lamports: sol(2), destination },
    },
    groups: [
      { label: 'GROUP1', guards: { startDate: { date: yesterday() } } },
      { label: 'GROUP2', guards: { startDate: { date: tomorrow() } } },
    ],
  });
  const candyMachine = candyMachineSigner.publicKey;

  // When we mint from the candy guard.
  const mint = generateSigner(umi);
  const owner = generateSigner(umi).publicKey;
  await transactionBuilder()
    .add(createMintWithAssociatedToken(umi, { mint, owner, amount: 1 }))
    .add(
      mintV1(umi, {
        candyMachine,
        nftMint: mint.publicKey,
        collectionMint,
        collectionUpdateAuthority: umi.identity.publicKey,
        mintArgs: { solPayment: { destination } },
        group: 'GROUP1',
      })
    )
    .sendAndConfirm(umi);

  // Then the mint was successful.
  await assertSuccessfulMint(t, umi, { mint, owner, name: 'Degen #1' });
});
