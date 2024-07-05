import {
  generateSigner,
  publicKey,
  transactionBuilder,
} from '@metaplex-foundation/umi';
import test from 'ava';
import { CandyMachine, createCandyMachineV2, fetchCandyMachine } from '../src';
import { createUmi, defaultCandyMachineData } from './_setup';

test('it can create a candy machine using config line settings', async (t) => {
  // Given an existing collection NFT.
  const umi = await createUmi();

  // When we create a new candy machine with config line settings.
  const candyMachine = generateSigner(umi);
  await transactionBuilder()
    .add(
      await createCandyMachineV2(umi, {
        candyMachine,
        itemCount: 100,
      })
    )
    .sendAndConfirm(umi);

  // Then we expect the candy machine account to have the right data.
  const candyMachineAccount = await fetchCandyMachine(
    umi,
    candyMachine.publicKey
  );
  t.like(candyMachineAccount, <
    Omit<CandyMachine, 'discriminator' | 'features' | 'header'>
  >{
    publicKey: publicKey(candyMachine),
    authority: publicKey(umi.identity),
    mintAuthority: publicKey(umi.identity),
    version: 0,
    itemsRedeemed: 0n,
    itemsAvailable: 100n,
    itemsLoaded: 0,
    items: [],
  });
});

test("it can create a candy machine that's bigger than 10Kb", async (t) => {
  // Given an existing collection NFT.
  const umi = await createUmi();

  // When we create a new candy machine with a large amount of items.
  const candyMachine = generateSigner(umi);
  await transactionBuilder()
    .add(
      await createCandyMachineV2(umi, {
        ...defaultCandyMachineData(umi),
        candyMachine,
        itemCount: 20000,
      })
    )
    .sendAndConfirm(umi);

  // Then we expect the candy machine account to have been created.
  const candyMachineAccount = await fetchCandyMachine(
    umi,
    candyMachine.publicKey
  );
  t.like(candyMachineAccount, <
    Pick<CandyMachine, 'publicKey' | 'itemsRedeemed' | 'itemsAvailable'>
  >{
    publicKey: publicKey(candyMachine),
    itemsRedeemed: 0n,
    itemsAvailable: 20000n,
  });
});
