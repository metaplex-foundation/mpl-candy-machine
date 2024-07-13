import { addMemo, setComputeUnitLimit } from '@metaplex-foundation/mpl-toolbox';
import { sol, some, transactionBuilder } from '@metaplex-foundation/umi';
import test from 'ava';
import { mintV2 } from '../../src';
import { assertBotTax, assertItemBought, createUmi, createV2 } from '../_setup';

test('it does nothing if all conditions are valid', async (t) => {
  // Given a candy machine with a bot tax guard.
  const umi = await createUmi();

  const { publicKey: candyMachine } = await createV2(umi, {
    items: [
      {
        id: (await createNft(umi)).publicKey,
        tokenStandard: TokenStandard.NonFungible,
      },
    ],
    startSale: true,
    guards: {
      botTax: some({ lamports: sol(0.01), lastInstruction: true }),
    },
  });

  // When we mint from it.

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

test('it optionally charges a bot tax if the mint instruction is not the last one', async (t) => {
  // Given a candy machine with a bot tax guard with lastInstruction set to true.
  const umi = await createUmi();

  const { publicKey: candyMachine } = await createV2(umi, {
    items: [
      {
        id: (await createNft(umi)).publicKey,
        tokenStandard: TokenStandard.NonFungible,
      },
    ],
    startSale: true,
    guards: {
      botTax: some({ lamports: sol(0.01), lastInstruction: true }),
    },
  });

  // When we try to mint from it whilst having more instructions after the mint instruction.

  const { signature } = await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      mintV2(umi, {
        candyMachine,
      })
    )
    .add(addMemo(umi, { memo: 'I am a post-mint instruction' }))
    .sendAndConfirm(umi);

  // Then we expect a silent bot tax error.
  await assertBotTax(t, umi, signature, /MintNotLastTransaction/);
});
