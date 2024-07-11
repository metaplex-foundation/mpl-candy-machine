import { transactionBuilder } from '@metaplex-foundation/umi';
import test from 'ava';
import {
  findMetadataPda,
  updatePrimarySaleHappenedViaToken,
} from '@metaplex-foundation/mpl-token-metadata';
import { findAssociatedTokenPda } from '@metaplex-foundation/mpl-toolbox';
import { addNft, CandyMachine, fetchCandyMachine, TokenStandard } from '../src';
import { createV2, createUmi, createNft } from './_setup';

test('it can add nfts to a candy machine', async (t) => {
  // Given a Candy Machine with 5 nfts.
  const umi = await createUmi();
  const candyMachine = await createV2(umi, { itemCount: 5 });
  const nft = await createNft(umi);

  // When we add an nft to the Candy Machine.
  await transactionBuilder()
    .add(
      addNft(umi, {
        candyMachine: candyMachine.publicKey,
        index: 0,
        mint: nft.publicKey,
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
        mint: nft.publicKey,
        seller: umi.identity.publicKey,
        buyer: undefined,
        tokenStandard: TokenStandard.NonFungible,
      },
    ],
  });
});

test('it can append additional nfts to a candy machine', async (t) => {
  // Given a Candy Machine with 5 nfts.
  const umi = await createUmi();
  const candyMachine = await createV2(umi, { itemCount: 2 });
  const nfts = await Promise.all([createNft(umi), createNft(umi)]);

  await transactionBuilder()
    .add(
      addNft(umi, {
        candyMachine: candyMachine.publicKey,
        index: 0,
        mint: nfts[0].publicKey,
      })
    )
    .sendAndConfirm(umi);

  // When we add an additional item to the Candy Machine.
  await transactionBuilder()
    .add(
      addNft(umi, {
        candyMachine: candyMachine.publicKey,
        index: 1,
        mint: nfts[1].publicKey,
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
        mint: nfts[0].publicKey,
        seller: umi.identity.publicKey,
        buyer: undefined,
        tokenStandard: TokenStandard.NonFungible,
      },
      {
        index: 1,
        minted: false,
        mint: nfts[1].publicKey,
        seller: umi.identity.publicKey,
        buyer: undefined,
        tokenStandard: TokenStandard.NonFungible,
      },
    ],
  });
});

test('it cannot add nfts that would make the candy machine exceed the maximum capacity', async (t) => {
  // Given an existing Candy Machine with a capacity of 1 item.
  const umi = await createUmi();
  const candyMachine = await createV2(umi, { itemCount: 1 });
  const nfts = await Promise.all([createNft(umi), createNft(umi)]);

  // When we try to add 2 nfts to the Candy Machine.
  const promise = transactionBuilder()
    .add(
      addNft(umi, {
        candyMachine: candyMachine.publicKey,
        index: 0,
        mint: nfts[0].publicKey,
      })
    )
    .add(
      addNft(umi, {
        candyMachine: candyMachine.publicKey,
        index: 1,
        mint: nfts[1].publicKey,
      })
    )
    .sendAndConfirm(umi);

  // Then we expect an error to be thrown.
  await t.throwsAsync(promise, {
    message: /IndexGreaterThanLength/,
  });
});

test('it cannot add nfts once the candy machine is fully loaded', async (t) => {
  // Given an existing Candy Machine with 2 nfts loaded and a capacity of 2 nfts.
  const umi = await createUmi();
  const candyMachine = await createV2(umi, { itemCount: 1 });
  const nft = await createNft(umi);

  await transactionBuilder()
    .add(
      addNft(umi, {
        candyMachine: candyMachine.publicKey,
        index: 0,
        mint: nft.publicKey,
      })
    )
    .sendAndConfirm(umi);

  // When we try to add one more item to the Candy Machine.
  const promise = transactionBuilder()
    .add(
      addNft(umi, {
        candyMachine: candyMachine.publicKey,
        index: 2,
        mint: (await createNft(umi)).publicKey,
      })
    )
    .sendAndConfirm(umi);

  // Then we expect an error to be thrown.
  await t.throwsAsync(promise, {
    message: /IndexGreaterThanLength/,
  });
});

