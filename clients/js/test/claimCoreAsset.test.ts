/* eslint-disable no-await-in-loop */
import { AssetV1, fetchAssetV1 } from '@metaplex-foundation/mpl-core';
import { setComputeUnitLimit } from '@metaplex-foundation/mpl-toolbox';
import { transactionBuilder } from '@metaplex-foundation/umi';
import test from 'ava';
import {
  claimCoreAsset,
  draw,
  fetchGumballMachine,
  GumballMachine,
  TokenStandard,
} from '../src';
import { assertItemBought, create, createCoreAsset, createUmi } from './_setup';

test('it can claim a core asset item', async (t) => {
  // Given a gumball machine with a gumball guard that has no guards.
  const umi = await createUmi();
  const asset = await createCoreAsset(umi);

  const gumballMachineSigner = await create(umi, {
    items: [
      {
        id: asset.publicKey,
        tokenStandard: TokenStandard.Core,
      },
    ],
    startSale: true,
    guards: {},
  });
  const gumballMachine = gumballMachineSigner.publicKey;

  // When we mint from the gumball guard.
  const buyerUmi = await createUmi();
  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      draw(buyerUmi, {
        gumballMachine,
      })
    )
    .sendAndConfirm(buyerUmi);

  // Then the mint was successful.
  await assertItemBought(t, umi, {
    gumballMachine,
    buyer: buyerUmi.identity.publicKey,
  });

  await transactionBuilder()
    .add(
      claimCoreAsset(buyerUmi, {
        gumballMachine,
        index: 0,
        seller: umi.identity.publicKey,
        asset: asset.publicKey,
      })
    )
    .sendAndConfirm(buyerUmi);

  // And the gumball machine was updated.
  const gumballMachineAccount = await fetchGumballMachine(umi, gumballMachine);
  t.like(gumballMachineAccount, <Partial<GumballMachine>>{
    itemsRedeemed: 1n,
    itemsSettled: 0n,
    items: [
      {
        index: 0,
        isDrawn: true,
        isClaimed: true,
        mint: asset.publicKey,
        seller: umi.identity.publicKey,
        buyer: buyerUmi.identity.publicKey,
        tokenStandard: TokenStandard.Core,
      },
    ],
  });

  // Buyer should be the owner
  // Then nft is unfrozen and revoked
  const coreAsset = await fetchAssetV1(umi, asset.publicKey);
  t.like(coreAsset, <AssetV1>{
    freezeDelegate: undefined,
    transferDelegate: undefined,
    owner: buyerUmi.identity.publicKey,
  });
});

test('it cannot claim a core asset item as another buyer', async (t) => {
  // Given a gumball machine with a gumball guard that has no guards.
  const umi = await createUmi();
  const asset = await createCoreAsset(umi);

  const gumballMachineSigner = await create(umi, {
    items: [
      {
        id: asset.publicKey,
        tokenStandard: TokenStandard.Core,
      },
    ],
    startSale: true,
    guards: {},
  });
  const gumballMachine = gumballMachineSigner.publicKey;

  // When we mint from the gumball guard.
  const buyerUmi = await createUmi();
  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      draw(buyerUmi, {
        gumballMachine,
      })
    )
    .sendAndConfirm(buyerUmi);

  const promise = transactionBuilder()
    .add(
      claimCoreAsset(umi, {
        gumballMachine,
        index: 0,
        seller: umi.identity.publicKey,
        asset: asset.publicKey,
      })
    )
    .sendAndConfirm(umi);

  await t.throwsAsync(promise, { message: /InvalidBuyer/ });
});
