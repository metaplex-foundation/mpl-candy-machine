import { AssetV1, fetchAssetV1, transfer } from '@metaplex-foundation/mpl-core';
import { generateSigner, transactionBuilder } from '@metaplex-foundation/umi';
import test from 'ava';
import {
  addCoreAsset,
  CandyMachine,
  fetchCandyMachine,
  findCandyMachineAuthorityPda,
  getMerkleProof,
  getMerkleRoot,
  TokenStandard,
} from '../src';
import { createCoreAsset, createUmi, createV2 } from './_setup';

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

  const asset = await fetchAssetV1(umi, coreAsset.publicKey);
  t.like(asset, <AssetV1>{
    owner: umi.identity.publicKey,
    transferDelegate: {
      authority: {
        type: 'Address',
        address: findCandyMachineAuthorityPda(umi, {
          candyMachine: candyMachine.publicKey,
        })[0],
      },
    },
    freezeDelegate: {
      authority: {
        type: 'Address',
        address: findCandyMachineAuthorityPda(umi, {
          candyMachine: candyMachine.publicKey,
        })[0],
      },
      frozen: true,
    },
  });
});

test('it can add core asset to a gumball machine as allowlisted seller', async (t) => {
  // Given a Candy Machine with 5 core assets.
  const umi = await createUmi();
  const otherSellerUmi = await createUmi();
  const sellersMerkleRoot = getMerkleRoot([otherSellerUmi.identity.publicKey]);
  const candyMachine = await createV2(umi, {
    settings: { itemCapacity: 5, sellersMerkleRoot },
  });
  const coreAsset = await createCoreAsset(otherSellerUmi);

  // When we add an coreAsset to the Candy Machine.
  await transactionBuilder()
    .add(
      addCoreAsset(otherSellerUmi, {
        candyMachine: candyMachine.publicKey,
        asset: coreAsset.publicKey,
        sellerProofPath: getMerkleProof(
          [otherSellerUmi.identity.publicKey],
          otherSellerUmi.identity.publicKey
        ),
      })
    )
    .sendAndConfirm(otherSellerUmi);

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
        address: findCandyMachineAuthorityPda(umi, {
          candyMachine: candyMachine.publicKey,
        })[0],
      },
    },
    freezeDelegate: {
      authority: {
        type: 'Address',
        address: findCandyMachineAuthorityPda(umi, {
          candyMachine: candyMachine.publicKey,
        })[0],
      },
      frozen: true,
    },
  });
});

test('it cannot add core asset as non gumball authority when there is no seller allowlist set', async (t) => {
  // Given a Candy Machine with 5 nfts.
  const umi = await createUmi();
  const otherSellerUmi = await createUmi();
  const candyMachine = await createV2(umi, { settings: { itemCapacity: 5 } });
  const coreAsset = await createCoreAsset(otherSellerUmi);

  // When we add an nft to the Candy Machine.
  const promise = transactionBuilder()
    .add(
      addCoreAsset(otherSellerUmi, {
        candyMachine: candyMachine.publicKey,
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
  // Given a Candy Machine with 5 nfts.
  const umi = await createUmi();
  const otherSellerUmi = await createUmi();
  const candyMachine = await createV2(umi, {
    settings: {
      itemCapacity: 5,
      sellersMerkleRoot: getMerkleRoot([umi.identity.publicKey]),
    },
  });
  const coreAsset = await createCoreAsset(otherSellerUmi);

  // When we add an nft to the Candy Machine.
  const promise = transactionBuilder()
    .add(
      addCoreAsset(otherSellerUmi, {
        candyMachine: candyMachine.publicKey,
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
