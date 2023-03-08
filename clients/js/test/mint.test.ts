import { publicKey, transactionBuilder } from '@metaplex-foundation/umi';
import test from 'ava';
import { CandyMachine, fetchCandyMachine, wrap } from '../src';
import { createCandyGuard, createCandyMachine, createUmi } from './_setup';

test.skip('it can mint from a candy guard with no guards', async (t) => {
  // Given an existing candy machine and candy guard.
  const umi = await createUmi();
  const candyMachine = (await createCandyMachine(umi)).publicKey;
  const candyGuard = await createCandyGuard(umi);

  // When we wrap the candy machine in the candy guard.
  await transactionBuilder(umi)
    .add(wrap(umi, { candyMachine, candyGuard }))
    .sendAndConfirm();

  // Then the mint authority of the candy machine is the candy guard.
  const candyMachineAccount = await fetchCandyMachine(umi, candyMachine);
  t.like(candyMachineAccount, <CandyMachine>{
    authority: publicKey(umi.identity),
    mintAuthority: publicKey(candyGuard),
  });
});
