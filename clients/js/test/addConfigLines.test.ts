import { publicKey, transactionBuilder } from '@metaplex-foundation/umi';
import { Keypair, PublicKey } from '@solana/web3.js';
import test from 'ava';
import {
  addConfigLines,
  CandyMachine,
  fetchCandyMachine,
  TokenStandard,
} from '../src';
import { createV2, createUmi } from './_setup';

test('it can add items to a candy machine', async (t) => {
  // Given a Candy Machine with 5 items.
  const umi = await createUmi();
  const candyMachine = await createV2(umi, { itemCount: 5 });

  const configLines = [
    {
      mint: publicKey(Keypair.generate().publicKey),
      contributor: publicKey(Keypair.generate().publicKey),
      buyer: publicKey(PublicKey.default),
      tokenStandard: TokenStandard.NonFungible,
    },
    {
      mint: publicKey(Keypair.generate().publicKey),
      contributor: publicKey(Keypair.generate().publicKey),
      buyer: publicKey(PublicKey.default),
      tokenStandard: TokenStandard.NonFungible,
    },
  ];

  // When we add two items to the Candy Machine.
  await transactionBuilder()
    .add(
      addConfigLines(umi, {
        candyMachine: candyMachine.publicKey,
        index: 0,
        configLines,
      })
    )
    .sendAndConfirm(umi);

  // Then the Candy Machine has been updated properly.
  const candyMachineAccount = await fetchCandyMachine(
    umi,
    candyMachine.publicKey
  );

  t.like(candyMachineAccount, <Pick<CandyMachine, 'itemsLoaded' | 'items'>>{
    itemsLoaded: 2,
    items: [
      {
        index: 0,
        minted: false,
        mint: configLines[0].mint,
        contributor: configLines[0].contributor,
        buyer: undefined,
        tokenStandard: TokenStandard.NonFungible,
      },
      {
        index: 1,
        minted: false,
        mint: configLines[1].mint,
        contributor: configLines[1].contributor,
        buyer: undefined,
        tokenStandard: TokenStandard.NonFungible,
      },
    ],
  });
});

test('it can append additional items to a candy machine', async (t) => {
  // Given a Candy Machine with 5 items.
  const umi = await createUmi();
  const candyMachine = await createV2(umi, { itemCount: 2 });

  const configLines = [
    {
      mint: publicKey(Keypair.generate().publicKey),
      contributor: publicKey(Keypair.generate().publicKey),
      buyer: publicKey(PublicKey.default),
      tokenStandard: TokenStandard.NonFungible,
    },
    {
      mint: publicKey(Keypair.generate().publicKey),
      contributor: publicKey(Keypair.generate().publicKey),
      buyer: publicKey(PublicKey.default),
      tokenStandard: TokenStandard.NonFungible,
    },
  ];

  await transactionBuilder()
    .add(
      addConfigLines(umi, {
        candyMachine: candyMachine.publicKey,
        index: 0,
        configLines: [configLines[0]],
      })
    )
    .sendAndConfirm(umi);

  // When we add an additional item to the Candy Machine.
  await transactionBuilder()
    .add(
      addConfigLines(umi, {
        candyMachine: candyMachine.publicKey,
        index: 1,
        configLines: [configLines[1]],
      })
    )
    .sendAndConfirm(umi);

  // Then the Candy Machine has been updated properly.
  const candyMachineAccount = await fetchCandyMachine(
    umi,
    candyMachine.publicKey
  );

  t.like(candyMachineAccount, <Pick<CandyMachine, 'itemsLoaded' | 'items'>>{
    itemsLoaded: 2,
    items: [
      {
        index: 0,
        minted: false,
        mint: configLines[0].mint,
        contributor: configLines[0].contributor,
        buyer: undefined,
        tokenStandard: TokenStandard.NonFungible,
      },
      {
        index: 1,
        minted: false,
        mint: configLines[1].mint,
        contributor: configLines[1].contributor,
        buyer: undefined,
        tokenStandard: TokenStandard.NonFungible,
      },
    ],
  });
});

