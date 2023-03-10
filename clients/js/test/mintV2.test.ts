import {
  createAssociatedToken,
  createMint,
  createMintWithSingleToken,
  setComputeUnitLimit,
} from '@metaplex-foundation/mpl-essentials';
import { findCollectionAuthorityRecordPda } from '@metaplex-foundation/mpl-token-metadata';
import {
  generateSigner,
  isEqualToAmount,
  none,
  sol,
  some,
  transactionBuilder,
} from '@metaplex-foundation/umi';
import { generateSignerWithSol } from '@metaplex-foundation/umi-bundle-tests';
import test from 'ava';
import {
  CandyMachine,
  fetchCandyMachine,
  findCandyMachineAuthorityPda,
  mintV2,
} from '../src';
import {
  assertSuccessfulMint,
  createCollectionNft,
  createUmi,
  createV1,
  createV2,
  tomorrow,
  yesterday,
} from './_setup';

test('it can mint from a candy guard with no guards', async (t) => {
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

  // When we mint from the candy guard.
  const mint = generateSigner(umi);
  const minter = generateSigner(umi);
  await transactionBuilder(umi)
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      mintV2(umi, {
        candyMachine,
        minter,
        nftMint: mint,
        collectionMint,
        collectionUpdateAuthority: umi.identity.publicKey,
      })
    )
    .sendAndConfirm();

  // Then the mint was successful.
  await assertSuccessfulMint(t, umi, { mint, owner: minter, name: 'Degen #1' });

  // And the candy machine was updated.
  const candyMachineAccount = await fetchCandyMachine(umi, candyMachine);
  t.like(candyMachineAccount, <CandyMachine>{ itemsRedeemed: 1n });
});

test('it can mint whilst creating the mint and token accounts beforehand', async (t) => {
  // Given a candy machine with a candy guard.
  const umi = await createUmi();
  const collectionMint = (await createCollectionNft(umi)).publicKey;
  const candyMachineSigner = await createV2(umi, {
    collectionMint,
    configLines: [{ name: 'Degen #1', uri: 'https://example.com/degen/1' }],
    guards: {},
  });
  const candyMachine = candyMachineSigner.publicKey;

  // When we create a new mint and token account before minting.
  const mint = generateSigner(umi);
  const minter = generateSigner(umi);
  await transactionBuilder(umi)
    .add(createMint(umi, { mint }))
    .add(
      createAssociatedToken(umi, {
        mint: mint.publicKey,
        owner: minter.publicKey,
      })
    )
    .add(
      mintV2(umi, {
        candyMachine,
        minter,
        nftMint: mint.publicKey,
        collectionMint,
        collectionUpdateAuthority: umi.identity.publicKey,
      })
    )
    .sendAndConfirm();

  // Then the mint was successful.
  await assertSuccessfulMint(t, umi, { mint, owner: minter, name: 'Degen #1' });

  // And the candy machine was updated.
  const candyMachineAccount = await fetchCandyMachine(umi, candyMachine);
  t.like(candyMachineAccount, <CandyMachine>{ itemsRedeemed: 1n });
});

test('it can mint whilst creating only the mint account beforehand', async (t) => {
  // Given a candy machine with a candy guard.
  const umi = await createUmi();
  const collectionMint = (await createCollectionNft(umi)).publicKey;
  const candyMachineSigner = await createV2(umi, {
    collectionMint,
    configLines: [{ name: 'Degen #1', uri: 'https://example.com/degen/1' }],
    guards: {},
  });
  const candyMachine = candyMachineSigner.publicKey;

  // When we create a new mint account before minting.
  const mint = generateSigner(umi);
  const minter = generateSigner(umi);
  await transactionBuilder(umi)
    .add(createMint(umi, { mint }))
    .add(
      mintV2(umi, {
        candyMachine,
        minter,
        nftMint: mint.publicKey,
        collectionMint,
        collectionUpdateAuthority: umi.identity.publicKey,
      })
    )
    .sendAndConfirm();

  // Then the mint was successful.
  await assertSuccessfulMint(t, umi, { mint, owner: minter, name: 'Degen #1' });

  // And the candy machine was updated.
  const candyMachineAccount = await fetchCandyMachine(umi, candyMachine);
  t.like(candyMachineAccount, <CandyMachine>{ itemsRedeemed: 1n });
});

test('it can mint from a candy guard attached to a candy machine v1', async (t) => {
  // Given a candy machine v1 with a candy guard that has no guards.
  const umi = await createUmi();
  const collectionMint = (await createCollectionNft(umi)).publicKey;
  const candyMachineSigner = await createV1(umi, {
    collectionMint,
    configLines: [{ name: 'Degen #1', uri: 'https://example.com/degen/1' }],
    guards: {},
  });
  const candyMachine = candyMachineSigner.publicKey;

  // When we mint from it.
  const mint = generateSigner(umi);
  const minter = generateSigner(umi);
  await transactionBuilder(umi)
    .add(createMintWithSingleToken(umi, { mint, owner: minter.publicKey }))
    .add(
      mintV2(umi, {
        candyMachine,
        minter,
        nftMint: mint,
        collectionMint,
        collectionUpdateAuthority: umi.identity.publicKey,
        // We have to explicitly provide the collection authority record
        // because v2 defaults to the new way of deriving delegate records.
        collectionDelegateRecord: findCollectionAuthorityRecordPda(umi, {
          mint: collectionMint,
          collectionAuthority: findCandyMachineAuthorityPda(umi, {
            candyMachine,
          }),
        }),
      })
    )
    .sendAndConfirm();

  // Then the mint was successful.
  await assertSuccessfulMint(t, umi, { mint, owner: minter, name: 'Degen #1' });

  // And the candy machine was updated.
  const candyMachineAccount = await fetchCandyMachine(umi, candyMachine);
  t.like(candyMachineAccount, <CandyMachine>{ itemsRedeemed: 1n });
});

