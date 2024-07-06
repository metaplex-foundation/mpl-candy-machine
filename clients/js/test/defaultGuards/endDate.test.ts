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
  tomorrow,
  yesterday,
} from '../_setup';

test('it allows minting before the end date', async (t) => {
  // Given a candy machine with an end date in the future.
  const umi = await createUmi();

  const { publicKey: candyMachine } = await createV2(umi, {
    configLines: [getNewConfigLine()],
    guards: {
      endDate: some({ date: tomorrow() }),
    },
  });

  // When we mint it.

  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      mintV2(umi, {
        candyMachine,
      })
    )
    .sendAndConfirm(umi);

  // Then the mint was successful.
  await assertItemBought(t, umi, { candyMachine });
});

test('it forbids minting after the end date', async (t) => {
  // Given a candy machine with an end date in the past.
  const umi = await createUmi();

  const { publicKey: candyMachine } = await createV2(umi, {
    configLines: [getNewConfigLine()],
    guards: {
      endDate: some({ date: yesterday() }),
    },
  });

  // When we try to mint from it.

  const promise = transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      mintV2(umi, {
        candyMachine,
      })
    )
    .sendAndConfirm(umi);

  // Then we expect a program error.
  await t.throwsAsync(promise, { message: /AfterEndDate/ });
});

test('it charges a bot tax when trying to mint after the end date', async (t) => {
  // Given a candy machine with a bot tax and end date in the past.
  const umi = await createUmi();

  const { publicKey: candyMachine } = await createV2(umi, {
    configLines: [getNewConfigLine()],
    guards: {
      botTax: some({ lamports: sol(0.01), lastInstruction: true }),
      endDate: some({ date: yesterday() }),
    },
  });

  // When we mint it.

  const { signature } = await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      mintV2(umi, {
        candyMachine,
      })
    )
    .sendAndConfirm(umi);

  // Then we expect a silent bot tax error.
  await assertBotTax(t, umi, signature, /AfterEndDate/);
});
