import { transactionBuilder } from '@metaplex-foundation/umi';
import test from 'ava';
import { deleteCandyMachine, TokenStandard } from '../src';
import { createNft, createUmi, createV2 } from './_setup';

test('it can delete an empty candy machine', async (t) => {
  // Given an existing candy machine.
  const umi = await createUmi();
  const candyMachine = await createV2(umi);

  // When we delete it.
  await transactionBuilder()
    .add(deleteCandyMachine(umi, { candyMachine: candyMachine.publicKey }))
    .sendAndConfirm(umi);

  // Then the candy machine account no longer exists.
  t.false(await umi.rpc.accountExists(candyMachine.publicKey));
});

test('it cannot delete a candy machine that has not been fully settled', async (t) => {
  // Given an existing candy machine.
  const umi = await createUmi();
  const candyMachine = await createV2(umi, {
    items: [
      {
        id: (await createNft(umi)).publicKey,
        tokenStandard: TokenStandard.NonFungible,
      },
    ],
  });

  // When we delete it.
  const promise = transactionBuilder()
    .add(deleteCandyMachine(umi, { candyMachine: candyMachine.publicKey }))
    .sendAndConfirm(umi);

  // Then the transaction fails.
  await t.throwsAsync(promise, { message: /InvalidState/ });
});
