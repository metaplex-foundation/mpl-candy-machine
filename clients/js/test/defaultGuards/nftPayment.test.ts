// import {
//   generateSigner,
//   sol,
//   some,
//   transactionBuilder,
// } from '@metaplex-foundation/umi';
// import test from 'ava';
// import { createCollectionNft, createUmi, createV2 } from '../_setup';
// import { mintV2 } from '../../src';

// test('it transfers an NFT from the payer to the destination', async (t) => {
//   // Given a loaded Candy Machine with an nftPayment guard on a required collection.
//   const umi = await createUmi();
//   const nftTreasury = generateSigner(umi);
//   const requiredCollectionAuthority = generateSigner(umi);
//   const requiredCollection = await createCollectionNft(umi, {
//     updateAuthority: requiredCollectionAuthority,
//   });
//   const collectionMint = (await createCollectionNft(umi)).publicKey;
//   const { publicKey: candyMachine } = await createV2(umi, {
//     collectionMint,

//     configLines: [{ name: 'Degen #1', uri: 'https://example.com/degen/1' }],
//     guards: {
//       nftPayment: {
//         requiredCollection: requiredCollection.address,
//         destination: nftTreasury.publicKey,
//       },
//     },
//   });

//   // And a payer that owns an NFT from that collection.
//   const payer = await generateSignerWithSol(umi, sol(10));
//   const payerNft = await createNft(umi, {
//     tokenOwner: payer.publicKey,
//     collection: requiredCollection.address,
//     collectionAuthority: requiredCollectionAuthority,
//   });

//   // When the payer mints from it using its NFT to pay.
//   const mint = generateSigner(umi);
//   await transactionBuilder(umi).add().sendAndConfirm();
//   mintV2(
//     umi,
//     {
//       candyMachine,
//       collectionUpdateAuthority: collection.updateAuthority.publicKey,
//       guards: {
//         nftPayment: {
//           mint: payerNft.address,
//         },
//       },
//     },
//     { payer }
//   );

//   // Then minting was successful.
//   await assertSuccessfulMint(
//     t,
//     umi,
//     { mint, owner: minter },
//     {
//       candyMachine,
//       collectionUpdateAuthority: collection.updateAuthority.publicKey,
//       nft,
//       owner: payer.publicKey,
//     }
//   );

//   // And the NFT now belongs to the NFT treasury.
//   const updatedNft = await umi.nfts().findByMint({
//     mintAddress: payerNft.address,
//     tokenOwner: nftTreasury.publicKey,
//   });

//   assertNftWithToken(updatedNft);
//   t.true(
//     updatedNft.token.ownerAddress.equals(nftTreasury.publicKey),
//     'The NFT is now owned by the NFT treasury'
//   );
// });

// test('it works when the provided NFT is not on an associated token account', async (t) => {
//   // Given a loaded Candy Machine with an nftPayment guard on a required collection.
//   const umi = await createUmi();
//   const nftTreasury = generateSigner(umi);
//   const requiredCollectionAuthority = generateSigner(umi);
//   const requiredCollection = await createCollectionNft(umi, {
//     updateAuthority: requiredCollectionAuthority,
//   });
//   const collectionMint = (await createCollectionNft(umi)).publicKey;
//   const { publicKey: candyMachine } = await createV2(umi, {
//     collectionMint,

//     configLines: [{ name: 'Degen #1', uri: 'https://example.com/degen/1' }],
//     guards: {
//       nftPayment: {
//         requiredCollection: requiredCollection.address,
//         destination: nftTreasury.publicKey,
//       },
//     },
//   });

//   // And a payer that owns an NFT from that collection
//   // but not on an associated token account.
//   const payer = await generateSignerWithSol(umi, sol(10));
//   const payerNftTokenAccount = generateSigner(umi);
//   const payerNft = await createNft(umi, {
//     tokenOwner: payer.publicKey,
//     tokenAddress: payerNftTokenAccount, // <-- This creates a non-associated token account.
//     collection: requiredCollection.address,
//     collectionAuthority: requiredCollectionAuthority,
//   });

//   // When the payer mints from it using its NFT to pay
//   // whilst providing the token address.
//   const mint = generateSigner(umi);
//   await transactionBuilder(umi).add().sendAndConfirm();
//   mintV2(
//     umi,
//     {
//       candyMachine,
//       collectionUpdateAuthority: collection.updateAuthority.publicKey,
//       guards: {
//         nftPayment: {
//           mint: payerNft.address,
//           tokenAccount: payerNftTokenAccount.publicKey,
//         },
//       },
//     },
//     { payer }
//   );

//   // Then minting was successful.
//   await assertSuccessfulMint(
//     t,
//     umi,
//     { mint, owner: minter },
//     {
//       candyMachine,
//       collectionUpdateAuthority: collection.updateAuthority.publicKey,
//       nft,
//       owner: payer.publicKey,
//     }
//   );

//   // And the NFT now belongs to the NFT treasury.
//   const updatedNft = await umi.nfts().findByMint({
//     mintAddress: payerNft.address,
//     tokenOwner: nftTreasury.publicKey,
//   });

//   assertNftWithToken(updatedNft);
//   t.true(
//     updatedNft.token.ownerAddress.equals(nftTreasury.publicKey),
//     'The NFT is now owned by the NFT treasury'
//   );
// });

// test('it fails if the payer does not own the right NFT', async (t) => {
//   // Given a loaded Candy Machine with an nftPayment guard on a required collection.
//   const umi = await createUmi();
//   const nftTreasury = generateSigner(umi);
//   const requiredCollectionAuthority = generateSigner(umi);
//   const requiredCollection = await createCollectionNft(umi, {
//     updateAuthority: requiredCollectionAuthority,
//   });
//   const collectionMint = (await createCollectionNft(umi)).publicKey;
//   const { publicKey: candyMachine } = await createV2(umi, {
//     collectionMint,

