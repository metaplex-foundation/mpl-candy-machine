import { setComputeUnitLimit } from '@metaplex-foundation/mpl-toolbox';
import {
  generateSigner,
  sol,
  some,
  transactionBuilder,
} from '@metaplex-foundation/umi';
import test from 'ava';
import { TokenStandard } from '@metaplex-foundation/mpl-token-metadata';
import { mintV2 } from '../../src';
import {
  assertBotTax,
  assertBurnedNft,
  assertSuccessfulMint,
  createCollectionNft,
  createNft,
  createUmi,
  createV2,
  createVerifiedNft,
  createVerifiedProgrammableNft,
} from '../_setup';

test('it burns a specific NFT to allow minting', async (t) => {
  // Given the identity owns an NFT from a certain collection.
  const umi = await createUmi();
  const requiredCollectionAuthority = generateSigner(umi);
  const { publicKey: requiredCollection } = await createCollectionNft(umi, {
    authority: requiredCollectionAuthority,
  });
  const nftToBurn = await createVerifiedNft(umi, {
    tokenOwner: umi.identity.publicKey,
    collectionMint: requiredCollection,
    collectionAuthority: requiredCollectionAuthority,
  });

  // And a loaded Candy Machine with an nftBurn guard on that collection.
  const collectionMint = (await createCollectionNft(umi)).publicKey;
  const { publicKey: candyMachine } = await createV2(umi, {
    collectionMint,
    configLines: [{ name: 'Degen #1', uri: 'https://example.com/degen/1' }],
    guards: {
      nftBurn: some({ requiredCollection }),
    },
  });

  // When the identity mints from it using its NFT to burn.
  const mint = generateSigner(umi);
  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      mintV2(umi, {
        candyMachine,
        nftMint: mint,
        collectionMint,
        collectionUpdateAuthority: umi.identity.publicKey,
        mintArgs: {
          nftBurn: some({
            tokenStandard: TokenStandard.NonFungible,
            requiredCollection,
            mint: nftToBurn.publicKey,
          }),
        },
      })
    )
    .sendAndConfirm(umi);

  // Then minting was successful.
  await assertSuccessfulMint(t, umi, { mint, owner: umi.identity });

  // And the NFT was burned.
  await assertBurnedNft(t, umi, nftToBurn, umi.identity);
});

test('it allows minting even when the payer is different from the minter', async (t) => {
  // Given a separate minter owns an NFT from a certain collection.
  const umi = await createUmi();
  const minter = generateSigner(umi);
  const requiredCollectionAuthority = generateSigner(umi);
  const { publicKey: requiredCollection } = await createCollectionNft(umi, {
    authority: requiredCollectionAuthority,
  });
  const nftToBurn = await createVerifiedNft(umi, {
    tokenOwner: minter.publicKey,
    collectionMint: requiredCollection,
    collectionAuthority: requiredCollectionAuthority,
  });

  // And a loaded Candy Machine with an nftBurn guard on that collection.
  const collectionMint = (await createCollectionNft(umi)).publicKey;
  const { publicKey: candyMachine } = await createV2(umi, {
    collectionMint,
    configLines: [{ name: 'Degen #1', uri: 'https://example.com/degen/1' }],
    guards: {
      nftBurn: some({ requiredCollection }),
    },
  });

  // When the minter mints from it using its NFT to burn.
  const mint = generateSigner(umi);
  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      mintV2(umi, {
        candyMachine,
        nftMint: mint,
        minter,
        collectionMint,
        collectionUpdateAuthority: umi.identity.publicKey,
        mintArgs: {
          nftBurn: some({
            tokenStandard: TokenStandard.NonFungible,
            requiredCollection,
            mint: nftToBurn.publicKey,
          }),
        },
      })
    )
    .sendAndConfirm(umi);

  // Then minting was successful.
  await assertSuccessfulMint(t, umi, { mint, owner: minter });

  // And the NFT was burned.
  await assertBurnedNft(t, umi, nftToBurn, minter);
});

