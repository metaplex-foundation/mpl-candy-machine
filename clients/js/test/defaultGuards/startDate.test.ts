import { setComputeUnitLimit } from '@metaplex-foundation/mpl-toolbox';
import { sol, some, transactionBuilder } from '@metaplex-foundation/umi';
import test from 'ava';
import { draw, TokenStandard } from '../../src';
import {
  assertBotTax,
  assertItemBought,
  create,
  createNft,
  createUmi,
  tomorrow,
  yesterday,
} from '../_setup';

test('it allows minting after the start date', async (t) => {
  // Given a candy machine with a start date in the past.
  const umi = await createUmi();

  const { publicKey: candyMachine } = await create(umi, {
    items: [
      {
        id: (await createNft(umi)).publicKey,
        tokenStandard: TokenStandard.NonFungible,
      },
    ],
    startSale: true,
    guards: {
      startDate: some({ date: yesterday() }),
    },
  });

  // When we mint from it.

  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      draw(umi, {
        candyMachine,
      })
    )
    .sendAndConfirm(umi);

  // Then the mint was successful.
  await assertItemBought(t, umi, { candyMachine });
});

test('it forbids minting before the start date', async (t) => {
  // Given a candy machine with a start date in the future.
  const umi = await createUmi();

  const { publicKey: candyMachine } = await create(umi, {
    items: [
      {
        id: (await createNft(umi)).publicKey,
        tokenStandard: TokenStandard.NonFungible,
      },
    ],
    startSale: true,
    guards: {
      startDate: some({ date: tomorrow() }),
    },
  });

  // When we try to mint from it.

  const promise = transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      draw(umi, {
        candyMachine,
      })
    )
    .sendAndConfirm(umi);

  // Then we expect a program error.
  await t.throwsAsync(promise, { message: /MintNotLive/ });
});

test('it charges a bot tax when trying to mint before the start date', async (t) => {
  // Given a candy machine with a bot tax and start date in the future.
  const umi = await createUmi();

  const { publicKey: candyMachine } = await create(umi, {
    items: [
      {
        id: (await createNft(umi)).publicKey,
        tokenStandard: TokenStandard.NonFungible,
      },
    ],
    startSale: true,
    guards: {
      botTax: some({ lamports: sol(0.01), lastInstruction: true }),
      startDate: some({ date: tomorrow() }),
    },
  });

  // When we mint from it.

  const { signature } = await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      draw(umi, {
        candyMachine,
      })
    )
    .sendAndConfirm(umi);

  // Then we expect a silent bot tax error.
  await assertBotTax(t, umi, signature, /MintNotLive/);
});
