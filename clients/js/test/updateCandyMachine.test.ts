import {
  generateSigner,
  none,
  percentAmount,
  some,
  transactionBuilder,
} from '@metaplex-foundation/umi';
import test from 'ava';
import { CandyMachine, fetchCandyMachine, updateCandyMachine } from '../src';
import { createV2, createUmi } from './_setup';

test('it can update the data of a candy machine', async (t) => {
  // Given a Candy Machine with the following data.
  const umi = await createUmi();
  const creatorA = generateSigner(umi).publicKey;
  const candyMachine = await createV2(umi, {
    itemsAvailable: 1000,
    symbol: 'OLD',
    sellerFeeBasisPoints: percentAmount(1),
    maxEditionSupply: 1n,
    isMutable: true,
    creators: [{ address: creatorA, percentageShare: 100, verified: false }],
    configLineSettings: some({
      prefixName: 'My Old NFT #',
      nameLength: 4,
      prefixUri: 'https://arweave.net/',
      uriLength: 50,
      isSequential: true,
    }),
  });

  // When we update its data.
  const creatorB = generateSigner(umi).publicKey;
  await transactionBuilder()
    .add(
      updateCandyMachine(umi, {
        candyMachine: candyMachine.publicKey,
        data: {
          itemsAvailable: 1000, // Cannot be updated.
          symbol: 'NEW',
          sellerFeeBasisPoints: percentAmount(2),
          maxEditionSupply: 2,
          isMutable: false,
          creators: [
            { address: creatorB, percentageShare: 100, verified: false },
          ],
          configLineSettings: some({
            prefixName: 'My New NFT #$ID+1$',
            nameLength: 0,
            prefixUri: 'https://my.app.com/nfts/$ID+1$',
            uriLength: 0,
            isSequential: false,
          }),
          hiddenSettings: none(),
        },
      })
    )
    .sendAndConfirm(umi);

  // Then the Candy Machine's data was updated accordingly.
  const candyMachineAccount = await fetchCandyMachine(
    umi,
    candyMachine.publicKey
  );
  t.like(candyMachineAccount, <CandyMachine>{
    data: {
      itemsAvailable: 1000n,
      symbol: 'NEW',
      sellerFeeBasisPoints: percentAmount(2),
      maxEditionSupply: 2n,
      isMutable: false,
      creators: [{ address: creatorB, percentageShare: 100, verified: false }],
      configLineSettings: some({
        prefixName: 'My New NFT #$ID+1$',
        nameLength: 0,
        prefixUri: 'https://my.app.com/nfts/$ID+1$',
        uriLength: 0,
        isSequential: false,
      }),
      hiddenSettings: none(),
    },
  });
});

test('it cannot update the number of items when using config line settings', async (t) => {
  // Given a Candy Machine using config line settings with 1000 items.
  const umi = await createUmi();
  const candyMachine = await createV2(umi, {
    itemsAvailable: 1000,
    configLineSettings: some({
      prefixName: 'My NFT #',
      nameLength: 4,
      prefixUri: 'https://arweave.net/',
      uriLength: 50,
      isSequential: true,
    }),
  });
  const { data: originalData } = await fetchCandyMachine(
    umi,
    candyMachine.publicKey
  );

  // When we try to update the number of items to 2000.
  const promise = transactionBuilder()
    .add(
      updateCandyMachine(umi, {
        candyMachine: candyMachine.publicKey,
        data: { ...originalData, itemsAvailable: 2000 },
      })
    )
    .sendAndConfirm(umi);

  // Then we expect a program error.
  await t.throwsAsync(promise, { message: /CannotChangeNumberOfLines/ });
});

test('it can update the number of items when using hidden settings', async (t) => {
  // Given a Candy Machine using hidden settings with 1000 items.
  const umi = await createUmi();
  const candyMachine = await createV2(umi, {
    itemsAvailable: 1000,
    configLineSettings: none(),
    hiddenSettings: some({
      name: 'My NFT #$ID+1$',
      uri: 'https://my.app.com/nfts/$ID+1$.json',
      hash: new Uint8Array(32),
    }),
  });
  const { data: originalData } = await fetchCandyMachine(
    umi,
    candyMachine.publicKey
  );

  // When we update the number of items to 2000.
  await transactionBuilder()
    .add(
      updateCandyMachine(umi, {
        candyMachine: candyMachine.publicKey,
        data: { ...originalData, itemsAvailable: 2000 },
      })
    )
    .sendAndConfirm(umi);

  // Then the Candy Machine's data was updated accordingly.
  const candyMachineAccount = await fetchCandyMachine(
    umi,
    candyMachine.publicKey
  );
  t.like(candyMachineAccount, <CandyMachine>{
    data: { itemsAvailable: 2000n },
  });
});

