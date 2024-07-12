import { generateSigner, transactionBuilder } from '@metaplex-foundation/umi';
import { fetchAssetV1, transfer } from '@metaplex-foundation/mpl-core';
import test from 'ava';
import {
  addCoreAsset,
  CandyMachine,
  fetchCandyMachine,
  TokenStandard,
} from '../src';
import { createV2, createUmi, createCoreAsset } from './_setup';

test('it can add core assets to a candy machine', async (t) => {
  // Given a Candy Machine with 5 core assets.
  const umi = await createUmi();
  const candyMachine = await createV2(umi, { settings: { itemCapacity: 5 } });
  const coreAsset = await createCoreAsset(umi);

  // When we add an coreAsset to the Candy Machine.
  await transactionBuilder()
    .add(
      addCoreAsset(umi, {
        candyMachine: candyMachine.publicKey,
        asset: coreAsset.publicKey,
      })
    )
    .sendAndConfirm(umi);

  // Then the Candy Machine has been updated properly.
  const candyMachineAccount = await fetchCandyMachine(
    umi,
    candyMachine.publicKey
  );

  t.like(candyMachineAccount, <Pick<CandyMachine, 'itemsLoaded' | 'items'>>{
    itemsLoaded: 1,
    items: [
      {
        index: 0,
        minted: false,
        mint: coreAsset.publicKey,
        seller: umi.identity.publicKey,
        buyer: undefined,
        tokenStandard: TokenStandard.Core,
      },
    ],
  });
});

test('it can append additional core assets to a candy machine', async (t) => {
  // Given a Candy Machine with 5 core assets.
  const umi = await createUmi();
  const candyMachine = await createV2(umi, { settings: { itemCapacity: 2 } });
  const coreAssets = await Promise.all([
    createCoreAsset(umi),
    createCoreAsset(umi),
  ]);

  await transactionBuilder()
    .add(
      addCoreAsset(umi, {
        candyMachine: candyMachine.publicKey,
        asset: coreAssets[0].publicKey,
      })
    )
    .sendAndConfirm(umi);

  // When we add an additional item to the Candy Machine.
  await transactionBuilder()
    .add(
      addCoreAsset(umi, {
        candyMachine: candyMachine.publicKey,
        asset: coreAssets[1].publicKey,
      })
    )
    .sendAndConfirm(umi);

  // Then the Candy Machine has been updated properly.
  const candyMachineAccount = await fetchCandyMachine(
    umi,
    candyMachine.publicKey
  );

  t.like(candyMachineAccount, <Pick<CandyMachine, 'itemsLoaded' | 'items'>>{
    itemsLoaded: 2,
    items: [
      {
        index: 0,
        minted: false,
        mint: coreAssets[0].publicKey,
        seller: umi.identity.publicKey,
        buyer: undefined,
        tokenStandard: TokenStandard.Core,
      },
      {
        index: 1,
        minted: false,
        mint: coreAssets[1].publicKey,
        seller: umi.identity.publicKey,
        buyer: undefined,
        tokenStandard: TokenStandard.Core,
      },
    ],
  });
});

test('it cannot add core assets that would make the candy machine exceed the maximum capacity', async (t) => {
  // Given an existing Candy Machine with a capacity of 1 item.
  const umi = await createUmi();
  const candyMachine = await createV2(umi, { settings: { itemCapacity: 1 } });
  const coreAssets = await Promise.all([
    createCoreAsset(umi),
    createCoreAsset(umi),
  ]);

  // When we try to add 2 coreAssets to the Candy Machine.
  const promise = transactionBuilder()
    .add(
      addCoreAsset(umi, {
        candyMachine: candyMachine.publicKey,
        asset: coreAssets[0].publicKey,
      })
    )
    .add(
      addCoreAsset(umi, {
        candyMachine: candyMachine.publicKey,
        asset: coreAssets[1].publicKey,
      })
    )
    .sendAndConfirm(umi);

  // Then we expect an error to be thrown.
  await t.throwsAsync(promise, {
    message: /IndexGreaterThanLength/,
  });
});

test('it cannot add core assets once the candy machine is fully loaded', async (t) => {
  // Given an existing Candy Machine with 2 core assets loaded and a capacity of 2 core assets.
  const umi = await createUmi();
  const candyMachine = await createV2(umi, { settings: { itemCapacity: 1 } });
  const coreAsset = await createCoreAsset(umi);

  await transactionBuilder()
    .add(
      addCoreAsset(umi, {
        candyMachine: candyMachine.publicKey,
        asset: coreAsset.publicKey,
      })
    )
    .sendAndConfirm(umi);

  // When we try to add one more item to the Candy Machine.
  const promise = transactionBuilder()
    .add(
      addCoreAsset(umi, {
        candyMachine: candyMachine.publicKey,
        asset: (await createCoreAsset(umi)).publicKey,
      })
    )
    .sendAndConfirm(umi);

  // Then we expect an error to be thrown.
  await t.throwsAsync(promise, {
    message: /IndexGreaterThanLength/,
  });
});

test('it cannot add core assets that are on the secondary market', async (t) => {
  // Given a Candy Machine with 5 core assets.
  const umi = await createUmi();
  const candyMachine = await createV2(umi, { settings: { itemCapacity: 1 } });
  const coreAssets = await Promise.all([createCoreAsset(umi)]);
  const asset = await fetchAssetV1(umi, coreAssets[0].publicKey);

  await transfer(umi, {
    asset,
    newOwner: generateSigner(umi).publicKey,
  }).sendAndConfirm(umi);

  // When we add two core assets to the Candy Machine.
  const promise = transactionBuilder()
    .add(
      addCoreAsset(umi, {
        candyMachine: candyMachine.publicKey,
        asset: coreAssets[0].publicKey,
      })
    )
    .sendAndConfirm(umi);

  // Then an error is thrown.
  // Then we expect a program error.
  await t.throwsAsync(promise, { message: /NotPrimarySale/ });
});