//     configLines: [{ name: 'Degen #1', uri: 'https://example.com/degen/1' }],
//     guards: {
//       nftPayment: {
//         requiredCollection: requiredCollection.address,
//         destination: nftTreasury.publicKey,
//       },
//     },
//   });

//   // And a payer that owns an NFT this is not from that collection.
//   const payer = await generateSignerWithSol(umi, sol(10));
//   const payerNft = await createNft(umi, {
//     tokenOwner: payer.publicKey,
//   });

//   // When the payer tries to mint from it using its NFT to pay.
//   const mint = generateSigner(umi);
//   const promise = transactionBuilder(umi).add().sendAndConfirm();
//   mintV2(
//     umi,
//     {
//       candyMachine,
//       collectionUpdateAuthority: collection.updateAuthority.publicKey,
//       guards: {
//         nftPayment: {
//           mint: payerNft.address,
//         },
//       },
//     },
//     { payer }
//   );

//   // Then we expect an error.
//   await t.throwsAsync(promise, { message: /Invalid NFT collection/ });
// });

// test('it fails if the payer tries to provide an NFT from an unverified collection', async (t) => {
//   // Given a loaded Candy Machine with an nftPayment guard on a required collection.
//   const umi = await createUmi();
//   const nftTreasury = generateSigner(umi);
//   const requiredCollectionAuthority = generateSigner(umi);
//   const requiredCollection = await createCollectionNft(umi, {
//     updateAuthority: requiredCollectionAuthority,
//   });
//   const collectionMint = (await createCollectionNft(umi)).publicKey;
//   const { publicKey: candyMachine } = await createV2(umi, {
//     collectionMint,

//     configLines: [{ name: 'Degen #1', uri: 'https://example.com/degen/1' }],
//     guards: {
//       nftPayment: {
//         requiredCollection: requiredCollection.address,
//         destination: nftTreasury.publicKey,
//       },
//     },
//   });

//   // And a payer that owns an unverified NFT from that collection.
//   const payer = await generateSignerWithSol(umi, sol(10));
//   const payerNft = await createNft(umi, {
//     tokenOwner: payer.publicKey,
//     collection: requiredCollection.address,
//   });

//   // When the payer tries to mint from it using its NFT to pay.
//   const mint = generateSigner(umi);
//   const promise = transactionBuilder(umi).add().sendAndConfirm();
//   mintV2(
//     umi,
//     {
//       candyMachine,
//       collectionUpdateAuthority: collection.updateAuthority.publicKey,
//       guards: {
//         nftPayment: {
//           mint: payerNft.address,
//         },
//       },
//     },
//     { payer }
//   );

//   // Then we expect an error.
//   await t.throwsAsync(promise, { message: /Invalid NFT collection/ });
// });

// test('it charges a bot tax when trying to pay with the wrong NFT', async (t) => {
//   // Given a loaded Candy Machine with an nftPayment guard
//   // on a required collection and a bot tax guard.
//   const umi = await createUmi();
//   const nftTreasury = generateSigner(umi);
//   const requiredCollectionAuthority = generateSigner(umi);
//   const requiredCollection = await createCollectionNft(umi, {
//     updateAuthority: requiredCollectionAuthority,
//   });
//   const collectionMint = (await createCollectionNft(umi)).publicKey;
//   const { publicKey: candyMachine } = await createV2(umi, {
//     collectionMint,

//     configLines: [{ name: 'Degen #1', uri: 'https://example.com/degen/1' }],
//     guards: {
//       botTax: {
//         lamports: sol(0.1),
//         lastInstruction: true,
//       },
//       nftPayment: {
//         requiredCollection: requiredCollection.address,
//         destination: nftTreasury.publicKey,
//       },
//     },
//   });

//   // And a payer that owns an NFT this is not from that collection.
//   const payer = await generateSignerWithSol(umi, sol(10));
//   const payerNft = await createNft(umi, {
//     tokenOwner: payer.publicKey,
//   });

//   // When the payer tries to mint from it using its NFT to pay.
//   const mint = generateSigner(umi);
//   const promise = transactionBuilder(umi).add().sendAndConfirm();
//   mintV2(
//     umi,
//     {
//       candyMachine,
//       collectionUpdateAuthority: collection.updateAuthority.publicKey,
//       guards: {
//         nftPayment: {
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

// test('minting settings must be provided', async (t) => {
//   // Given a loaded Candy Machine with a third party signer guard.
//   const umi = await createUmi();
//   const collectionMint = (await createCollectionNft(umi)).publicKey;
//   const { publicKey: candyMachine } = await createV2(umi, {
//     collectionMint,

//     configLines: [{ name: 'Degen #1', uri: 'https://example.com/degen/1' }],
//     guards: {
//       nftPayment: {
//         requiredCollection: generateSigner(umi).publicKey,
//         destination: generateSigner(umi).publicKey,
//       },
//     },
//   });

//   // When we try to mint from it without providing the third party signer.
//   const payer = await generateSignerWithSol(umi, sol(10));
//   const mint = generateSigner(umi);
//   const promise = transactionBuilder(umi).add().sendAndConfirm();
//   mintV2(
//     umi,
//     {
//       candyMachine,
//       collectionUpdateAuthority: collection.updateAuthority.publicKey,
//     },
//     { payer }
//   );

//   // Then we expect an error.
//   await assertThrows(
//     t,
//     promise,
//     /Please provide some minting settings for the \[nftPayment\] guard/
//   );
// });
