import { AssetV1, fetchAssetV1 } from '@metaplex-foundation/mpl-core';
import { transactionBuilder } from '@metaplex-foundation/umi';
import test from 'ava';
import {
  addCoreAsset,
  fetchGumballMachine,
  fetchSellerHistory,
  findGumballMachineAuthorityPda,
  findSellerHistoryPda,
  getMerkleProof,
  getMerkleRoot,
  GumballMachine,
  SellerHistory,
  TokenStandard,
} from '../src';
import { create, createCoreAsset, createUmi } from './_setup';

test('it can add core assets to a gumball machine', async (t) => {
  // Given a Gumball Machine with 5 core assets.
  const umi = await createUmi();
  const gumballMachine = await create(umi, { settings: { itemCapacity: 5 } });
  const coreAsset = await createCoreAsset(umi);

  // When we add an coreAsset to the Gumball Machine.
  await transactionBuilder()
    .add(
      addCoreAsset(umi, {
        gumballMachine: gumballMachine.publicKey,
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
    itemsLoaded: 1,
    items: [
      {
        index: 0,
        isDrawn: false,
        isClaimed: false,
        mint: coreAsset.publicKey,
        seller: umi.identity.publicKey,
        buyer: undefined,
        tokenStandard: TokenStandard.Core,
      },
    ],
  });

  const asset = await fetchAssetV1(umi, coreAsset.publicKey);
  t.like(asset, <AssetV1>{
    owner: umi.identity.publicKey,
    transferDelegate: {
      authority: {
        type: 'Address',
        address: findGumballMachineAuthorityPda(umi, {
          gumballMachine: gumballMachine.publicKey,
        })[0],
      },
    },
    freezeDelegate: {
      authority: {
        type: 'Address',
        address: findGumballMachineAuthorityPda(umi, {
          gumballMachine: gumballMachine.publicKey,
        })[0],
      },
      frozen: true,
    },
  });

  // Seller history state is correct
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
});

test('it can add core asset to a gumball machine as allowlisted seller', async (t) => {
  // Given a Gumball Machine with 5 core assets.
  const umi = await createUmi();
  const otherSellerUmi = await createUmi();
  const sellersMerkleRoot = getMerkleRoot([otherSellerUmi.identity.publicKey]);
  const gumballMachine = await create(umi, {
    settings: { itemCapacity: 5, sellersMerkleRoot },
  });
  const coreAsset = await createCoreAsset(otherSellerUmi);

  // When we add an coreAsset to the Gumball Machine.
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
        mint: coreAsset.publicKey,
        seller: otherSellerUmi.identity.publicKey,
        buyer: undefined,
        tokenStandard: TokenStandard.Core,
      },
    ],
  });

  const asset = await fetchAssetV1(umi, coreAsset.publicKey);
  t.like(asset, <AssetV1>{
    owner: otherSellerUmi.identity.publicKey,
    transferDelegate: {
      authority: {
        type: 'Address',
        address: findGumballMachineAuthorityPda(umi, {
          gumballMachine: gumballMachine.publicKey,
        })[0],
      },
    },
    freezeDelegate: {
      authority: {
        type: 'Address',
        address: findGumballMachineAuthorityPda(umi, {
          gumballMachine: gumballMachine.publicKey,
        })[0],
      },
      frozen: true,
    },
  });
});

test('it cannot add core asset as non gumball authority when there is no seller allowlist set', async (t) => {
  // Given a Gumball Machine with 5 nfts.
  const umi = await createUmi();
  const otherSellerUmi = await createUmi();
  const gumballMachine = await create(umi, { settings: { itemCapacity: 5 } });
  const coreAsset = await createCoreAsset(otherSellerUmi);

  // When we add an nft to the Gumball Machine.
  const promise = transactionBuilder()
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

  await t.throwsAsync(promise, { message: /InvalidProofPath/ });
});

test('it cannot add core asset as non-allowlisted seller when there is a seller allowlist set', async (t) => {
  // Given a Gumball Machine with 5 nfts.
  const umi = await createUmi();
  const otherSellerUmi = await createUmi();
  const gumballMachine = await create(umi, {
    settings: {
      itemCapacity: 5,
      sellersMerkleRoot: getMerkleRoot([umi.identity.publicKey]),
    },
  });
  const coreAsset = await createCoreAsset(otherSellerUmi);

  // When we add an nft to the Gumball Machine.
  const promise = transactionBuilder()
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

  await t.throwsAsync(promise, { message: /InvalidProofPath/ });
});

