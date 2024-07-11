import { setComputeUnitLimit } from '@metaplex-foundation/mpl-toolbox';
import {
  generateSigner,
  sol,
  some,
  transactionBuilder,
} from '@metaplex-foundation/umi';
import test from 'ava';
import { mintV2 } from '../../src';
import {
  assertBotTax,
  assertItemBought,
  createCollectionNft,
  createUmi,
  createV2,
  getNewConfigLine,
} from '../_setup';

test('it allows minting until a threshold of NFTs have been redeemed', async (t) => {
  // Given a loaded Candy Machine with a redeemedAmount guard with a threshold of 1 NFT.
  const umi = await createUmi();

  const { publicKey: candyMachine } = await createV2(umi, {
    configLines: [await getNewConfigLine(umi), await getNewConfigLine(umi)],
    guards: {
      redeemedAmount: some({ maximum: 1 }),
    },
  });

  // When we mint its first item.

  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      mintV2(umi, {
        candyMachine,
      })
    )
    .sendAndConfirm(umi);

  // Then minting was successful.
  await assertItemBought(t, umi, { candyMachine });
});

test('it forbids minting once the redeemed threshold has been reached', async (t) => {
  // Given a loaded Candy Machine with a redeemedAmount guard with a threshold of 1 NFT.
  const umi = await createUmi();

  const { publicKey: candyMachine } = await createV2(umi, {
    configLines: [await getNewConfigLine(umi), await getNewConfigLine(umi)],
    guards: {
      redeemedAmount: some({ maximum: 1 }),
    },
  });

  // And assuming its first item has already been minted.

  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      mintV2(umi, {
        candyMachine,
      })
    )
    .sendAndConfirm(umi);
  await assertItemBought(t, umi, { candyMachine });

  // When we try to mint its second item.

  const promise = transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      mintV2(umi, {
        candyMachine,
      })
    )
    .sendAndConfirm(umi);

  // Then we expect a program error.
  await t.throwsAsync(promise, { message: /MaximumRedeemedAmount/ });
});

test('it charges a bot tax when trying to mint once the threshold has been reached', async (t) => {
  // Given a loaded Candy Machine with a bot tax guard
  // and a redeemedAmount guard with a threshold of 1 NFT.
  const umi = await createUmi();

  const { publicKey: candyMachine } = await createV2(umi, {
    configLines: [await getNewConfigLine(umi), await getNewConfigLine(umi)],
    guards: {
      botTax: some({ lamports: sol(0.1), lastInstruction: true }),
      redeemedAmount: some({ maximum: 1 }),
    },
  });

  // And assuming its first item has already been minted.

  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      mintV2(umi, {
        candyMachine,
      })
    )
    .sendAndConfirm(umi);
  await assertItemBought(t, umi, { candyMachine });

  // When we try to mint its second item.

  const { signature } = await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      mintV2(umi, {
        candyMachine,
      })
    )
    .sendAndConfirm(umi);

  // Then we expect a silent bot tax error.
  await assertBotTax(t, umi, signature, /MaximumRedeemedAmount/);
});
