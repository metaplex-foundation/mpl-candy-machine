import { some, transactionBuilder } from '@metaplex-foundation/umi';
import test from 'ava';
import {
  findMetadataPda,
  updatePrimarySaleHappenedViaToken,
} from '@metaplex-foundation/mpl-token-metadata';
import {
  fetchToken,
  findAssociatedTokenPda,
  TokenState,
} from '@metaplex-foundation/mpl-toolbox';
import {
  addNft,
  CandyMachine,
  fetchCandyMachine,
  findCandyMachineAuthorityPda,
  getMerkleProof,
  getMerkleRoot,
  TokenStandard,
} from '../src';
import { createV2, createUmi, createNft } from './_setup';

test('it can add nft to a candy machine as the authority', async (t) => {
  // Given a Candy Machine with 5 nfts.
  const umi = await createUmi();
  const candyMachine = await createV2(umi, { settings: { itemCapacity: 5 } });
  const nft = await createNft(umi);

  // When we add an nft to the Candy Machine.
  await transactionBuilder()
    .add(
      addNft(umi, {
        candyMachine: candyMachine.publicKey,
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

  // Then nft is frozen and delegated
  const tokenAccount = await fetchToken(
    umi,
    findAssociatedTokenPda(umi, {
      mint: nft.publicKey,
      owner: umi.identity.publicKey,
    })[0]
  );
  t.like(tokenAccount, {
    state: TokenState.Frozen,
    owner: umi.identity.publicKey,
    delegate: some(
      findCandyMachineAuthorityPda(umi, {
        candyMachine: candyMachine.publicKey,
      })[0]
    ),
  });
});

test('it can add nft to a gumball machine as allowlisted seller', async (t) => {
  // Given a Candy Machine with 5 nfts.
  const umi = await createUmi();
  const otherSellerUmi = await createUmi();
  const sellersMerkleRoot = getMerkleRoot([otherSellerUmi.identity.publicKey]);
  const candyMachine = await createV2(umi, {
    settings: { itemCapacity: 5, sellersMerkleRoot },
  });
  const nft = await createNft(otherSellerUmi);

  // When we add an nft to the Candy Machine.
  await transactionBuilder()
    .add(
      addNft(otherSellerUmi, {
        candyMachine: candyMachine.publicKey,
        mint: nft.publicKey,
        sellerProofPath: getMerkleProof(
          [otherSellerUmi.identity.publicKey],
          otherSellerUmi.identity.publicKey
        ),
      })
    )
    .sendAndConfirm(otherSellerUmi);

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
        seller: otherSellerUmi.identity.publicKey,
        buyer: undefined,
        tokenStandard: TokenStandard.NonFungible,
      },
    ],
  });

  // Then nft is frozen and delegated
  const tokenAccount = await fetchToken(
    umi,
    findAssociatedTokenPda(umi, {
      mint: nft.publicKey,
      owner: otherSellerUmi.identity.publicKey,
    })[0]
  );
  t.like(tokenAccount, {
    state: TokenState.Frozen,
    owner: otherSellerUmi.identity.publicKey,
    delegate: some(
      findCandyMachineAuthorityPda(umi, {
        candyMachine: candyMachine.publicKey,
      })[0]
    ),
  });
});

test('it cannot add nft as non gumball authority when there is no seller allowlist set', async (t) => {
  // Given a Candy Machine with 5 nfts.
  const umi = await createUmi();
  const otherSellerUmi = await createUmi();
  const candyMachine = await createV2(umi, { settings: { itemCapacity: 5 } });
  const nft = await createNft(otherSellerUmi);

  // When we add an nft to the Candy Machine.
  const promise = transactionBuilder()
    .add(
      addNft(otherSellerUmi, {
        candyMachine: candyMachine.publicKey,
        mint: nft.publicKey,
      })
    )
    .sendAndConfirm(otherSellerUmi);

  await t.throwsAsync(promise, { message: /InvalidProofPath/ });
});

test('it cannot add nft as non-allowlisted seller when there is a seller allowlist set', async (t) => {
  // Given a Candy Machine with 5 nfts.
  const umi = await createUmi();
  const otherSellerUmi = await createUmi();
  const candyMachine = await createV2(umi, {
    settings: {
      itemCapacity: 5,
      sellersMerkleRoot: getMerkleRoot([umi.identity.publicKey]),
    },
  });
  const nft = await createNft(otherSellerUmi);

  // When we add an nft to the Candy Machine.
  const promise = transactionBuilder()
    .add(
      addNft(otherSellerUmi, {
        candyMachine: candyMachine.publicKey,
        mint: nft.publicKey,
      })
    )
    .sendAndConfirm(otherSellerUmi);

  await t.throwsAsync(promise, { message: /InvalidProofPath/ });
});

test('it can append additional nfts to a candy machine', async (t) => {
  // Given a Candy Machine with 5 nfts.
  const umi = await createUmi();
  const candyMachine = await createV2(umi, { settings: { itemCapacity: 2 } });
  const nfts = await Promise.all([createNft(umi), createNft(umi)]);

  await transactionBuilder()
    .add(
      addNft(umi, {
        candyMachine: candyMachine.publicKey,
        mint: nfts[0].publicKey,
      })
    )
    .sendAndConfirm(umi);

  // When we add an additional item to the Candy Machine.
  await transactionBuilder()
    .add(
      addNft(umi, {
        candyMachine: candyMachine.publicKey,
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
  const candyMachine = await createV2(umi, { settings: { itemCapacity: 1 } });
  const nfts = await Promise.all([createNft(umi), createNft(umi)]);

  // When we try to add 2 nfts to the Candy Machine.
  const promise = transactionBuilder()
    .add(
      addNft(umi, {
        candyMachine: candyMachine.publicKey,
        mint: nfts[0].publicKey,
      })
    )
    .add(
      addNft(umi, {
        candyMachine: candyMachine.publicKey,
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
  const candyMachine = await createV2(umi, { settings: { itemCapacity: 1 } });
  const nft = await createNft(umi);

  await transactionBuilder()
    .add(
      addNft(umi, {
        candyMachine: candyMachine.publicKey,
        mint: nft.publicKey,
      })
    )
    .sendAndConfirm(umi);

  // When we try to add one more item to the Candy Machine.
  const promise = transactionBuilder()
    .add(
      addNft(umi, {
        candyMachine: candyMachine.publicKey,
        mint: (await createNft(umi)).publicKey,
      })
    )
    .sendAndConfirm(umi);

  // Then we expect an error to be thrown.
  await t.throwsAsync(promise, {
    message: /IndexGreaterThanLength/,
  });
});

test('it cannot add nfts that are on the secondary market', async (t) => {
  // Given a Candy Machine with 5 nfts.
  const umi = await createUmi();
  const candyMachine = await createV2(umi, { settings: { itemCapacity: 1 } });
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
        mint: nfts[0].publicKey,
      })
    )
    .sendAndConfirm(umi);

  // Then an error is thrown.
  // Then we expect a program error.
  await t.throwsAsync(promise, { message: /NotPrimarySale/ });
});
