import { transactionBuilder } from '@metaplex-foundation/umi';
import test from 'ava';
import { deleteCandyMachine } from '../src';
import { createCandyMachine, createUmi } from './_setup';

test('it can delete a candy machine', async (t) => {
  // Given an existing candy machine.
  const umi = await createUmi();
  const candyMachine = await createCandyMachine(umi);

  // When we delete it.
  await transactionBuilder(umi)
    .add(deleteCandyMachine(umi, { candyMachine: candyMachine.publicKey }))
    .sendAndConfirm();

  // Then the candy machine account no longer exists.
  t.false(await umi.rpc.accountExists(candyMachine.publicKey));
});