test('it can mint from a candy guard with guards', async (t) => {
  // Given a candy machine with some guards.
  const umi = await createUmi();
  const collectionMint = (await createCollectionNft(umi)).publicKey;
  const destination = generateSigner(umi).publicKey;
  const candyMachineSigner = await createV2(umi, {
    collectionMint,
    configLines: [{ name: 'Degen #1', uri: 'https://example.com/degen/1' }],
    guards: {
      botTax: some({ lamports: sol(0.01), lastInstruction: true }),
      solPayment: some({ lamports: sol(2), destination }),
    },
  });
  const candyMachine = candyMachineSigner.publicKey;

  // When we mint from the candy guard.
  const mint = generateSigner(umi);
  const minter = generateSigner(umi);
  const payer = await generateSignerWithSol(umi, sol(10));
  await transactionBuilder(umi)
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      mintV2(umi, {
        candyMachine,
        nftMint: mint,
        payer,
        minter,
        collectionMint,
        collectionUpdateAuthority: umi.identity.publicKey,
        mintArgs: {
          solPayment: some({ destination }),
        },
      })
    )
    .sendAndConfirm();

  // Then the mint was successful.
  await assertSuccessfulMint(t, umi, { mint, owner: minter, name: 'Degen #1' });

  // And the payer was charged.
  const payerBalance = await umi.rpc.getBalance(payer.publicKey);
  t.true(isEqualToAmount(payerBalance, sol(8), sol(0.1)));

  // And the candy machine was updated.
  const candyMachineAccount = await fetchCandyMachine(umi, candyMachine);
  t.like(candyMachineAccount, <CandyMachine>{ itemsRedeemed: 1n });
});

test('it can mint from a candy guard with groups', async (t) => {
  // Given a candy machine with guard groups.
  const umi = await createUmi();
  const collectionMint = (await createCollectionNft(umi)).publicKey;
  const destination = generateSigner(umi).publicKey;
  const candyMachineSigner = await createV2(umi, {
    collectionMint,
    configLines: [{ name: 'Degen #1', uri: 'https://example.com/degen/1' }],
    guards: {
      botTax: some({ lamports: sol(0.01), lastInstruction: true }),
      solPayment: some({ lamports: sol(2), destination }),
    },
    groups: [
      { label: 'GROUP1', guards: { startDate: some({ date: yesterday() }) } },
      { label: 'GROUP2', guards: { startDate: some({ date: tomorrow() }) } },
    ],
  });
  const candyMachine = candyMachineSigner.publicKey;

  // When we mint from it using GROUP1.
  const mint = generateSigner(umi);
  const minter = generateSigner(umi);
  await transactionBuilder(umi)
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      mintV2(umi, {
        candyMachine,
        nftMint: mint,
        minter,
        collectionMint,
        collectionUpdateAuthority: umi.identity.publicKey,
        mintArgs: { solPayment: some({ destination }) },
        group: some('GROUP1'),
      })
    )
    .sendAndConfirm();

  // Then the mint was successful.
  await assertSuccessfulMint(t, umi, { mint, owner: minter });
});

test('it cannot mint using the default guards if the candy guard has groups', async (t) => {
  // Given a candy machine with guard groups.
  const umi = await createUmi();
  const collectionMint = (await createCollectionNft(umi)).publicKey;
  const destination = generateSigner(umi).publicKey;
  const candyMachineSigner = await createV2(umi, {
    collectionMint,
    configLines: [{ name: 'Degen #1', uri: 'https://example.com/degen/1' }],
    guards: { solPayment: some({ lamports: sol(2), destination }) },
    groups: [
      { label: 'GROUP1', guards: { startDate: some({ date: yesterday() }) } },
      { label: 'GROUP2', guards: { startDate: some({ date: tomorrow() }) } },
    ],
  });
  const candyMachine = candyMachineSigner.publicKey;

  // When we try to mint using the default guards.
  const mint = generateSigner(umi);
  const minter = generateSigner(umi);
  const promise = transactionBuilder(umi)
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      mintV2(umi, {
        candyMachine,
        nftMint: mint,
        minter,
        collectionMint,
        collectionUpdateAuthority: umi.identity.publicKey,
        mintArgs: { solPayment: some({ destination }) },
        group: none(),
      })
    )
    .sendAndConfirm();

  // Then we expect a program error.
  await t.throwsAsync(promise, { message: /RequiredGroupLabelNotFound/ });
});
