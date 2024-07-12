import {
  generateSigner,
  none,
  transactionBuilder,
} from '@metaplex-foundation/umi';
import test from 'ava';
import {
  fetchToken,
  findAssociatedTokenPda,
  TokenState,
} from '@metaplex-foundation/mpl-toolbox';
import {
  addNft,
  CandyMachine,
  fetchCandyMachine,
  removeNft,
  TokenStandard,
} from '../src';
import { createV2, createUmi, createNft } from './_setup';

test('it can remove nfts from a candy machine', async (t) => {
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

  // Then remove the nft
  await transactionBuilder()
    .add(
      removeNft(umi, {
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
});

test('it can remove nfts at a lower index than last from a candy machine', async (t) => {
  // Given a Candy Machine with 5 nfts.
  const umi = await createUmi();
  const candyMachine = await createV2(umi, { settings: { itemCapacity: 5 } });
  const nfts = await Promise.all([createNft(umi), createNft(umi)]);

  // When we add two nfts to the Candy Machine.
  await transactionBuilder()
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

  // Then remove the nft
  await transactionBuilder()
    .add(
      removeNft(umi, {
        candyMachine: candyMachine.publicKey,
        index: 0,
        mint: nfts[0].publicKey,
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

test('it can remove additional nfts from a candy machine', async (t) => {
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
    .add(
      addNft(umi, {
        candyMachine: candyMachine.publicKey,
        mint: nfts[1].publicKey,
      })
    )
    .sendAndConfirm(umi);

  // When we remove an additional item from the Candy Machine.
  await transactionBuilder()
    .add(
      removeNft(umi, {
        candyMachine: candyMachine.publicKey,
        mint: nfts[0].publicKey,
        index: 0,
      })
    )
    .sendAndConfirm(umi);

  // When we remove an additional item from the Candy Machine.
  await transactionBuilder()
    .add(
      removeNft(umi, {
        candyMachine: candyMachine.publicKey,
        mint: nfts[1].publicKey,
        index: 0,
      })
    )
    .sendAndConfirm(umi);

  // Then the Candy Machine has been updated properly.
  const candyMachineAccount = await fetchCandyMachine(
    umi,
    candyMachine.publicKey
  );

  t.like(candyMachineAccount, <Pick<CandyMachine, 'itemsLoaded' | 'items'>>{
    itemsLoaded: 0,
    items: [],
  });
});

test('it cannot remove nfts when the machine is empty', async (t) => {
  // Given an existing Candy Machine with a capacity of 1 item.
  const umi = await createUmi();
  const candyMachine = await createV2(umi, { settings: { itemCapacity: 1 } });
  const nft = await createNft(umi);

  // When we try to remove an nft from the Candy Machine.
  const promise = transactionBuilder()
    .add(
      removeNft(umi, {
        candyMachine: candyMachine.publicKey,
        mint: nft.publicKey,
        index: 0,
      })
    )
    .sendAndConfirm(umi);

  // Then we expect an error to be thrown.
  await t.throwsAsync(promise, {
    message: /IndexGreaterThanLength/,
  });
});

test('it cannot remove nfts as a different seller', async (t) => {
  // Given a Candy Machine with 5 nfts.
  const umi = await createUmi();
  const candyMachine = await createV2(umi, { settings: { itemCapacity: 1 } });
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

  // Then remove the nft
  const promise = transactionBuilder()
    .add(
      removeNft(umi, {
        authority: generateSigner(umi),
        candyMachine: candyMachine.publicKey,
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
  // Given a Candy Machine with one nft.
  const umi = await createUmi();
  const otherSellerUmi = await createUmi();
  const candyMachine = await createV2(umi, { settings: { itemCapacity: 1 } });
  const nft = await createNft(otherSellerUmi);

  // When we add an nft to the Candy Machine.
  await transactionBuilder()
    .add(
      addNft(otherSellerUmi, {
        candyMachine: candyMachine.publicKey,
        mint: nft.publicKey,
      })
    )
    .sendAndConfirm(otherSellerUmi);

  // Then remove the nft as the candy machine authority
  await transactionBuilder()
    .add(
      removeNft(umi, {
        candyMachine: candyMachine.publicKey,
        index: 0,
        mint: nft.publicKey,
        tokenAccount: findAssociatedTokenPda(umi, {
          mint: nft.publicKey,
          owner: otherSellerUmi.identity.publicKey,
        })[0],
      })
    )
    .sendAndConfirm(umi);

  // Then the Candy Machine has been updated properly.
  const candyMachineAccount = await fetchCandyMachine(
    umi,
    candyMachine.publicKey
  );

  t.like(candyMachineAccount, <Pick<CandyMachine, 'itemsLoaded' | 'items'>>{
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
  // Given a Candy Machine with one nft.
  const umi = await createUmi();
  const otherSellerUmi = await createUmi();
  const candyMachine = await createV2(umi, { settings: { itemCapacity: 1 } });
  const nft = await createNft(otherSellerUmi);

  // When we add an nft to the Candy Machine.
  await transactionBuilder()
    .add(
      addNft(otherSellerUmi, {
        candyMachine: candyMachine.publicKey,
        mint: nft.publicKey,
      })
    )
    .sendAndConfirm(otherSellerUmi);

  // Then remove the nft as the candy machine authority
  await transactionBuilder()
    .add(
      removeNft(otherSellerUmi, {
        candyMachine: candyMachine.publicKey,
        index: 0,
        mint: nft.publicKey,
      })
    )
    .sendAndConfirm(otherSellerUmi);

  // Then the Candy Machine has been updated properly.
  const candyMachineAccount = await fetchCandyMachine(
    umi,
    candyMachine.publicKey
  );

  t.like(candyMachineAccount, <Pick<CandyMachine, 'itemsLoaded' | 'items'>>{
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
