import { transactionBuilder } from '@metaplex-foundation/umi';
import test from 'ava';
import { deleteGumballGuard } from '../src';
import { createGumballGuard, createUmi } from './_setup';

test('it can delete a gumball guard', async (t) => {
  // Given an existing gumball guard.
  const umi = await createUmi();
  const [gumballGuard] = await createGumballGuard(umi);

  // When we delete it.
  await transactionBuilder()
    .add(deleteGumballGuard(umi, { gumballGuard }))
    .sendAndConfirm(umi);

  // Then the gumball guard account no longer exists.
  t.false(await umi.rpc.accountExists(gumballGuard));
});