test('it can append additional core assets to a gumball machine', async (t) => {
  // Given a Gumball Machine with 5 core assets.
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
    .sendAndConfirm(umi);

  // When we add an additional item to the Gumball Machine.
  await transactionBuilder()
    .add(
      addCoreAsset(umi, {
        gumballMachine: gumballMachine.publicKey,
        asset: coreAssets[1].publicKey,
      })
    )
    .sendAndConfirm(umi);

  // Then the Gumball Machine has been updated properly.
  const gumballMachineAccount = await fetchGumballMachine(
    umi,
    gumballMachine.publicKey
  );

  t.like(gumballMachineAccount, <Pick<GumballMachine, 'itemsLoaded' | 'items'>>{
    itemsLoaded: 2,
    items: [
      {
        index: 0,
        isDrawn: false,
        isClaimed: false,
        mint: coreAssets[0].publicKey,
        seller: umi.identity.publicKey,
        buyer: undefined,
        tokenStandard: TokenStandard.Core,
      },
      {
        index: 1,
        isDrawn: false,
        isClaimed: false,
        mint: coreAssets[1].publicKey,
        seller: umi.identity.publicKey,
        buyer: undefined,
        tokenStandard: TokenStandard.Core,
      },
    ],
  });
});

test('it cannot add core assets that would make the gumball machine exceed the maximum capacity', async (t) => {
  // Given an existing Gumball Machine with a capacity of 1 item.
  const umi = await createUmi();
  const gumballMachine = await create(umi, { settings: { itemCapacity: 1 } });
  const coreAssets = await Promise.all([
    createCoreAsset(umi),
    createCoreAsset(umi),
  ]);

  // When we try to add 2 coreAssets to the Gumball Machine.
  const promise = transactionBuilder()
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

  // Then we expect an error to be thrown.
  await t.throwsAsync(promise, {
    message: /IndexGreaterThanLength/,
  });
});

test('it cannot add core assets once the gumball machine is fully loaded', async (t) => {
  // Given an existing Gumball Machine with 2 core assets loaded and a capacity of 2 core assets.
  const umi = await createUmi();
  const gumballMachine = await create(umi, { settings: { itemCapacity: 1 } });
  const coreAsset = await createCoreAsset(umi);

  await transactionBuilder()
    .add(
      addCoreAsset(umi, {
        gumballMachine: gumballMachine.publicKey,
        asset: coreAsset.publicKey,
      })
    )
    .sendAndConfirm(umi);

  // When we try to add one more item to the Gumball Machine.
  const promise = transactionBuilder()
    .add(
      addCoreAsset(umi, {
        gumballMachine: gumballMachine.publicKey,
        asset: (await createCoreAsset(umi)).publicKey,
      })
    )
    .sendAndConfirm(umi);

  // Then we expect an error to be thrown.
  await t.throwsAsync(promise, {
    message: /IndexGreaterThanLength/,
  });
});

test('it cannot add more core assets than allowed per seller', async (t) => {
  // Given a Gumball Machine with 5 core assets.
  const umi = await createUmi();
  const otherSellerUmi = await createUmi();
  const sellersMerkleRoot = getMerkleRoot([otherSellerUmi.identity.publicKey]);
  const gumballMachine = await create(umi, {
    settings: { itemCapacity: 2, itemsPerSeller: 1, sellersMerkleRoot },
  });
  const coreAssets = await Promise.all([
    createCoreAsset(otherSellerUmi),
    createCoreAsset(otherSellerUmi),
  ]);
  // When we add an nft to the Gumball Machine.
  await transactionBuilder()
    .add(
      addCoreAsset(otherSellerUmi, {
        gumballMachine: gumballMachine.publicKey,
        asset: coreAssets[0].publicKey,
        sellerProofPath: getMerkleProof(
          [otherSellerUmi.identity.publicKey],
          otherSellerUmi.identity.publicKey
        ),
      })
    )
    .sendAndConfirm(otherSellerUmi);

  const promise = transactionBuilder()
    .add(
      addCoreAsset(otherSellerUmi, {
        gumballMachine: gumballMachine.publicKey,
        asset: coreAssets[1].publicKey,
        sellerProofPath: getMerkleProof(
          [otherSellerUmi.identity.publicKey],
          otherSellerUmi.identity.publicKey
        ),
      })
    )
    .sendAndConfirm(otherSellerUmi);

  await t.throwsAsync(promise, { message: /SellerTooManyItems/ });
});