test('it can add nfts to a custom offset and override existing nfts', async (t) => {
  // Given an existing Candy Machine with 2 nfts loaded and capacity of 3 nfts.
  const umi = await createUmi();
  const candyMachine = await createV2(umi, { itemCount: 3 });
  const nfts = await Promise.all([createNft(umi), createNft(umi)]);

  await transactionBuilder()
    .add(
      addNft(umi, {
        candyMachine: candyMachine.publicKey,
        index: 0,
        mint: nfts[0].publicKey,
      })
    )
    .add(
      addNft(umi, {
        candyMachine: candyMachine.publicKey,
        index: 1,
        mint: nfts[1].publicKey,
      })
    )
    .sendAndConfirm(umi);

  // When we add 2 nfts to the Candy Machine at index 1.
  const newNft = await createNft(umi);
  await transactionBuilder()
    .add(
      addNft(umi, {
        candyMachine: candyMachine.publicKey,
        index: 1,
        mint: newNft.publicKey,
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
        mint: nfts[0].publicKey,
        seller: umi.identity.publicKey,
        buyer: undefined,
        tokenStandard: TokenStandard.NonFungible,
      },
      {
        index: 1,
        minted: false,
        mint: newNft.publicKey,
        seller: umi.identity.publicKey,
        buyer: undefined,
        tokenStandard: TokenStandard.NonFungible,
      },
    ],
  });
});

test('it can override all nfts of a candy machine', async (t) => {
  // Given an fully loaded Candy Machine with 2 nfts.
  const umi = await createUmi();
  const candyMachine = await createV2(umi, { itemCount: 2 });
  const oldNfts = await Promise.all([createNft(umi), createNft(umi)]);

  await transactionBuilder()
    .add(
      addNft(umi, {
        candyMachine: candyMachine.publicKey,
        index: 0,
        mint: oldNfts[0].publicKey,
      })
    )
    .add(
      addNft(umi, {
        candyMachine: candyMachine.publicKey,
        index: 1,
        mint: oldNfts[1].publicKey,
      })
    )
    .sendAndConfirm(umi);

  // When we add 2 new nfts to the Candy Machine at index 0.
  const nfts = await Promise.all([createNft(umi), createNft(umi)]);
  await transactionBuilder()
    .add(
      addNft(umi, {
        candyMachine: candyMachine.publicKey,
        index: 0,
        mint: nfts[0].publicKey,
      })
    )
    .add(
      addNft(umi, {
        candyMachine: candyMachine.publicKey,
        index: 1,
        mint: nfts[1].publicKey,
      })
    )
    .sendAndConfirm(umi);

  // Then all nfts have been overriden.
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
        mint: nfts[0].publicKey,
        seller: umi.identity.publicKey,
        buyer: undefined,
        tokenStandard: TokenStandard.NonFungible,
      },
      {
        index: 1,
        minted: false,
        mint: nfts[1].publicKey,
        seller: umi.identity.publicKey,
        buyer: undefined,
        tokenStandard: TokenStandard.NonFungible,
      },
    ],
  });
});

test('it cannot add nfts that are on the secondary market', async (t) => {
  // Given a Candy Machine with 5 nfts.
  const umi = await createUmi();
  const candyMachine = await createV2(umi, { itemCount: 1 });
  const nfts = await Promise.all([createNft(umi)]);

  await updatePrimarySaleHappenedViaToken(umi, {
    metadata: findMetadataPda(umi, { mint: nfts[0].publicKey })[0],
    owner: umi.identity,
    token: findAssociatedTokenPda(umi, {
      owner: umi.identity.publicKey,
      mint: nfts[0].publicKey,
    })[0],
  }).sendAndConfirm(umi);

  // When we add two nfts to the Candy Machine.
  const promise = transactionBuilder()
    .add(
      addNft(umi, {
        candyMachine: candyMachine.publicKey,
        index: 0,
        mint: nfts[0].publicKey,
      })
    )
    .sendAndConfirm(umi);

  // Then an error is thrown.
  // Then we expect a program error.
  await t.throwsAsync(promise, { message: /NotPrimarySale/ });
});
