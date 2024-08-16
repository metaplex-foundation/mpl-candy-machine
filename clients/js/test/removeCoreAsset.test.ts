import { AssetV1, fetchAssetV1 } from '@metaplex-foundation/mpl-core';
import { generateSigner, transactionBuilder } from '@metaplex-foundation/umi';
import test from 'ava';
import {
  addCoreAsset,
  fetchGumballMachine,
  fetchSellerHistory,
  findSellerHistoryPda,
  getMerkleProof,
  getMerkleRoot,
  GumballMachine,
  removeCoreAsset,
  safeFetchSellerHistory,
  SellerHistory,
  TokenStandard,
} from '../src';
import { create, createCoreAsset, createUmi } from './_setup';

test('it can remove core asset from a gumball machine', async (t) => {
  // Given a Gumball Machine with 5 coreAssets.
  const umi = await createUmi();
  const gumballMachine = await create(umi, { settings: { itemCapacity: 5 } });
  const coreAsset = await createCoreAsset(umi);

  // When we add an nft to the Gumball Machine.
  await transactionBuilder()
    .add(
      addCoreAsset(umi, {
        gumballMachine: gumballMachine.publicKey,
        asset: coreAsset.publicKey,
      })
    )
    .sendAndConfirm(umi);

  // Then remove the nft
  await transactionBuilder()
    .add(
      removeCoreAsset(umi, {
        gumballMachine: gumballMachine.publicKey,
        index: 0,
        asset: coreAsset.publicKey,
      })
    )
    .sendAndConfirm(umi);

  // Then the Gumball Machine has been updated properly.
  const gumballMachineAccount = await fetchGumballMachine(
    umi,
    gumballMachine.publicKey
  );

  t.like(gumballMachineAccount, <Pick<GumballMachine, 'itemsLoaded' | 'items'>>{
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

  // Seller history should no longer exist
  const sellerHistoryAccount = await safeFetchSellerHistory(
    umi,
    findSellerHistoryPda(umi, {
      gumballMachine: gumballMachine.publicKey,
      seller: umi.identity.publicKey,
    })[0]
  );

  t.falsy(sellerHistoryAccount);
});

test('it can remove core asset at a lower index than last from a gumball machine', async (t) => {
  // Given a Gumball Machine with 5 coreAssets.
  const umi = await createUmi();
  const gumballMachine = await create(umi, { settings: { itemCapacity: 5 } });
  const coreAssets = await Promise.all([
    createCoreAsset(umi),
    createCoreAsset(umi),
  ]);

  // When we add two coreAssets to the Gumball Machine.
  await transactionBuilder()
    .add(
      addCoreAsset(umi, {
        gumballMachine: gumballMachine.publicKey,
        asset: coreAssets[0].publicKey,
      })
    )
    .add(
      addCoreAsset(umi, {
        gumballMachine: gumballMachine.publicKey,
        asset: coreAssets[1].publicKey,
      })
    )
    .sendAndConfirm(umi);

  // Then remove the nft
  await transactionBuilder()
    .add(
      removeCoreAsset(umi, {
        gumballMachine: gumballMachine.publicKey,
        index: 0,
        asset: coreAssets[0].publicKey,
      })
    )
    .sendAndConfirm(umi);

  // Then the Gumball Machine has been updated properly.
  const gumballMachineAccount = await fetchGumballMachine(
    umi,
    gumballMachine.publicKey
  );

  t.like(gumballMachineAccount, <Pick<GumballMachine, 'itemsLoaded' | 'items'>>{
    itemsLoaded: 1,
    items: [
      {
        index: 0,
        isDrawn: false,
        isClaimed: false,
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

test('it can remove additional core asset from a gumball machine', async (t) => {
  // Given a Gumball Machine with 5 coreAssets.
  const umi = await createUmi();
  const gumballMachine = await create(umi, { settings: { itemCapacity: 2 } });
  const coreAssets = await Promise.all([
    createCoreAsset(umi),
    createCoreAsset(umi),
  ]);

  await transactionBuilder()
    .add(
      addCoreAsset(umi, {
        gumballMachine: gumballMachine.publicKey,
        asset: coreAssets[0].publicKey,
      })
    )
    .add(
      addCoreAsset(umi, {
        gumballMachine: gumballMachine.publicKey,
        asset: coreAssets[1].publicKey,
      })
    )
    .sendAndConfirm(umi);

  // When we remove an additional item from the Gumball Machine.
  await transactionBuilder()
    .add(
      removeCoreAsset(umi, {
        gumballMachine: gumballMachine.publicKey,
        asset: coreAssets[0].publicKey,
        index: 0,
      })
    )
    .sendAndConfirm(umi);

  const sellerHistoryAccount = await fetchSellerHistory(
    umi,
    findSellerHistoryPda(umi, {
      gumballMachine: gumballMachine.publicKey,
      seller: umi.identity.publicKey,
    })[0]
  );

  t.like(sellerHistoryAccount, <SellerHistory>{
    gumballMachine: gumballMachine.publicKey,
    seller: umi.identity.publicKey,
    itemCount: 1n,
  });

  // When we remove an additional item from the Gumball Machine.
  await transactionBuilder()
    .add(
      removeCoreAsset(umi, {
        gumballMachine: gumballMachine.publicKey,
        asset: coreAssets[1].publicKey,
        index: 0,
      })
    )
    .sendAndConfirm(umi);

  // Then the Gumball Machine has been updated properly.
  const gumballMachineAccount = await fetchGumballMachine(
    umi,
    gumballMachine.publicKey
  );

  t.like(gumballMachineAccount, <Pick<GumballMachine, 'itemsLoaded' | 'items'>>{
    itemsLoaded: 0,
    items: [],
  });
});

test('it cannot remove core asset when the machine is empty', async (t) => {
  // Given an existing Gumball Machine with a capacity of 1 item.
  const umi = await createUmi();
  const gumballMachine = await create(umi, { settings: { itemCapacity: 1 } });
  const coreAsset = await createCoreAsset(umi);

  // When we try to remove an nft from the Gumball Machine.
  const promise = transactionBuilder()
    .add(
      removeCoreAsset(umi, {
        gumballMachine: gumballMachine.publicKey,
        asset: coreAsset.publicKey,
        index: 0,
      })
    )
    .sendAndConfirm(umi);

  // Then we expect an error to be thrown.
  await t.throwsAsync(promise, {
    message: /AccountNotInitialized/,
  });
});

test('it cannot remove core asset as a different seller', async (t) => {
  // Given a Gumball Machine with 5 coreAssets.
  const umi = await createUmi();
  const gumballMachine = await create(umi, { settings: { itemCapacity: 1 } });
  const nft = await createCoreAsset(umi);

  // When we add an nft to the Gumball Machine.
  await transactionBuilder()
    .add(
      addCoreAsset(umi, {
        gumballMachine: gumballMachine.publicKey,
        asset: nft.publicKey,
      })
    )
    .sendAndConfirm(umi);

  // Then remove the nft
  const promise = transactionBuilder()
    .add(
      removeCoreAsset(umi, {
        authority: generateSigner(umi),
        gumballMachine: gumballMachine.publicKey,
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
  // Given a Gumball Machine with one nft.
  const umi = await createUmi();
  const otherSellerUmi = await createUmi();
  const sellersMerkleRoot = getMerkleRoot([otherSellerUmi.identity.publicKey]);
  const gumballMachine = await create(umi, {
    settings: { itemCapacity: 1, sellersMerkleRoot },
  });
  const coreAsset = await createCoreAsset(otherSellerUmi);

  // When we add an nft to the Gumball Machine.
  await transactionBuilder()
    .add(
      addCoreAsset(otherSellerUmi, {
        gumballMachine: gumballMachine.publicKey,
        asset: coreAsset.publicKey,
        sellerProofPath: getMerkleProof(
          [otherSellerUmi.identity.publicKey],
          otherSellerUmi.identity.publicKey
        ),
      })
    )
    .sendAndConfirm(otherSellerUmi);

  // Then remove the nft as the gumball machine authority
  await transactionBuilder()
    .add(
      removeCoreAsset(umi, {
        gumballMachine: gumballMachine.publicKey,
        index: 0,
        asset: coreAsset.publicKey,
        seller: otherSellerUmi.identity.publicKey,
      })
    )
    .sendAndConfirm(umi);

  // Then the Gumball Machine has been updated properly.
  const gumballMachineAccount = await fetchGumballMachine(
    umi,
    gumballMachine.publicKey
  );

  t.like(gumballMachineAccount, <Pick<GumballMachine, 'itemsLoaded' | 'items'>>{
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
  // Given a Gumball Machine with one nft.
  const umi = await createUmi();
  const otherSellerUmi = await createUmi();
  const sellersMerkleRoot = getMerkleRoot([otherSellerUmi.identity.publicKey]);
  const gumballMachine = await create(umi, {
    settings: { itemCapacity: 1, sellersMerkleRoot },
  });
  const coreAsset = await createCoreAsset(otherSellerUmi);

  // When we add an nft to the Gumball Machine.
  await transactionBuilder()
    .add(
      addCoreAsset(otherSellerUmi, {
        gumballMachine: gumballMachine.publicKey,
        asset: coreAsset.publicKey,
        sellerProofPath: getMerkleProof(
          [otherSellerUmi.identity.publicKey],
          otherSellerUmi.identity.publicKey
        ),
      })
    )
    .sendAndConfirm(otherSellerUmi);

  // Then remove the nft as the gumball machine authority
  await transactionBuilder()
    .add(
      removeCoreAsset(otherSellerUmi, {
        gumballMachine: gumballMachine.publicKey,
        index: 0,
        asset: coreAsset.publicKey,
      })
    )
    .sendAndConfirm(otherSellerUmi);

  // Then the Gumball Machine has been updated properly.
  const gumballMachineAccount = await fetchGumballMachine(
    umi,
    gumballMachine.publicKey
  );

  t.like(gumballMachineAccount, <Pick<GumballMachine, 'itemsLoaded' | 'items'>>{
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
