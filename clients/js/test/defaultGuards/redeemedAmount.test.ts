import { setComputeUnitLimit } from '@metaplex-foundation/mpl-toolbox';
import {
  generateSigner,
  sol,
  some,
  transactionBuilder,
} from '@metaplex-foundation/umi';
import test from 'ava';
import { mintV2 } from '../../src';
import {
  assertBotTax,
  assertSuccessfulMint,
  createCollectionNft,
  createUmi,
  createV2,
} from '../_setup';

test('it allows minting until a threshold of NFTs have been redeemed', async (t) => {
  // Given a loaded Candy Machine with a redeemedAmount guard with a threshold of 1 NFT.
  const umi = await createUmi();
  const collectionMint = (await createCollectionNft(umi)).publicKey;
  const { publicKey: candyMachine } = await createV2(umi, {
    collectionMint,
    configLines: [
      { name: 'Degen #1', uri: 'https://example.com/degen/1' },
      { name: 'Degen #1', uri: 'https://example.com/degen/1' },
    ],
    guards: {
      redeemedAmount: some({ maximum: 1 }),
    },
  });

  // When we mint its first item.
  const mint = generateSigner(umi);
  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      mintV2(umi, {
        candyMachine,
        nftMint: mint,
        collectionMint,
        collectionUpdateAuthority: umi.identity.publicKey,
      })
    )
    .sendAndConfirm(umi);

  // Then minting was successful.
  await assertSuccessfulMint(t, umi, { mint, owner: umi.identity });
});

test('it forbids minting once the redeemed threshold has been reached', async (t) => {
  // Given a loaded Candy Machine with a redeemedAmount guard with a threshold of 1 NFT.
  const umi = await createUmi();
  const collectionMint = (await createCollectionNft(umi)).publicKey;
  const { publicKey: candyMachine } = await createV2(umi, {
    collectionMint,
    configLines: [
      { name: 'Degen #1', uri: 'https://example.com/degen/1' },
      { name: 'Degen #1', uri: 'https://example.com/degen/1' },
    ],
    guards: {
      redeemedAmount: some({ maximum: 1 }),
    },
  });

  // And assuming its first item has already been minted.
  const mintA = generateSigner(umi);
  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      mintV2(umi, {
        candyMachine,
        nftMint: mintA,
        collectionMint,
        collectionUpdateAuthority: umi.identity.publicKey,
      })
    )
    .sendAndConfirm(umi);
  await assertSuccessfulMint(t, umi, { mint: mintA, owner: umi.identity });

  // When we try to mint its second item.
  const mintB = generateSigner(umi);
  const promise = transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      mintV2(umi, {
        candyMachine,
        nftMint: mintB,
        collectionMint,
        collectionUpdateAuthority: umi.identity.publicKey,
      })
    )
    .sendAndConfirm(umi);

  // Then we expect a program error.
  await t.throwsAsync(promise, { message: /MaximumRedeemedAmount/ });
});

test('it charges a bot tax when trying to mint once the threshold has been reached', async (t) => {
  // Given a loaded Candy Machine with a bot tax guard
  // and a redeemedAmount guard with a threshold of 1 NFT.
  const umi = await createUmi();
  const collectionMint = (await createCollectionNft(umi)).publicKey;
  const { publicKey: candyMachine } = await createV2(umi, {
    collectionMint,
    configLines: [
      { name: 'Degen #1', uri: 'https://example.com/degen/1' },
      { name: 'Degen #1', uri: 'https://example.com/degen/1' },
    ],
    guards: {
      botTax: some({ lamports: sol(0.1), lastInstruction: true }),
      redeemedAmount: some({ maximum: 1 }),
    },
  });

  // And assuming its first item has already been minted.
  const mintA = generateSigner(umi);
  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      mintV2(umi, {
        candyMachine,
        nftMint: mintA,
        collectionMint,
        collectionUpdateAuthority: umi.identity.publicKey,
      })
    )
    .sendAndConfirm(umi);
  await assertSuccessfulMint(t, umi, { mint: mintA, owner: umi.identity });

  // When we try to mint its second item.
  const mintB = generateSigner(umi);
  const { signature } = await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      mintV2(umi, {
        candyMachine,
        nftMint: mintB,
        collectionMint,
        collectionUpdateAuthority: umi.identity.publicKey,
      })
    )
    .sendAndConfirm(umi);

  // Then we expect a silent bot tax error.
  await assertBotTax(t, umi, mintB, signature, /MaximumRedeemedAmount/);
});
