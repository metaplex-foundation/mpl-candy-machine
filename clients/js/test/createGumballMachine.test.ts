import {
  generateSigner,
  publicKey,
  transactionBuilder,
} from '@metaplex-foundation/umi';
import test from 'ava';
import {
  createGumballMachine,
  fetchGumballMachine,
  GumballMachine,
  GumballMachineItem,
  GumballSettings,
  GumballState,
} from '../src';
import { createUmi, defaultGumballSettings } from './_setup';

test('it can create a gumball machine using config line settings', async (t) => {
  // Given an existing collection NFT.
  const umi = await createUmi();

  // When we create a new gumball machine with config line settings.
  const gumballMachine = generateSigner(umi);
  const settings: GumballSettings = {
    ...defaultGumballSettings(),
  };
  await transactionBuilder()
    .add(
      await createGumballMachine(umi, {
        gumballMachine,
        settings,
      })
    )
    .sendAndConfirm(umi);

  // Then we expect the gumball machine account to have the right data.
  const gumballMachineAccount = await fetchGumballMachine(
    umi,
    gumballMachine.publicKey
  );
  t.like(gumballMachineAccount, <GumballMachine>{
    publicKey: publicKey(gumballMachine),
    authority: publicKey(umi.identity),
    mintAuthority: publicKey(umi.identity),
    version: 0,
    itemsRedeemed: 0n,
    settings,
    state: GumballState.None,
    itemsLoaded: 0,
    items: [] as GumballMachineItem[],
  });
});

test("it can create a gumball machine that's bigger than 10Kb", async (t) => {
  // Given an existing collection NFT.
  const umi = await createUmi();

  // When we create a new gumball machine with a large amount of items.
  const gumballMachine = generateSigner(umi);
  const settings: GumballSettings = {
    ...defaultGumballSettings(),
    itemCapacity: 20000n,
  };
  await transactionBuilder()
    .add(
      await createGumballMachine(umi, {
        ...defaultGumballSettings(),
        gumballMachine,
        settings,
      })
    )
    .sendAndConfirm(umi);

  // Then we expect the gumball machine account to have been created.
  const gumballMachineAccount = await fetchGumballMachine(
    umi,
    gumballMachine.publicKey
  );
  t.like(gumballMachineAccount, <GumballMachine>{
    publicKey: publicKey(gumballMachine),
    itemsRedeemed: 0n,
    settings,
  });
});
