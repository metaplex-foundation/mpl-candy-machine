import {
  findAssociatedTokenPda,
  setComputeUnitLimit,
} from '@metaplex-foundation/mpl-essentials';
import {
  findMasterEditionPda,
  findMetadataPda,
} from '@metaplex-foundation/mpl-token-metadata';
import {
  generateSigner,
  some,
  transactionBuilder,
} from '@metaplex-foundation/umi';
import test from 'ava';
import { mintV2 } from '../../src';
import {
  assertSuccessfulMint,
  createCollectionNft,
  createNft,
  createUmi,
  createV2,
} from '../_setup';

test('it burns a specific NFT to allow minting', async (t) => {
  // Given a payer that owns an NFT from a certain collection.
  const umi = await createUmi();
  const requiredCollectionAuthority = generateSigner(umi);
  const { publicKey: requiredCollection } = await createCollectionNft(umi, {
    authority: requiredCollectionAuthority,
  });
  const nftToBurn = await createNft(umi, {
    tokenOwner: umi.identity.publicKey,
    collection: some({ verified: false, key: requiredCollection }),
  });

  // And a loaded Candy Machine with an nftBurn guard.
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
  await transactionBuilder(umi)
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      mintV2(umi, {
        candyMachine,
        nftMint: mint,
        collectionMint,
        collectionUpdateAuthority: umi.identity.publicKey,
        mintArgs: {
          nftBurn: some({ requiredCollection, mint: nftToBurn.publicKey }),
        },
      })
    )
    .sendAndConfirm();

  // Then minting was successful.
  await assertSuccessfulMint(t, umi, { mint, owner: umi.identity });

  // And the NFT was burned.
  // TODO: await assertBurnedNft(t, umi, { mint, owner })
  const nftToBurnToken = findAssociatedTokenPda(umi, {
    mint: nftToBurn.publicKey,
    owner: umi.identity.publicKey,
  });
  const nftToBurnMetadata = findMetadataPda(umi, { mint: nftToBurn.publicKey });
  const nftToBurnEdition = findMasterEditionPda(umi, {
    mint: nftToBurn.publicKey,
  });
  t.false(
    await umi.rpc.accountExists(nftToBurnToken),
    'payer NFT token account was burned'
  );
  t.false(
    await umi.rpc.accountExists(nftToBurnMetadata),
    'payer NFT metadata was burned'
  );
  t.false(
    await umi.rpc.accountExists(nftToBurnEdition),
    'payer NFT master edition was burned'
  );
});

// TODO: it allows minting even when the payer is different from the minter

// test('it fails if there is not valid NFT to burn', async (t) => {
//   // Given a loaded Candy Machine with an nftBurn guard on a specific collection.
//   const umi = await createUmi();
//   const nftBurnCollection = await createCollectionNft(umi);
//   const collectionMint = (await createCollectionNft(umi)).publicKey;
//   const { publicKey: candyMachine } = await createV2(umi, {
//     collectionMint,

//     configLines: [{ name: 'Degen #1', uri: 'https://example.com/degen/1' }],
//     guards: {
//       nftBurn: {
//         requiredCollection: nftBurnCollection.address,
//       },
//     },
//   });

//   // When we try to mint from it using an NFT that's not part of this collection.
//   const payer = await generateSignerWithSol(umi, sol(10));
//   const payerNft = await createNft(umi, { tokenOwner: payer.publicKey });
//   const mint = generateSigner(umi);
//   const promise = transactionBuilder(umi).add().sendAndConfirm();
//   mintV2(
//     umi,
//     {
//       candyMachine,
//       collectionUpdateAuthority: collection.updateAuthority.publicKey,
//       guards: {
//         nftBurn: {
//           mint: payerNft.address,
//         },
//       },
//     },
//     { payer }
//   );

//   // Then we expect an error.
//   await t.throwsAsync(promise, { message: /Invalid NFT collection/ });
// });

// test('it charges a bot tax when trying to mint using the wrong NFT', async (t) => {
//   // Given a loaded Candy Machine with an nftBurn guard and a bot tax guard.
//   const umi = await createUmi();
//   const nftBurnCollection = await createCollectionNft(umi);
//   const collectionMint = (await createCollectionNft(umi)).publicKey;
//   const { publicKey: candyMachine } = await createV2(umi, {
//     collectionMint,

//     configLines: [{ name: 'Degen #1', uri: 'https://example.com/degen/1' }],
//     guards: {
//       botTax: {
//         lamports: sol(0.1),
//         lastInstruction: true,
//       },
//       nftBurn: {
//         requiredCollection: nftBurnCollection.address,
//       },
//     },
//   });

//   // When we try to mint from it using an NFT that's not part of this collection.
//   const payer = await generateSignerWithSol(umi, sol(10));
//   const payerNft = await createNft(umi, { tokenOwner: payer.publicKey });
//   const mint = generateSigner(umi);
//   const promise = transactionBuilder(umi).add().sendAndConfirm();
//   mintV2(
//     umi,
//     {
//       candyMachine,
//       collectionUpdateAuthority: collection.updateAuthority.publicKey,
//       guards: {
//         nftBurn: {
//           mint: payerNft.address,
//         },
//       },
//     },
//     { payer }
//   );

//   // Then we expect a bot tax error.
//   await t.throwsAsync(promise, { message: /CandyMachineBotTaxError/ });

//   // And the payer was charged a bot tax.
//   const payerBalance = await umi.rpc.getBalance(payer.publicKey);
//   t.true(
//     isEqualToAmount(payerBalance, sol(9.9), sol(0.01)),
//     'payer was charged a bot tax'
//   );
// });

// test('it fails if no mint settings are provided', async (t) => {
//   // Given a payer that owns an NFT from a certain collection.
//   const umi = await createUmi();
//   const payer = await generateSignerWithSol(umi, sol(10));
//   const nftBurnCollectionAuthority = generateSigner(umi);
//   const nftBurnCollection = await createCollectionNft(umi, {
//     updateAuthority: nftBurnCollectionAuthority,
//   });
//   await createNft(umi, {
//     tokenOwner: payer.publicKey,
//     collection: nftBurnCollection.address,
//     collectionAuthority: nftBurnCollectionAuthority,
//   });

//   // And a loaded Candy Machine with an nftBurn guard.
//   const collectionMint = (await createCollectionNft(umi)).publicKey;
//   const { publicKey: candyMachine } = await createV2(umi, {
//     collectionMint,

//     configLines: [{ name: 'Degen #1', uri: 'https://example.com/degen/1' }],
//     guards: {
//       nftBurn: {
//         requiredCollection: nftBurnCollection.address,
//       },
//     },
//   });

//   // When we try to mint from it without providing
//   // any mint settings for the nftBurn guard.
//   const mint = generateSigner(umi);
//   const promise = transactionBuilder(umi).add().sendAndConfirm();
//   mintV2(umi, {
//     candyMachine,
//     collectionUpdateAuthority: collection.updateAuthority.publicKey,
//   });

//   // Then we expect an error.
//   await assertThrows(
//     t,
//     promise,
//     /Please provide some minting settings for the \[nftBurn\] guard/
//   );
// });
