/* eslint-disable no-await-in-loop */
import {
  fetchToken,
  findAssociatedTokenPda,
  setComputeUnitLimit,
  TokenState,
} from '@metaplex-foundation/mpl-toolbox';
import { none, transactionBuilder } from '@metaplex-foundation/umi';
import test from 'ava';
import {
  claimNft,
  draw,
  fetchGumballMachine,
  GumballMachine,
  TokenStandard,
} from '../src';
import {
  assertItemBought as assertItemDrawn,
  create,
  createNft,
  createUmi,
} from './_setup';

test('it can claim an nft item', async (t) => {
  // Given a gumball machine with a gumball guard that has no guards.
  const umi = await createUmi();
  const nft = await createNft(umi);

  const gumballMachineSigner = await create(umi, {
    items: [
      {
        id: nft.publicKey,
        tokenStandard: TokenStandard.NonFungible,
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
  await assertItemDrawn(t, umi, {
    gumballMachine,
    buyer: buyerUmi.identity.publicKey,
  });

  await transactionBuilder()
    .add(
      claimNft(buyerUmi, {
        gumballMachine,
        index: 0,
        seller: umi.identity.publicKey,
        mint: nft.publicKey,
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
        mint: nft.publicKey,
        seller: umi.identity.publicKey,
        buyer: buyerUmi.identity.publicKey,
        tokenStandard: TokenStandard.NonFungible,
      },
    ],
  });

  // Buyer should be the owner
  // Then nft is unfrozen and revoked
  const tokenAccount = await fetchToken(
    umi,
    findAssociatedTokenPda(umi, {
      mint: nft.publicKey,
      owner: buyerUmi.identity.publicKey,
    })[0]
  );

  t.like(tokenAccount, {
    state: TokenState.Initialized,
    owner: buyerUmi.identity.publicKey,
    delegate: none(),
    amount: 1n,
  });
});

test('it cannot claim an nft item as another buyer', async (t) => {
  // Given a gumball machine with a gumball guard that has no guards.
  const umi = await createUmi();
  const nft = await createNft(umi);

  const gumballMachineSigner = await create(umi, {
    items: [
      {
        id: nft.publicKey,
        tokenStandard: TokenStandard.NonFungible,
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
      claimNft(umi, {
        gumballMachine,
        index: 0,
        seller: umi.identity.publicKey,
        mint: nft.publicKey,
      })
    )
    .sendAndConfirm(umi);

  await t.throwsAsync(promise, { message: /InvalidBuyer/ });
});