test('it can update the hidden settings of a candy machine', async (t) => {
  // Given a Candy Machine using the following hidden settings.
  const umi = await createUmi();
  const candyMachine = await createV2(umi, {
    itemsAvailable: 1000,
    configLineSettings: none(),
    hiddenSettings: some({
      name: 'My Old NFT #$ID+1$',
      uri: 'https://old.app.com/nfts/$ID+1$.json',
      hash: new Uint8Array(Array(32).fill(1)),
    }),
  });
  const { data: originalData } = await fetchCandyMachine(
    umi,
    candyMachine.publicKey
  );

  // When we update its hidden settings to the following.
  await transactionBuilder()
    .add(
      updateCandyMachine(umi, {
        candyMachine: candyMachine.publicKey,
        data: {
          ...originalData,
          hiddenSettings: some({
            name: 'My NFT NFT #$ID+1$',
            uri: 'https://nft.app.com/nfts/$ID+1$.json',
            hash: new Uint8Array(Array(32).fill(2)),
          }),
        },
      })
    )
    .sendAndConfirm(umi);

  // Then the Candy Machine's data was updated accordingly.
  const candyMachineAccount = await fetchCandyMachine(
    umi,
    candyMachine.publicKey
  );
  t.like(candyMachineAccount, <CandyMachine>{
    data: {
      hiddenSettings: some({
        name: 'My NFT NFT #$ID+1$',
        uri: 'https://nft.app.com/nfts/$ID+1$.json',
        hash: new Uint8Array(Array(32).fill(2)),
      }),
    },
  });
});

test('it cannot go from hidden settings to config line settings', async (t) => {
  // Given a Candy Machine using the following hidden settings.
  const umi = await createUmi();
  const candyMachine = await createV2(umi, {
    itemsAvailable: 1000,
    configLineSettings: none(),
    hiddenSettings: some({
      name: 'My NFT #$ID+1$',
      uri: 'https://my.app.com/nfts/$ID+1$.json',
      hash: new Uint8Array(32),
    }),
  });
  const { data: originalData } = await fetchCandyMachine(
    umi,
    candyMachine.publicKey
  );

  // When we try to update it so it uses config line settings instead.
  const promise = transactionBuilder()
    .add(
      updateCandyMachine(umi, {
        candyMachine: candyMachine.publicKey,
        data: {
          ...originalData,
          hiddenSettings: none(),
          configLineSettings: some({
            prefixName: 'My NFT #',
            nameLength: 4,
            prefixUri: 'https://arweave.net/',
            uriLength: 50,
            isSequential: true,
          }),
        },
      })
    )
    .sendAndConfirm(umi);

  // Then we expect a program error.
  await t.throwsAsync(promise, { message: /CannotSwitchFromHiddenSettings/ });
});

test('it cannot go from config line settings to hidden settings', async (t) => {
  // Given a Candy Machine using the following config line settings.
  const umi = await createUmi();
  const candyMachine = await createV2(umi, {
    itemsAvailable: 1000,
    hiddenSettings: none(),
    configLineSettings: some({
      prefixName: 'My NFT #',
      nameLength: 4,
      prefixUri: 'https://arweave.net/',
      uriLength: 50,
      isSequential: true,
    }),
  });
  const { data: originalData } = await fetchCandyMachine(
    umi,
    candyMachine.publicKey
  );

  // When we try to update it so it uses hidden settings instead.
  const promise = transactionBuilder()
    .add(
      updateCandyMachine(umi, {
        candyMachine: candyMachine.publicKey,
        data: {
          ...originalData,
          configLineSettings: none(),
          hiddenSettings: some({
            name: 'My NFT #$ID+1$',
            uri: 'https://my.app.com/nfts/$ID+1$.json',
            hash: new Uint8Array(32),
          }),
        },
      })
    )
    .sendAndConfirm(umi);

  // Then we expect a program error.
  await t.throwsAsync(promise, { message: /CannotSwitchToHiddenSettings/ });
});
