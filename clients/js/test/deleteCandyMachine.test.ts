import { transactionBuilder } from '@metaplex-foundation/umi';
import test from 'ava';
import { deleteCandyMachine } from '../src';
import { createV1, createV2, createUmi } from './_setup';

test('it can delete a candy machine V1', async (t) => {
  // Given an existing candy machine.
  const umi = await createUmi();
  const candyMachine = await createV1(umi);

  // When we delete it.
  await transactionBuilder()
    .add(deleteCandyMachine(umi, { candyMachine: candyMachine.publicKey }))
    .sendAndConfirm(umi);

  // Then the candy machine account no longer exists.
  t.false(await umi.rpc.accountExists(candyMachine.publicKey));
});

test('it can delete a candy machine V2', async (t) => {
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
