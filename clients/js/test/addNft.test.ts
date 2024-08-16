import {
  fetchToken,
  findAssociatedTokenPda,
  TokenState,
} from '@metaplex-foundation/mpl-toolbox';
import {
  generateSigner,
  some,
  transactionBuilder,
} from '@metaplex-foundation/umi';
import test from 'ava';
import {
  addNft,
  fetchGumballMachine,
  fetchSellerHistory,
  findGumballMachineAuthorityPda,
  findSellerHistoryPda,
  getMerkleProof,
  getMerkleRoot,
  GumballMachine,
  SellerHistory,
  TokenStandard,
} from '../src';
import { create, createNft, createUmi } from './_setup';

test('it can add nft to a gumball machine as the authority', async (t) => {
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
      findGumballMachineAuthorityPda(umi, {
        gumballMachine: gumballMachine.publicKey,
      })[0]
    ),
  });

  // Seller history state is correct
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
});

test('it can add nft to a gumball machine as allowlisted seller', async (t) => {
  // Given a Gumball Machine with 5 nfts.
  const umi = await createUmi();
  const otherSellerUmi = await createUmi();
  const sellersMerkleRoot = getMerkleRoot([otherSellerUmi.identity.publicKey]);
  const gumballMachine = await create(umi, {
    settings: { itemCapacity: 5, sellersMerkleRoot },
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
      findGumballMachineAuthorityPda(umi, {
        gumballMachine: gumballMachine.publicKey,
      })[0]
    ),
  });
});

test('it can add nft to a gumball machine as allowlisted seller on allowlist of 10K addresses', async (t) => {
  // Given a Gumball Machine with 5 nfts.
  const umi = await createUmi();
  const otherSellerUmi = await createUmi();
  const addresses = Array.from(
    { length: 10_000 },
    (_, i) => generateSigner(umi).publicKey
  );
  addresses.push(otherSellerUmi.identity.publicKey);
  const sellersMerkleRoot = getMerkleRoot(addresses);
  const gumballMachine = await create(umi, {
    settings: { itemCapacity: 5, sellersMerkleRoot },
  });
  const nft = await createNft(otherSellerUmi);

  // When we add an nft to the Gumball Machine.
  await transactionBuilder()
    .add(
      addNft(otherSellerUmi, {
        gumballMachine: gumballMachine.publicKey,
        mint: nft.publicKey,
        sellerProofPath: getMerkleProof(
          addresses,
          otherSellerUmi.identity.publicKey
        ),
      })
    )
    .sendAndConfirm(otherSellerUmi);

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
      findGumballMachineAuthorityPda(umi, {
        gumballMachine: gumballMachine.publicKey,
      })[0]
    ),
  });
});

test('it cannot add nft as non gumball authority when there is no seller allowlist set', async (t) => {
  // Given a Gumball Machine with 5 nfts.
  const umi = await createUmi();
  const otherSellerUmi = await createUmi();
  const gumballMachine = await create(umi, { settings: { itemCapacity: 5 } });
  const nft = await createNft(otherSellerUmi);

  // When we add an nft to the Gumball Machine.
  const promise = transactionBuilder()
    .add(
      addNft(otherSellerUmi, {
        gumballMachine: gumballMachine.publicKey,
        mint: nft.publicKey,
      })
    )
    .sendAndConfirm(otherSellerUmi);

  await t.throwsAsync(promise, { message: /InvalidProofPath/ });
});

test('it cannot add nft as non-allowlisted seller when there is a seller allowlist set', async (t) => {
  // Given a Gumball Machine with 5 nfts.
  const umi = await createUmi();
  const otherSellerUmi = await createUmi();
  const gumballMachine = await create(umi, {
    settings: {
      itemCapacity: 5,
      sellersMerkleRoot: getMerkleRoot([umi.identity.publicKey]),
    },
  });
  const nft = await createNft(otherSellerUmi);

  // When we add an nft to the Gumball Machine.
  const promise = transactionBuilder()
    .add(
      addNft(otherSellerUmi, {
        gumballMachine: gumballMachine.publicKey,
        mint: nft.publicKey,
      })
    )
    .sendAndConfirm(otherSellerUmi);

  await t.throwsAsync(promise, { message: /InvalidProofPath/ });
});

