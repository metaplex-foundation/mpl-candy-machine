import {
  fetchToken,
  findAssociatedTokenPda,
  TokenState,
} from '@metaplex-foundation/mpl-toolbox';
import {
  generateSigner,
  none,
  transactionBuilder,
} from '@metaplex-foundation/umi';
import test from 'ava';
import {
  addNft,
  fetchGumballMachine,
  fetchSellerHistory,
  findSellerHistoryPda,
  getMerkleProof,
  getMerkleRoot,
  GumballMachine,
  removeNft,
  safeFetchSellerHistory,
  SellerHistory,
  TokenStandard,
} from '../src';
import { create, createNft, createUmi } from './_setup';

test('it can remove nfts from a gumball machine', async (t) => {
  // Given a Gumball Machine with 5 nfts.
  const umi = await createUmi();
  const gumballMachine = await create(umi, { settings: { itemCapacity: 5 } });
  const nft = await createNft(umi);

  // When we add an nft to the Gumball Machine.
  await transactionBuilder()
    .add(
      addNft(umi, {
        gumballMachine: gumballMachine.publicKey,
        mint: nft.publicKey,
      })
    )
    .sendAndConfirm(umi);

  // Then remove the nft
  await transactionBuilder()
    .add(
      removeNft(umi, {
        gumballMachine: gumballMachine.publicKey,
        index: 0,
        mint: nft.publicKey,
      })
    )
    .sendAndConfirm(umi);

  // Then the Gumball Machine has been updated properly.
  const gumballMachineAccount = await fetchGumballMachine(
    umi,
    gumballMachine.publicKey
  );

  t.like(gumballMachineAccount, <Pick<GumballMachine, 'itemsLoaded' | 'items'>>{
    itemsLoaded: 0,
    items: [],
  });

  // Then nft is unfrozen and revoked
  const tokenAccount = await fetchToken(
    umi,
    findAssociatedTokenPda(umi, {
      mint: nft.publicKey,
      owner: umi.identity.publicKey,
    })[0]
  );
  t.like(tokenAccount, {
    state: TokenState.Initialized,
    owner: umi.identity.publicKey,
    delegate: none(),
  });

  // Seller history should no longer exist
  const sellerHistoryAccount = await safeFetchSellerHistory(
    umi,
    findSellerHistoryPda(umi, {
      gumballMachine: gumballMachine.publicKey,
      seller: umi.identity.publicKey,
    })[0]
  );

  t.falsy(sellerHistoryAccount);
});

test('it can remove nfts at a lower index than last from a gumball machine', async (t) => {
  // Given a Gumball Machine with 5 nfts.
  const umi = await createUmi();
  const gumballMachine = await create(umi, { settings: { itemCapacity: 5 } });
  const nfts = await Promise.all([createNft(umi), createNft(umi)]);

  // When we add two nfts to the Gumball Machine.
  await transactionBuilder()
    .add(
      addNft(umi, {
        gumballMachine: gumballMachine.publicKey,
        mint: nfts[0].publicKey,
      })
    )
    .add(
      addNft(umi, {
        gumballMachine: gumballMachine.publicKey,
        mint: nfts[1].publicKey,
      })
    )
    .sendAndConfirm(umi);

  // Then remove the nft
  await transactionBuilder()
    .add(
      removeNft(umi, {
        gumballMachine: gumballMachine.publicKey,
        index: 0,
        mint: nfts[0].publicKey,
      })
    )
    .sendAndConfirm(umi);

  // Then the Gumball Machine has been updated properly.
  const gumballMachineAccount = await fetchGumballMachine(
    umi,
    gumballMachine.publicKey
  );

  t.like(gumballMachineAccount, <Pick<GumballMachine, 'itemsLoaded' | 'items'>>{
    itemsLoaded: 1,
    items: [
      {
        index: 0,
        isDrawn: false,
        isClaimed: false,
        mint: nfts[1].publicKey,
        seller: umi.identity.publicKey,
        buyer: undefined,
        tokenStandard: TokenStandard.NonFungible,
      },
    ],
  });

  // Then nft is unfrozen and revoked
  const tokenAccount = await fetchToken(
    umi,
    findAssociatedTokenPda(umi, {
      mint: nfts[0].publicKey,
      owner: umi.identity.publicKey,
    })[0]
  );
  t.like(tokenAccount, {
    state: TokenState.Initialized,
    owner: umi.identity.publicKey,
    delegate: none(),
  });
});