test('it cannot add items that would make the candy machine exceed the maximum capacity', async (t) => {
  // Given an existing Candy Machine with a capacity of 1 item.
  const umi = await createUmi();
  const candyMachine = await createV2(umi, { itemCount: 1 });

  // When we try to add 3 items to the Candy Machine.
  const promise = transactionBuilder()
    .add(
      addConfigLines(umi, {
        candyMachine: candyMachine.publicKey,
        index: 0,
        configLines: [
          {
            mint: publicKey(Keypair.generate().publicKey),
            contributor: publicKey(Keypair.generate().publicKey),
            buyer: publicKey(PublicKey.default),
            tokenStandard: TokenStandard.NonFungible,
          },
          {
            mint: publicKey(Keypair.generate().publicKey),
            contributor: publicKey(Keypair.generate().publicKey),
            buyer: publicKey(PublicKey.default),
            tokenStandard: TokenStandard.NonFungible,
          },
        ],
      })
    )
    .sendAndConfirm(umi);

  // Then we expect an error to be thrown.
  await t.throwsAsync(promise, {
    message: /IndexGreaterThanLength/,
  });
});

test('it cannot add items once the candy machine is fully loaded', async (t) => {
  // Given an existing Candy Machine with 2 items loaded and a capacity of 2 items.
  const umi = await createUmi();
  const candyMachine = await createV2(umi, { itemCount: 2 });
  await transactionBuilder()
    .add(
      addConfigLines(umi, {
        candyMachine: candyMachine.publicKey,
        index: 0,
        configLines: [
          {
            mint: publicKey(Keypair.generate().publicKey),
            contributor: publicKey(Keypair.generate().publicKey),
            buyer: publicKey(PublicKey.default),
            tokenStandard: TokenStandard.NonFungible,
          },
          {
            mint: publicKey(Keypair.generate().publicKey),
            contributor: publicKey(Keypair.generate().publicKey),
            buyer: publicKey(PublicKey.default),
            tokenStandard: TokenStandard.NonFungible,
          },
        ],
      })
    )
    .sendAndConfirm(umi);

  // When we try to add one more item to the Candy Machine.
  const promise = transactionBuilder()
    .add(
      addConfigLines(umi, {
        candyMachine: candyMachine.publicKey,
        index: 2,
        configLines: [
          {
            mint: publicKey(Keypair.generate().publicKey),
            contributor: publicKey(Keypair.generate().publicKey),
            buyer: publicKey(PublicKey.default),
            tokenStandard: TokenStandard.NonFungible,
          },
        ],
      })
    )
    .sendAndConfirm(umi);

  // Then we expect an error to be thrown.
  await t.throwsAsync(promise, {
    message: /IndexGreaterThanLength/,
  });
});

test('it can add items to a custom offset and override existing items', async (t) => {
  // Given an existing Candy Machine with 2 items loaded and capacity of 3 items.
  const umi = await createUmi();
  const candyMachine = await createV2(umi, { itemCount: 3 });
  const configLines = [
    {
      mint: publicKey(Keypair.generate().publicKey),
      contributor: publicKey(Keypair.generate().publicKey),
      buyer: publicKey(PublicKey.default),
      tokenStandard: TokenStandard.NonFungible,
    },
    {
      mint: publicKey(Keypair.generate().publicKey),
      contributor: publicKey(Keypair.generate().publicKey),
      buyer: publicKey(PublicKey.default),
      tokenStandard: TokenStandard.NonFungible,
    },
  ];
  await transactionBuilder()
    .add(
      addConfigLines(umi, {
        candyMachine: candyMachine.publicKey,
        index: 0,
        configLines,
      })
    )
    .sendAndConfirm(umi);

  // When we add 2 items to the Candy Machine at index 1.
  const overrideConfigLines = [
    {
      mint: publicKey(Keypair.generate().publicKey),
      contributor: publicKey(Keypair.generate().publicKey),
      buyer: publicKey(PublicKey.default),
      tokenStandard: TokenStandard.NonFungible,
    },
    {
      mint: publicKey(Keypair.generate().publicKey),
      contributor: publicKey(Keypair.generate().publicKey),
      buyer: publicKey(PublicKey.default),
      tokenStandard: TokenStandard.NonFungible,
    },
  ];
  await transactionBuilder()
    .add(
      addConfigLines(umi, {
        candyMachine: candyMachine.publicKey,
        index: 1,
        configLines: overrideConfigLines,
      })
    )
    .sendAndConfirm(umi);

  // Then the Candy Machine has been updated properly.
  const candyMachineAccount = await fetchCandyMachine(
    umi,
    candyMachine.publicKey
  );
  t.like(candyMachineAccount, <Pick<CandyMachine, 'itemsLoaded' | 'items'>>{
    itemsLoaded: 3,
    items: [
      {
        index: 0,
        minted: false,
        mint: configLines[0].mint,
        contributor: configLines[0].contributor,
        buyer: undefined,
        tokenStandard: TokenStandard.NonFungible,
      },
      {
        index: 1,
        minted: false,
        mint: overrideConfigLines[0].mint,
        contributor: overrideConfigLines[0].contributor,
        buyer: undefined,
        tokenStandard: TokenStandard.NonFungible,
      },
      {
        index: 2,
        minted: false,
        mint: overrideConfigLines[1].mint,
        contributor: overrideConfigLines[1].contributor,
        buyer: undefined,
        tokenStandard: TokenStandard.NonFungible,
      },
    ],
  });
});

