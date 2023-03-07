import { generateSigner, transactionBuilder } from '@metaplex-foundation/umi';
import test from 'ava';
import { createCandyGuard, deleteCandyGuard, findCandyGuardPda } from '../src';
import { createUmi } from './_setup';

test('it can delete a candy guard', async (t) => {
  // Given an existing candy guard.
  const umi = await createUmi();
  const base = generateSigner(umi);
  const candyGuard = findCandyGuardPda(umi, { base: base.publicKey });
  await transactionBuilder(umi)
    .add(createCandyGuard(umi, { base }))
    .sendAndConfirm();

  // When we delete it.
  await transactionBuilder(umi)
    .add(deleteCandyGuard(umi, { candyGuard }))
    .sendAndConfirm();

  // Then the candy guard account no longer exists.
  t.false(await umi.rpc.accountExists(candyGuard));
});
