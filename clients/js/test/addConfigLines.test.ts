import { some, transactionBuilder } from '@metaplex-foundation/umi';
import test from 'ava';
import { addConfigLines, CandyMachine, fetchCandyMachine } from '../src';
import { createCandyMachine, createUmi } from './_setup';

test('it can add items to a candy machine', async (t) => {
  // Given a Candy Machine with 5 items.
  const umi = await createUmi();
  const candyMachine = await createCandyMachine(umi, { itemsAvailable: 5 });

  // When we add two items to the Candy Machine.
  await transactionBuilder(umi)
    .add(
      addConfigLines(umi, {
        candyMachine: candyMachine.publicKey,
        index: 0,
        configLines: [
          { name: 'Degen #1', uri: 'https://example.com/degen/1' },
          { name: 'Degen #2', uri: 'https://example.com/degen/2' },
        ],
      })
    )
    .sendAndConfirm();

  // Then the Candy Machine has been updated properly.
  const candyMachineAccount = await fetchCandyMachine(
    umi,
    candyMachine.publicKey
  );
  t.like(candyMachineAccount, <CandyMachine>{
    itemsLoaded: 2,
    items: [
      {
        index: 0,
        minted: false,
        name: 'Degen #1',
        uri: 'https://example.com/degen/1',
      },
      {
        index: 1,
        minted: false,
        name: 'Degen #2',
        uri: 'https://example.com/degen/2',
      },
    ],
  });
});

test('it uses the names and URIs as suffixes when adding items to a candy machine', async (t) => {
  // Given an existing Candy Machine with prefixes for the names and URIs.
  const umi = await createUmi();
  const candyMachine = await createCandyMachine(umi, {
    itemsAvailable: 9, // Numbers go from 1 to 9.
    configLineSettings: some({
      type: 'configLines',
      prefixName: 'Degen #',
      nameLength: 1, // E.g. "1".
      prefixUri: 'https://example.com/degen/',
      uriLength: 6, // E.g. "1.json".
      isSequential: false,
    }),
  });

  // When we add two items to the Candy Machine by providing only the suffixes.
  await transactionBuilder(umi)
    .add(
      addConfigLines(umi, {
        candyMachine: candyMachine.publicKey,
        index: 0,
        configLines: [
          { name: '1', uri: '1.json' },
          { name: '2', uri: '2.json' },
        ],
      })
    )
    .sendAndConfirm();

  // Then the updated Candy Machine returns the full item names and URIs.
  const candyMachineAccount = await fetchCandyMachine(
    umi,
    candyMachine.publicKey
  );
  t.like(candyMachineAccount, <CandyMachine>{
    itemsLoaded: 2,
    items: [
      {
        index: 0,
        minted: false,
        name: 'Degen #1',
        uri: 'https://example.com/degen/1.json',
      },
      {
        index: 1,
        minted: false,
        name: 'Degen #2',
        uri: 'https://example.com/degen/2.json',
      },
    ],
  });
});
