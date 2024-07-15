import {
  generateSigner,
  none,
  publicKey,
  transactionBuilder,
} from '@metaplex-foundation/umi';
import test from 'ava';
import {
  CandyMachine,
  CandyMachineItem,
  createCandyMachine,
  fetchCandyMachine,
  GumballSettings,
  GumballState,
} from '../src';
import { createUmi, defaultGumballSettings } from './_setup';

test('it can create a candy machine using config line settings', async (t) => {
  // Given an existing collection NFT.
  const umi = await createUmi();

  // When we create a new candy machine with config line settings.
  const candyMachine = generateSigner(umi);
  const settings: GumballSettings = {
    uri: 'https://arweave.net/abc123',
    itemCapacity: 20n,
    itemsPerSeller: 1,
    sellersMerkleRoot: none(),
    curatorFeeBps: 500,
    hideSoldItems: false,
  };
  await transactionBuilder()
    .add(
      await createCandyMachine(umi, {
        candyMachine,
        settings,
      })
    )
    .sendAndConfirm(umi);

  // Then we expect the candy machine account to have the right data.
  const candyMachineAccount = await fetchCandyMachine(
    umi,
    candyMachine.publicKey
  );
  t.like(candyMachineAccount, <CandyMachine>{
    publicKey: publicKey(candyMachine),
    authority: publicKey(umi.identity),
    mintAuthority: publicKey(umi.identity),
    version: 0,
    itemsRedeemed: 0n,
    finalizedItemsCount: 0n,
    settings,
    state: GumballState.None,
    itemsLoaded: 0,
    items: [] as CandyMachineItem[],
  });
});

test("it can create a candy machine that's bigger than 10Kb", async (t) => {
  // Given an existing collection NFT.
  const umi = await createUmi();

  // When we create a new candy machine with a large amount of items.
  const candyMachine = generateSigner(umi);
  const settings: GumballSettings = {
    uri: 'https://arweave.net/abc123',
    itemCapacity: 20000n,
    itemsPerSeller: 1,
    sellersMerkleRoot: none(),
    curatorFeeBps: 500,
    hideSoldItems: false,
  };
  await transactionBuilder()
    .add(
      await createCandyMachine(umi, {
        ...defaultGumballSettings(),
        candyMachine,
        settings,
      })
    )
    .sendAndConfirm(umi);

  // Then we expect the candy machine account to have been created.
  const candyMachineAccount = await fetchCandyMachine(
    umi,
    candyMachine.publicKey
  );
  t.like(candyMachineAccount, <CandyMachine>{
    publicKey: publicKey(candyMachine),
    itemsRedeemed: 0n,
    settings,
  });
});
