import { createMintWithSingleToken } from '@metaplex-foundation/mpl-essentials';
import {
  generateSigner,
  isEqualToAmount,
  sol,
  some,
  transactionBuilder,
} from '@metaplex-foundation/umi';
import { generateSignerWithSol } from '@metaplex-foundation/umi-bundle-tests';
import test from 'ava';
import {
  CandyMachine,
  fetchCandyMachine,
  findCandyGuardPda,
  mintV2,
} from '../src';
import {
  assertSuccessfulMint,
  createCollectionNft,
  createUmi,
  createV2,
} from './_setup';

test.skip('it can mint from a candy guard with no guards', async (t) => {
  // Given a candy machine with a candy guard that has no guards.
  const umi = await createUmi();
  const collectionMint = (await createCollectionNft(umi)).publicKey;
  const candyMachineSigner = await createV2(umi, {
    collectionMint,
    configLines: [{ name: 'Degen #1', uri: 'https://example.com/degen/1' }],
    guards: {},
    groups: [],
  });
  const candyMachine = candyMachineSigner.publicKey;
  const candyGuard = findCandyGuardPda(umi, { base: candyMachine });

  // When we mint from the candy guard.
  const mint = generateSigner(umi);
  const owner = generateSigner(umi).publicKey;
  await transactionBuilder(umi)
    .add(createMintWithSingleToken(umi, { mint, owner }))
    .add(
      mintV2(umi, {
        candyMachine,
        candyGuard,
        nftMint: mint.publicKey,
        nftMintAuthority: umi.identity,
        collectionMint,
        collectionUpdateAuthority: umi.identity.publicKey,
      })
    )
    .sendAndConfirm();

  // Then the mint was successful.
  await assertSuccessfulMint(t, umi, { mint, owner, name: 'Degen #1' });

  // And the candy machine was updated.
  const candyMachineAccount = await fetchCandyMachine(umi, candyMachine);
  t.like(candyMachineAccount, <CandyMachine>{ itemsRedeemed: 1n });
});

test.skip('it can mint from a candy guard with guards', async (t) => {
  // Given a candy machine with some guards.
  const umi = await createUmi();
  const collectionMint = (await createCollectionNft(umi)).publicKey;
  const destination = generateSigner(umi).publicKey;
  const candyMachineSigner = await createV2(umi, {
    collectionMint,
    configLines: [{ name: 'Degen #1', uri: 'https://example.com/degen/1' }],
    guards: {
      botTax: some({ lamports: sol(0.01), lastInstruction: false }),
      solPayment: some({ lamports: sol(2), destination }),
    },
  });
  const candyMachine = candyMachineSigner.publicKey;
  const candyGuard = findCandyGuardPda(umi, { base: candyMachine });

  // When we mint from the candy guard.
  const mint = generateSigner(umi);
  const owner = generateSigner(umi).publicKey;
  const payer = await generateSignerWithSol(umi, sol(10));
  await transactionBuilder(umi)
    .add(createMintWithSingleToken(umi, { mint, owner }))
    .add(
      mintV2(umi, {
        candyMachine,
        candyGuard,
        nftMint: mint.publicKey,
        nftMintAuthority: umi.identity,
        payer,
        collectionMint,
        collectionUpdateAuthority: umi.identity.publicKey,
        mintArgs: {
          solPayment: some({ destination }),
        },
      })
    )
    .sendAndConfirm();

  // Then the mint was successful.
  await assertSuccessfulMint(t, umi, { mint, owner, name: 'Degen #1' });

  // And the payer was charged.
  const payerBalance = await umi.rpc.getBalance(payer.publicKey);
  t.true(isEqualToAmount(payerBalance, sol(8), sol(0.01)));

  // And the candy machine was updated.
  const candyMachineAccount = await fetchCandyMachine(umi, candyMachine);
  t.like(candyMachineAccount, <CandyMachine>{ itemsRedeemed: 1n });
});
