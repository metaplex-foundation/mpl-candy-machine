import { AssetV1, fetchAssetV1 } from '@metaplex-foundation/mpl-core';
import { generateSigner, transactionBuilder } from '@metaplex-foundation/umi';
import test from 'ava';
import {
  addCoreAsset,
  CandyMachine,
  fetchCandyMachine,
  removeCoreAsset,
  TokenStandard,
} from '../src';
import { createCoreAsset, createUmi, createV2 } from './_setup';

test('it can remove core asset from a candy machine', async (t) => {
  // Given a Candy Machine with 5 coreAssets.
  const umi = await createUmi();
  const candyMachine = await createV2(umi, { settings: { itemCapacity: 5 } });
  const coreAsset = await createCoreAsset(umi);

  // When we add an nft to the Candy Machine.
  await transactionBuilder()
    .add(
      addCoreAsset(umi, {
        candyMachine: candyMachine.publicKey,
        asset: coreAsset.publicKey,
      })
    )
    .sendAndConfirm(umi);

  // Then remove the nft
  await transactionBuilder()
    .add(
      removeCoreAsset(umi, {
        candyMachine: candyMachine.publicKey,
        index: 0,
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
    itemsLoaded: 0,
    items: [],
  });

  // Then nft is unfrozen and revoked
  const asset = await fetchAssetV1(umi, coreAsset.publicKey);
  t.like(asset, <AssetV1>{
    freezeDelegate: undefined,
    transferDelegate: undefined,
    owner: umi.identity.publicKey,
  });
});

test('it can remove core asset at a lower index than last from a candy machine', async (t) => {
  // Given a Candy Machine with 5 coreAssets.
  const umi = await createUmi();
  const candyMachine = await createV2(umi, { settings: { itemCapacity: 5 } });
  const coreAssets = await Promise.all([
    createCoreAsset(umi),
    createCoreAsset(umi),
  ]);

  // When we add two coreAssets to the Candy Machine.
  await transactionBuilder()
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

  // Then remove the nft
  await transactionBuilder()
    .add(
      removeCoreAsset(umi, {
        candyMachine: candyMachine.publicKey,
        index: 0,
        asset: coreAssets[0].publicKey,
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
        mint: coreAssets[1].publicKey,
        seller: umi.identity.publicKey,
        buyer: undefined,
        tokenStandard: TokenStandard.Core,
      },
    ],
  });

  // Then nft is unfrozen and revoked
  const asset = await fetchAssetV1(umi, coreAssets[0].publicKey);
  t.like(asset, <AssetV1>{
    freezeDelegate: undefined,
    transferDelegate: undefined,
    owner: umi.identity.publicKey,
  });
});

test('it can remove additional core asset from a candy machine', async (t) => {
  // Given a Candy Machine with 5 coreAssets.
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
    .add(
      addCoreAsset(umi, {
        candyMachine: candyMachine.publicKey,
        asset: coreAssets[1].publicKey,
      })
    )
    .sendAndConfirm(umi);

  // When we remove an additional item from the Candy Machine.
  await transactionBuilder()
    .add(
      removeCoreAsset(umi, {
        candyMachine: candyMachine.publicKey,
        asset: coreAssets[0].publicKey,
        index: 0,
      })
    )
    .sendAndConfirm(umi);

  // When we remove an additional item from the Candy Machine.
  await transactionBuilder()
    .add(
      removeCoreAsset(umi, {
        candyMachine: candyMachine.publicKey,
        asset: coreAssets[1].publicKey,
        index: 0,
      })
    )
    .sendAndConfirm(umi);

  // Then the Candy Machine has been updated properly.
  const candyMachineAccount = await fetchCandyMachine(
    umi,
    candyMachine.publicKey
  );

  t.like(candyMachineAccount, <Pick<CandyMachine, 'itemsLoaded' | 'items'>>{
    itemsLoaded: 0,
    items: [],
  });
});

