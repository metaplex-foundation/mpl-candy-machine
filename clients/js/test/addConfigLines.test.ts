import { none, some, transactionBuilder } from '@metaplex-foundation/umi';
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

test('it cannot add items to a candy machine with hidden settings', async (t) => {
  // Given a Candy Machine with hidden settings.
  const umi = await createUmi();
  const candyMachine = await createCandyMachine(umi, {
    itemsAvailable: 10,
    configLineSettings: none(),
    hiddenSettings: some({
      name: 'Degen #$ID+1$',
      uri: 'https://example.com/degen/$ID+1$.json',
      hash: new Uint8Array(32),
    }),
  });

  // When we try to add items to the Candy Machine.
  const promise = transactionBuilder(umi)
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

  // Then we expect an error from the program.
  await t.throwsAsync(promise, {
    message: /HiddenSettingsDoNotHaveConfigLines/,
  });
});

test('it cannot add items that would make the candy machine exceed the maximum capacity', async (t) => {
  // Given an existing Candy Machine with a capacity of 2 items.
  const umi = await createUmi();
  const candyMachine = await createCandyMachine(umi, { itemsAvailable: 2 });

  // When we try to add 3 items to the Candy Machine.
  const promise = transactionBuilder(umi)
    .add(
      addConfigLines(umi, {
        candyMachine: candyMachine.publicKey,
        index: 0,
        configLines: [
          { name: 'Degen #1', uri: 'https://example.com/degen/1' },
          { name: 'Degen #2', uri: 'https://example.com/degen/2' },
          { name: 'Degen #3', uri: 'https://example.com/degen/3' },
        ],
      })
    )
    .sendAndConfirm();

  // Then we expect an error to be thrown.
  await t.throwsAsync(promise, {
    message: /IndexGreaterThanLength/,
  });
});

test('it cannot add items once the candy machine is fully loaded', async (t) => {
  // Given an existing Candy Machine with 2 items loaded and a capacity of 2 items.
  const umi = await createUmi();
  const candyMachine = await createCandyMachine(umi, { itemsAvailable: 2 });
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

  // When we try to add one more item to the Candy Machine.
  const promise = transactionBuilder(umi)
    .add(
      addConfigLines(umi, {
        candyMachine: candyMachine.publicKey,
        index: 2,
        configLines: [{ name: 'Degen #3', uri: 'https://example.com/degen/3' }],
      })
    )
    .sendAndConfirm();

  // Then we expect an error to be thrown.
  await t.throwsAsync(promise, {
    message: /IndexGreaterThanLength/,
  });
});

test('it cannot add items if either of them have a name or URI that is too long', async (t) => {
  // Given a Candy Machine with a name limit of 10 characters and a URI limit of 50 characters.
  const umi = await createUmi();
  const candyMachine = await createCandyMachine(umi, {
    itemsAvailable: 2,
    configLineSettings: some({
      prefixName: '',
      nameLength: 10,
      prefixUri: '',
      uriLength: 50,
      isSequential: false,
    }),
  });

  // When we try to add items such that one of the names is too long.
  const promiseName = transactionBuilder(umi)
    .add(
      addConfigLines(umi, {
        candyMachine: candyMachine.publicKey,
        index: 0,
        configLines: [
          { name: 'Degen #1', uri: 'https://example.com/degen/1' },
          { name: 'x'.repeat(11), uri: 'https://example.com/degen/2' },
        ],
      })
    )
    .sendAndConfirm();

  // Then we expect an error to be thrown.
  await t.throwsAsync(promiseName, {
    message: /ExceededLengthError/,
  });

  // And when we try to add items such that one of the URIs is too long.
  const promiseUri = transactionBuilder(umi)
    .add(
      addConfigLines(umi, {
        candyMachine: candyMachine.publicKey,
        index: 0,
        configLines: [
          { name: 'Degen #1', uri: 'https://example.com/degen/1' },
          { name: 'Degen #2', uri: 'x'.repeat(51) },
        ],
      })
    )
    .sendAndConfirm();

  // Then we expect an error to be thrown.
  await t.throwsAsync(promiseUri, {
    message: /ExceededLengthError/,
  });
});