test('it can override all items of a candy machine', async (t) => {
  // Given an fully loaded Candy Machine with 2 items.
  const umi = await createUmi();
  const candyMachine = await createV2(umi, { itemCount: 2 });

  await transactionBuilder()
    .add(
      addConfigLines(umi, {
        candyMachine: candyMachine.publicKey,
        index: 0,
        configLines: [
          {
            mint: publicKey(Keypair.generate().publicKey),
            contributor: publicKey(Keypair.generate().publicKey),
            buyer: publicKey(PublicKey.default),
            tokenStandard: TokenStandard.NonFungible,
          },
          {
            mint: publicKey(Keypair.generate().publicKey),
            contributor: publicKey(Keypair.generate().publicKey),
            buyer: publicKey(PublicKey.default),
            tokenStandard: TokenStandard.NonFungible,
          },
        ],
      })
    )
    .sendAndConfirm(umi);

  // When we add 2 new items to the Candy Machine at index 0.
  const configLines = [
    {
      mint: publicKey(Keypair.generate().publicKey),
      contributor: publicKey(Keypair.generate().publicKey),
      buyer: publicKey(PublicKey.default),
      tokenStandard: TokenStandard.NonFungible,
    },
    {
      mint: publicKey(Keypair.generate().publicKey),
      contributor: publicKey(Keypair.generate().publicKey),
      buyer: publicKey(PublicKey.default),
      tokenStandard: TokenStandard.NonFungible,
    },
  ];
  await transactionBuilder()
    .add(
      addConfigLines(umi, {
        candyMachine: candyMachine.publicKey,
        index: 0,
        configLines,
      })
    )
    .sendAndConfirm(umi);

  // Then all items have been overriden.
  const candyMachineAccount = await fetchCandyMachine(
    umi,
    candyMachine.publicKey
  );
  t.like(candyMachineAccount, <Pick<CandyMachine, 'itemsLoaded' | 'items'>>{
    itemsLoaded: 2,
    items: [
      {
        index: 0,
        minted: false,
        mint: configLines[0].mint,
        contributor: configLines[0].contributor,
        buyer: undefined,
        tokenStandard: TokenStandard.NonFungible,
      },
      {
        index: 1,
        minted: false,
        mint: configLines[1].mint,
        contributor: configLines[1].contributor,
        buyer: undefined,
        tokenStandard: TokenStandard.NonFungible,
      },
    ],
  });
});

test('it will safely ignore any pre-set buyer', async (t) => {
  // Given a Candy Machine with 1 item.
  const umi = await createUmi();
  const candyMachine = await createV2(umi, { itemCount: 1 });

  const configLine = {
    mint: publicKey(Keypair.generate().publicKey),
    contributor: publicKey(Keypair.generate().publicKey),
    buyer: publicKey(Keypair.generate().publicKey),
    tokenStandard: TokenStandard.NonFungible,
  };

  // When we add one item to the Candy Machine.
  await transactionBuilder()
    .add(
      addConfigLines(umi, {
        candyMachine: candyMachine.publicKey,
        index: 0,
        configLines: [configLine],
      })
    )
    .sendAndConfirm(umi);

  // Then the Candy Machine has been updated properly.
  const candyMachineAccount = await fetchCandyMachine(
    umi,
    candyMachine.publicKey
  );

  t.like(candyMachineAccount, <Pick<CandyMachine, 'itemsLoaded' | 'items'>>{
    itemsLoaded: 1,
    items: [
      {
        index: 0,
        minted: false,
        mint: configLine.mint,
        contributor: configLine.contributor,
        buyer: undefined,
        tokenStandard: TokenStandard.NonFungible,
      },
    ],
  });
});