test('it cannot remove core asset when the machine is empty', async (t) => {
  // Given an existing Candy Machine with a capacity of 1 item.
  const umi = await createUmi();
  const candyMachine = await createV2(umi, { settings: { itemCapacity: 1 } });
  const nft = await createCoreAsset(umi);

  // When we try to remove an nft from the Candy Machine.
  const promise = transactionBuilder()
    .add(
      removeCoreAsset(umi, {
        candyMachine: candyMachine.publicKey,
        asset: nft.publicKey,
        index: 0,
      })
    )
    .sendAndConfirm(umi);

  // Then we expect an error to be thrown.
  await t.throwsAsync(promise, {
    message: /IndexGreaterThanLength/,
  });
});

test('it cannot remove core asset as a different seller', async (t) => {
  // Given a Candy Machine with 5 coreAssets.
  const umi = await createUmi();
  const candyMachine = await createV2(umi, { settings: { itemCapacity: 1 } });
  const nft = await createCoreAsset(umi);

  // When we add an nft to the Candy Machine.
  await transactionBuilder()
    .add(
      addCoreAsset(umi, {
        candyMachine: candyMachine.publicKey,
        asset: nft.publicKey,
      })
    )
    .sendAndConfirm(umi);

  // Then remove the nft
  const promise = transactionBuilder()
    .add(
      removeCoreAsset(umi, {
        authority: generateSigner(umi),
        candyMachine: candyMachine.publicKey,
        index: 0,
        asset: nft.publicKey,
      })
    )
    .sendAndConfirm(umi);

  // Then an error is thrown.
  // Then we expect a program error.
  await t.throwsAsync(promise, { message: /InvalidAuthority/ });
});

test('it can remove another seller core asset as the gumball authority', async (t) => {
  // Given a Candy Machine with one nft.
  const umi = await createUmi();
  const otherSellerUmi = await createUmi();
  const candyMachine = await createV2(umi, { settings: { itemCapacity: 1 } });
  const coreAsset = await createCoreAsset(otherSellerUmi);

  // When we add an nft to the Candy Machine.
  await transactionBuilder()
    .add(
      addCoreAsset(otherSellerUmi, {
        candyMachine: candyMachine.publicKey,
        asset: coreAsset.publicKey,
      })
    )
    .sendAndConfirm(otherSellerUmi);

  // Then remove the nft as the candy machine authority
  await transactionBuilder()
    .add(
      removeCoreAsset(umi, {
        candyMachine: candyMachine.publicKey,
        index: 0,
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
    itemsLoaded: 0,
    items: [],
  });

  // Then nft is unfrozen and revoked
  const asset = await fetchAssetV1(umi, coreAsset.publicKey);
  t.like(asset, <AssetV1>{
    freezeDelegate: {
      authority: {
        type: 'Owner',
      },
      frozen: false,
    },
    transferDelegate: {
      authority: {
        type: 'Owner',
      },
    },
    owner: otherSellerUmi.identity.publicKey,
  });
});

test('it can remove own asset as non gumball authority', async (t) => {
  // Given a Candy Machine with one nft.
  const umi = await createUmi();
  const otherSellerUmi = await createUmi();
  const candyMachine = await createV2(umi, { settings: { itemCapacity: 1 } });
  const coreAsset = await createCoreAsset(otherSellerUmi);

  // When we add an nft to the Candy Machine.
  await transactionBuilder()
    .add(
      addCoreAsset(otherSellerUmi, {
        candyMachine: candyMachine.publicKey,
        asset: coreAsset.publicKey,
      })
    )
    .sendAndConfirm(otherSellerUmi);

  // Then remove the nft as the candy machine authority
  await transactionBuilder()
    .add(
      removeCoreAsset(otherSellerUmi, {
        candyMachine: candyMachine.publicKey,
        index: 0,
        asset: coreAsset.publicKey,
      })
    )
    .sendAndConfirm(otherSellerUmi);

  // Then the Candy Machine has been updated properly.
  const candyMachineAccount = await fetchCandyMachine(
    umi,
    candyMachine.publicKey
  );

  t.like(candyMachineAccount, <Pick<CandyMachine, 'itemsLoaded' | 'items'>>{
    itemsLoaded: 0,
    items: [],
  });

  // Then nft is unfrozen and revoked
  const asset = await fetchAssetV1(umi, coreAsset.publicKey);
  t.like(asset, <AssetV1>{
    freezeDelegate: undefined,
    transferDelegate: undefined,
    owner: otherSellerUmi.identity.publicKey,
  });
});
