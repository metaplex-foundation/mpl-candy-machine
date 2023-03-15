import { publicKey, transactionBuilder } from '@metaplex-foundation/umi';
import test from 'ava';
import { CandyMachine, fetchCandyMachine, wrap } from '../src';
import { createCandyGuard, createUmi, createV1, createV2 } from './_setup';

test('it can wrap a candy machine v1 in a candy guard', async (t) => {
  // Given an existing candy machine and candy guard.
  const umi = await createUmi();
  const candyMachine = (await createV1(umi)).publicKey;
  const candyGuard = await createCandyGuard(umi);

  // When we wrap the candy machine in the candy guard.
  await transactionBuilder()
    .add(wrap(umi, { candyMachine, candyGuard }))
    .sendAndConfirm(umi);

  // Then the mint authority of the candy machine is the candy guard.
  const candyMachineAccount = await fetchCandyMachine(umi, candyMachine);
  t.like(candyMachineAccount, <CandyMachine>{
    authority: publicKey(umi.identity),
    mintAuthority: publicKey(candyGuard),
  });
});

test('it can wrap a candy machine v2 in a candy guard', async (t) => {
  // Given an existing candy machine and candy guard.
  const umi = await createUmi();
  const candyMachine = (await createV2(umi)).publicKey;
  const candyGuard = await createCandyGuard(umi);

  // When we wrap the candy machine in the candy guard.
  await transactionBuilder()
    .add(wrap(umi, { candyMachine, candyGuard }))
    .sendAndConfirm(umi);

  // Then the mint authority of the candy machine is the candy guard.
  const candyMachineAccount = await fetchCandyMachine(umi, candyMachine);
  t.like(candyMachineAccount, <CandyMachine>{
    authority: publicKey(umi.identity),
    mintAuthority: publicKey(candyGuard),
  });
});

test('it can update the candy guard associated with a candy machine', async (t) => {
  // Given an existing candy machine and a candy guard associated with it.
  const umi = await createUmi();
  const candyMachine = (await createV2(umi)).publicKey;
  const candyGuardA = await createCandyGuard(umi);
  await transactionBuilder()
    .add(wrap(umi, { candyMachine, candyGuard: candyGuardA }))
    .sendAndConfirm(umi);

  // When we wrap the candy machine in a different candy guard.
  const candyGuardB = await createCandyGuard(umi);
  await transactionBuilder()
    .add(wrap(umi, { candyMachine, candyGuard: candyGuardB }))
    .sendAndConfirm(umi);

  // Then the mint authority of the candy machine was updated accordingly.
  const candyMachineAccount = await fetchCandyMachine(umi, candyMachine);
  t.like(candyMachineAccount, <CandyMachine>{
    authority: publicKey(umi.identity),
    mintAuthority: publicKey(candyGuardB),
  });
});