test('it can append additional nfts to a gumball machine', async (t) => {
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
    .sendAndConfirm(umi);

  // When we add an additional item to the Gumball Machine.
  await transactionBuilder()
    .add(
      addNft(umi, {
        gumballMachine: gumballMachine.publicKey,
        mint: nfts[1].publicKey,
      })
    )
    .sendAndConfirm(umi);

  // Then the Gumball Machine has been updated properly.
  const gumballMachineAccount = await fetchGumballMachine(
    umi,
    gumballMachine.publicKey
  );

  t.like(gumballMachineAccount, <Pick<GumballMachine, 'itemsLoaded' | 'items'>>{
    itemsLoaded: 2,
    items: [
      {
        index: 0,
        isDrawn: false,
        isClaimed: false,
        mint: nfts[0].publicKey,
        seller: umi.identity.publicKey,
        buyer: undefined,
        tokenStandard: TokenStandard.NonFungible,
      },
      {
        index: 1,
        isDrawn: false,
        isClaimed: false,
        mint: nfts[1].publicKey,
        seller: umi.identity.publicKey,
        buyer: undefined,
        tokenStandard: TokenStandard.NonFungible,
      },
    ],
  });
});

test('it cannot add nfts that would make the gumball machine exceed the maximum capacity', async (t) => {
  // Given an existing Gumball Machine with a capacity of 1 item.
  const umi = await createUmi();
  const gumballMachine = await create(umi, { settings: { itemCapacity: 1 } });
  const nfts = await Promise.all([createNft(umi), createNft(umi)]);

  // When we try to add 2 nfts to the Gumball Machine.
  const promise = transactionBuilder()
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

  // Then we expect an error to be thrown.
  await t.throwsAsync(promise, {
    message: /IndexGreaterThanLength/,
  });
});

test('it cannot add nfts once the gumball machine is fully loaded', async (t) => {
  // Given an existing Gumball Machine with 2 nfts loaded and a capacity of 2 nfts.
  const umi = await createUmi();
  const gumballMachine = await create(umi, { settings: { itemCapacity: 1 } });
  const nft = await createNft(umi);

  await transactionBuilder()
    .add(
      addNft(umi, {
        gumballMachine: gumballMachine.publicKey,
        mint: nft.publicKey,
      })
    )
    .sendAndConfirm(umi);

  // When we try to add one more item to the Gumball Machine.
  const promise = transactionBuilder()
    .add(
      addNft(umi, {
        gumballMachine: gumballMachine.publicKey,
        mint: (await createNft(umi)).publicKey,
      })
    )
    .sendAndConfirm(umi);

  // Then we expect an error to be thrown.
  await t.throwsAsync(promise, {
    message: /IndexGreaterThanLength/,
  });
});

test('it cannot add more nfts than allowed per seller', async (t) => {
  // Given a Gumball Machine with 5 nfts.
  const umi = await createUmi();
  const otherSellerUmi = await createUmi();
  const sellersMerkleRoot = getMerkleRoot([otherSellerUmi.identity.publicKey]);
  const gumballMachine = await create(umi, {
    settings: { itemCapacity: 2, itemsPerSeller: 1, sellersMerkleRoot },
  });
  const nfts = await Promise.all([
    createNft(otherSellerUmi),
    createNft(otherSellerUmi),
  ]);

  // When we add an nft to the Gumball Machine.
  await transactionBuilder()
    .add(
      addNft(otherSellerUmi, {
        gumballMachine: gumballMachine.publicKey,
        mint: nfts[0].publicKey,
        sellerProofPath: getMerkleProof(
          [otherSellerUmi.identity.publicKey],
          otherSellerUmi.identity.publicKey
        ),
      })
    )
    .sendAndConfirm(otherSellerUmi);

  const promise = transactionBuilder()
    .add(
      addNft(otherSellerUmi, {
        gumballMachine: gumballMachine.publicKey,
        mint: nfts[1].publicKey,
        sellerProofPath: getMerkleProof(
          [otherSellerUmi.identity.publicKey],
          otherSellerUmi.identity.publicKey
        ),
      })
    )
    .sendAndConfirm(otherSellerUmi);

  await t.throwsAsync(promise, { message: /SellerTooManyItems/ });
});