test('it can remove additional nfts from a gumball machine', async (t) => {
  // Given a Gumball Machine with 5 nfts.
  const umi = await createUmi();
  const gumballMachine = await create(umi, { settings: { itemCapacity: 2 } });
  const nfts = await Promise.all([createNft(umi), createNft(umi)]);

  await transactionBuilder()
    .add(
      addNft(umi, {
        gumballMachine: gumballMachine.publicKey,
        mint: nfts[0].publicKey,
      })
    )
    .add(
      addNft(umi, {
        gumballMachine: gumballMachine.publicKey,
        mint: nfts[1].publicKey,
      })
    )
    .sendAndConfirm(umi);

  // When we remove an additional item from the Gumball Machine.
  await transactionBuilder()
    .add(
      removeNft(umi, {
        gumballMachine: gumballMachine.publicKey,
        mint: nfts[0].publicKey,
        index: 0,
      })
    )
    .sendAndConfirm(umi);

  // Seller history should no longer exist
  const sellerHistoryAccount = await fetchSellerHistory(
    umi,
    findSellerHistoryPda(umi, {
      gumballMachine: gumballMachine.publicKey,
      seller: umi.identity.publicKey,
    })[0]
  );

  t.like(sellerHistoryAccount, <SellerHistory>{
    gumballMachine: gumballMachine.publicKey,
    seller: umi.identity.publicKey,
    itemCount: 1n,
  });

  // When we remove an additional item from the Gumball Machine.
  await transactionBuilder()
    .add(
      removeNft(umi, {
        gumballMachine: gumballMachine.publicKey,
        mint: nfts[1].publicKey,
        index: 0,
      })
    )
    .sendAndConfirm(umi);

  // Then the Gumball Machine has been updated properly.
  const gumballMachineAccount = await fetchGumballMachine(
    umi,
    gumballMachine.publicKey
  );

  t.like(gumballMachineAccount, <Pick<GumballMachine, 'itemsLoaded' | 'items'>>{
    itemsLoaded: 0,
    items: [],
  });
});

test('it cannot remove nfts when the machine is empty', async (t) => {
  // Given an existing Gumball Machine with a capacity of 1 item.
  const umi = await createUmi();
  const gumballMachine = await create(umi, { settings: { itemCapacity: 1 } });
  const nft = await createNft(umi);

  // When we try to remove an nft from the Gumball Machine.
  const promise = transactionBuilder()
    .add(
      removeNft(umi, {
        gumballMachine: gumballMachine.publicKey,
        mint: nft.publicKey,
        index: 0,
      })
    )
    .sendAndConfirm(umi);

  // Then we expect an error to be thrown.
  await t.throwsAsync(promise, {
    message: /AccountNotInitialized/,
  });
});

test('it cannot remove nfts as a different seller', async (t) => {
  // Given a Gumball Machine with 5 nfts.
  const umi = await createUmi();
  const gumballMachine = await create(umi, { settings: { itemCapacity: 1 } });
  const nft = await createNft(umi);

  // When we add an nft to the Gumball Machine.
  await transactionBuilder()
    .add(
      addNft(umi, {
        gumballMachine: gumballMachine.publicKey,
        mint: nft.publicKey,
      })
    )
    .sendAndConfirm(umi);

  // Then remove the nft
  const promise = transactionBuilder()
    .add(
      removeNft(umi, {
        authority: generateSigner(umi),
        gumballMachine: gumballMachine.publicKey,
        index: 0,
        mint: nft.publicKey,
      })
    )
    .sendAndConfirm(umi);

  // Then an error is thrown.
  // Then we expect a program error.
  await t.throwsAsync(promise, { message: /InvalidAuthority/ });
});

