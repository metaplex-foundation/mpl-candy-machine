import { publicKey, transactionBuilder } from '@metaplex-foundation/umi';
import test from 'ava';
import { CandyMachine, fetchCandyMachine, unwrap, wrap } from '../src';
import { createCandyGuard, createUmi, createV1, createV2 } from './_setup';

test('it can unwrap a candy machine v1 from its candy guard', async (t) => {
  // Given an existing candy machine and a candy guard associated with it.
  const umi = await createUmi();
  const candyMachine = (await createV1(umi)).publicKey;
  const candyGuard = await createCandyGuard(umi);
  await transactionBuilder()
    .add(wrap(umi, { candyMachine, candyGuard }))
    .sendAndConfirm(umi);

  // When we unwrap the candy machine from its candy guard.
  await transactionBuilder()
    .add(unwrap(umi, { candyMachine, candyGuard }))
    .sendAndConfirm(umi);

  // Then the mint authority of the candy machine was updated accordingly.
  const candyMachineAccount = await fetchCandyMachine(umi, candyMachine);
  t.like(candyMachineAccount, <CandyMachine>{
    authority: publicKey(umi.identity),
    mintAuthority: publicKey(umi.identity),
  });
});

test('it can unwrap a candy machine v2 from its candy guard', async (t) => {
  // Given an existing candy machine and a candy guard associated with it.
  const umi = await createUmi();
  const candyMachine = (await createV2(umi)).publicKey;
  const candyGuard = await createCandyGuard(umi);
  await transactionBuilder()
    .add(wrap(umi, { candyMachine, candyGuard }))
    .sendAndConfirm(umi);

  // When we unwrap the candy machine from its candy guard.
  await transactionBuilder()
    .add(unwrap(umi, { candyMachine, candyGuard }))
    .sendAndConfirm(umi);

  // Then the mint authority of the candy machine was updated accordingly.
  const candyMachineAccount = await fetchCandyMachine(umi, candyMachine);
  t.like(candyMachineAccount, <CandyMachine>{
    authority: publicKey(umi.identity),
    mintAuthority: publicKey(umi.identity),
  });
});
