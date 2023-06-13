import { transactionBuilder } from '@metaplex-foundation/umi';
import test from 'ava';
import { deleteCandyGuard } from '../src';
import { createCandyGuard, createUmi } from './_setup';

test('it can delete a candy guard', async (t) => {
  // Given an existing candy guard.
  const umi = await createUmi();
  const [candyGuard] = await createCandyGuard(umi);

  // When we delete it.
  await transactionBuilder()
    .add(deleteCandyGuard(umi, { candyGuard }))
    .sendAndConfirm(umi);

  // Then the candy guard account no longer exists.
  t.false(await umi.rpc.accountExists(candyGuard));
});