test('it can remove another seller nft as the gumball authority', async (t) => {
  // Given a Gumball Machine with one nft.
  const umi = await createUmi();
  const otherSellerUmi = await createUmi();
  const sellersMerkleRoot = getMerkleRoot([otherSellerUmi.identity.publicKey]);
  const gumballMachine = await create(umi, {
    settings: { itemCapacity: 1, sellersMerkleRoot },
  });
  const nft = await createNft(otherSellerUmi);

  // When we add an nft to the Gumball Machine.
  await transactionBuilder()
    .add(
      addNft(otherSellerUmi, {
        gumballMachine: gumballMachine.publicKey,
        mint: nft.publicKey,
        sellerProofPath: getMerkleProof(
          [otherSellerUmi.identity.publicKey],
          otherSellerUmi.identity.publicKey
        ),
      })
    )
    .sendAndConfirm(otherSellerUmi);

  // Then remove the nft as the gumball machine authority
  await transactionBuilder()
    .add(
      removeNft(umi, {
        gumballMachine: gumballMachine.publicKey,
        index: 0,
        mint: nft.publicKey,
        seller: otherSellerUmi.identity.publicKey,
        tokenAccount: findAssociatedTokenPda(umi, {
          mint: nft.publicKey,
          owner: otherSellerUmi.identity.publicKey,
        })[0],
      })
    )
    .sendAndConfirm(umi);

  // Then the Gumball Machine has been updated properly.
  const gumballMachineAccount = await fetchGumballMachine(
    umi,
    gumballMachine.publicKey
  );

  t.like(gumballMachineAccount, <Pick<GumballMachine, 'itemsLoaded' | 'items'>>{
    itemsLoaded: 0,
    items: [],
  });

  // Then nft is unfrozen and revoked
  const tokenAccount = await fetchToken(
    umi,
    findAssociatedTokenPda(umi, {
      mint: nft.publicKey,
      owner: otherSellerUmi.identity.publicKey,
    })[0]
  );
  t.like(tokenAccount, {
    state: TokenState.Initialized,
    owner: otherSellerUmi.identity.publicKey,
    delegate: none(),
  });
});

test('it can remove own nft as non gumball authority', async (t) => {
  // Given a Gumball Machine with one nft.
  const umi = await createUmi();
  const otherSellerUmi = await createUmi();
  const sellersMerkleRoot = getMerkleRoot([otherSellerUmi.identity.publicKey]);
  const gumballMachine = await create(umi, {
    settings: { itemCapacity: 1, sellersMerkleRoot },
  });
  const nft = await createNft(otherSellerUmi);

  // When we add an nft to the Gumball Machine.
  await transactionBuilder()
    .add(
      addNft(otherSellerUmi, {
        gumballMachine: gumballMachine.publicKey,
        mint: nft.publicKey,
        sellerProofPath: getMerkleProof(
          [otherSellerUmi.identity.publicKey],
          otherSellerUmi.identity.publicKey
        ),
      })
    )
    .sendAndConfirm(otherSellerUmi);

  // Then remove the nft as the gumball machine authority
  await transactionBuilder()
    .add(
      removeNft(otherSellerUmi, {
        gumballMachine: gumballMachine.publicKey,
        index: 0,
        mint: nft.publicKey,
      })
    )
    .sendAndConfirm(otherSellerUmi);

  // Then the Gumball Machine has been updated properly.
  const gumballMachineAccount = await fetchGumballMachine(
    umi,
    gumballMachine.publicKey
  );

  t.like(gumballMachineAccount, <Pick<GumballMachine, 'itemsLoaded' | 'items'>>{
    itemsLoaded: 0,
    items: [],
  });

  // Then nft is unfrozen and revoked
  const tokenAccount = await fetchToken(
    umi,
    findAssociatedTokenPda(umi, {
      mint: nft.publicKey,
      owner: otherSellerUmi.identity.publicKey,
    })[0]
  );
  t.like(tokenAccount, {
    state: TokenState.Initialized,
    owner: otherSellerUmi.identity.publicKey,
    delegate: none(),
  });
});
