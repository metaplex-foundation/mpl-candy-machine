import { publicKey, transactionBuilder } from '@metaplex-foundation/umi';
import test from 'ava';
import { fetchGumballMachine, GumballMachine, wrap } from '../src';
import { create, createGumballGuard, createUmi } from './_setup';

test('it can wrap a gumball machine v2 in a gumball guard', async (t) => {
  // Given an existing gumball machine and gumball guard.
  const umi = await createUmi();
  const gumballMachine = (await create(umi)).publicKey;
  const gumballGuard = await createGumballGuard(umi);

  // When we wrap the gumball machine in the gumball guard.
  await transactionBuilder()
    .add(wrap(umi, { gumballMachine, gumballGuard }))
    .sendAndConfirm(umi);

  // Then the mint authority of the gumball machine is the gumball guard.
  const gumballMachineAccount = await fetchGumballMachine(umi, gumballMachine);
  t.like(gumballMachineAccount, <GumballMachine>{
    authority: publicKey(umi.identity),
    mintAuthority: publicKey(gumballGuard),
  });
});

test('it can update the gumball guard associated with a gumball machine', async (t) => {
  // Given an existing gumball machine and a gumball guard associated with it.
  const umi = await createUmi();
  const gumballMachine = (await create(umi)).publicKey;
  const gumballGuardA = await createGumballGuard(umi);
  await transactionBuilder()
    .add(wrap(umi, { gumballMachine, gumballGuard: gumballGuardA }))
    .sendAndConfirm(umi);

  // When we wrap the gumball machine in a different gumball guard.
  const gumballGuardB = await createGumballGuard(umi);
  await transactionBuilder()
    .add(wrap(umi, { gumballMachine, gumballGuard: gumballGuardB }))
    .sendAndConfirm(umi);

  // Then the mint authority of the gumball machine was updated accordingly.
  const gumballMachineAccount = await fetchGumballMachine(umi, gumballMachine);
  t.like(gumballMachineAccount, <GumballMachine>{
    authority: publicKey(umi.identity),
    mintAuthority: publicKey(gumballGuardB),
  });
});