test('it fails if there is not valid NFT to burn', async (t) => {
  // Given a loaded Candy Machine with an nftBurn guard on a specific collection.
  const umi = await createUmi();
  const requiredCollection = (await createCollectionNft(umi)).publicKey;
  const collectionMint = (await createCollectionNft(umi)).publicKey;
  const { publicKey: candyMachine } = await createV2(umi, {
    collectionMint,
    configLines: [{ name: 'Degen #1', uri: 'https://example.com/degen/1' }],
    guards: {
      nftBurn: some({ requiredCollection }),
    },
  });

  // When we try to mint from it using an NFT that's not part of this collection.
  const nftToBurn = await createNft(umi);
  const mint = generateSigner(umi);
  const promise = transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      mintV2(umi, {
        candyMachine,
        nftMint: mint,
        collectionMint,
        collectionUpdateAuthority: umi.identity.publicKey,
        mintArgs: {
          nftBurn: some({
            tokenStandard: TokenStandard.NonFungible,
            requiredCollection,
            mint: nftToBurn.publicKey,
          }),
        },
      })
    )
    .sendAndConfirm(umi);

  // Then we expect an error.
  await t.throwsAsync(promise, { message: /InvalidNftCollection/ });
});

test('it charges a bot tax when trying to mint using the wrong NFT', async (t) => {
  // Given a loaded Candy Machine with a botTax guard and
  // an nftBurn guard on a specific collection.
  const umi = await createUmi();
  const requiredCollection = (await createCollectionNft(umi)).publicKey;
  const collectionMint = (await createCollectionNft(umi)).publicKey;
  const { publicKey: candyMachine } = await createV2(umi, {
    collectionMint,
    configLines: [{ name: 'Degen #1', uri: 'https://example.com/degen/1' }],
    guards: {
      botTax: some({ lamports: sol(0.01), lastInstruction: true }),
      nftBurn: some({ requiredCollection }),
    },
  });

  // When we try to mint from it using an NFT that's not part of this collection.
  const nftToBurn = await createNft(umi);
  const mint = generateSigner(umi);
  const { signature } = await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      mintV2(umi, {
        candyMachine,
        nftMint: mint,
        collectionMint,
        collectionUpdateAuthority: umi.identity.publicKey,
        mintArgs: {
          nftBurn: some({
            tokenStandard: TokenStandard.NonFungible,
            requiredCollection,
            mint: nftToBurn.publicKey,
          }),
        },
      })
    )
    .sendAndConfirm(umi);

  // Then we expect a bot tax error.
  await assertBotTax(t, umi, mint, signature, /InvalidNftCollection/);
});

test('it burns a specific Programmable NFT to allow minting', async (t) => {
  // Given the identity owns an NFT from a certain collection.
  const umi = await createUmi();
  const requiredCollectionAuthority = generateSigner(umi);
  const { publicKey: requiredCollection } = await createCollectionNft(umi, {
    authority: requiredCollectionAuthority,
  });
  const pnftToBurn = await createVerifiedProgrammableNft(umi, {
    tokenOwner: umi.identity.publicKey,
    collectionMint: requiredCollection,
    collectionAuthority: requiredCollectionAuthority,
  });

  // And a loaded Candy Machine with an nftBurn guard on that collection.
  const collectionMint = (await createCollectionNft(umi)).publicKey;
  const { publicKey: candyMachine } = await createV2(umi, {
    collectionMint,
    configLines: [{ name: 'Degen #1', uri: 'https://example.com/degen/1' }],
    guards: {
      nftBurn: some({ requiredCollection }),
    },
  });

  // When the identity mints from it using its pNFT to burn.
  const mint = generateSigner(umi);
  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      mintV2(umi, {
        candyMachine,
        nftMint: mint,
        collectionMint,
        collectionUpdateAuthority: umi.identity.publicKey,
        mintArgs: {
          nftBurn: some({
            tokenStandard: TokenStandard.ProgrammableNonFungible,
            requiredCollection,
            mint: pnftToBurn.publicKey,
          }),
        },
      })
    )
    .sendAndConfirm(umi);

  // Then minting was successful.
  await assertSuccessfulMint(t, umi, { mint, owner: umi.identity });

  // And the NFT was burned.
  await assertBurnedNft(t, umi, pnftToBurn, umi.identity);
});
