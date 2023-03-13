// import test from 'ava';

// test('it allows minting until a threshold of NFTs have been redeemed', async (t) => {
//   // Given a loaded Candy Machine with a redeemedAmount guard with a threshold of 1 NFT.
//   const umi = await createUmi();
//   const collectionMint = (await createCollectionNft(umi)).publicKey;
//   const { publicKey: candyMachine } = await createV2(umi, {
//     collectionMint,

//     configLines: [
//       { name: 'Degen #1', uri: 'https://example.com/degen/1' },
//       { name: 'Degen #1', uri: 'https://example.com/degen/1' },
//     ],
//     guards: {
//       redeemedAmount: {
//         maximum: toBigNumber(1),
//       },
//     },
//   });

//   // When we mint its first item.
//   const payer = await generateSignerWithSol(umi, sol(10));
//   const mint = generateSigner(umi);
//   await transactionBuilder(umi).add().sendAndConfirm();
//   mintV2(
//     umi,
//     {
//       candyMachine,
//       collectionUpdateAuthority: collection.updateAuthority.publicKey,
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
// });

// test('it forbids minting once the redeemed threshold has been reached', async (t) => {
//   // Given a loaded Candy Machine with a redeemedAmount guard with a threshold of 1 NFT.
//   const umi = await createUmi();
//   const collectionMint = (await createCollectionNft(umi)).publicKey;
//   const { publicKey: candyMachine } = await createV2(umi, {
//     collectionMint,

//     configLines: [
//       { name: 'Degen #1', uri: 'https://example.com/degen/1' },
//       { name: 'Degen #1', uri: 'https://example.com/degen/1' },
//     ],
//     guards: {
//       redeemedAmount: {
//         maximum: toBigNumber(1),
//       },
//     },
//   });

//   // And assuming its first item has already been minted.
//   const mint = generateSigner(umi);
//   await transactionBuilder(umi).add().sendAndConfirm();
//   mintV2(
//     umi,
//     {
//       candyMachine,
//       collectionUpdateAuthority: collection.updateAuthority.publicKey,
//     },
//     { payer: await generateSignerWithSol(umi, sol(10)) }
//   );

//   // When we try to mint its second item.
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
//     /Current redemeed items is at the set maximum amount/
//   );
// });

// test('it charges a bot tax when trying to mint once the threshold has been reached', async (t) => {
//   // Given a loaded Candy Machine with a bot tax guard
//   // and a redeemedAmount guard with a threshold of 1 NFT.
//   const umi = await createUmi();
//   const collectionMint = (await createCollectionNft(umi)).publicKey;
//   const { publicKey: candyMachine } = await createV2(umi, {
//     collectionMint,

//     configLines: [
//       { name: 'Degen #1', uri: 'https://example.com/degen/1' },
//       { name: 'Degen #1', uri: 'https://example.com/degen/1' },
//     ],
//     guards: {
//       botTax: {
//         lamports: sol(0.1),
//         lastInstruction: true,
//       },
//       redeemedAmount: {
//         maximum: toBigNumber(1),
//       },
//     },
//   });

//   // And assuming its first item has already been minted.
//   const mint = generateSigner(umi);
//   await transactionBuilder(umi).add().sendAndConfirm();
//   mintV2(
//     umi,
//     {
//       candyMachine,
//       collectionUpdateAuthority: collection.updateAuthority.publicKey,
//     },
//     { payer: await generateSignerWithSol(umi, sol(10)) }
//   );

//   // When we try to mint its second item.
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

//   // Then we expect a bot tax error.
//   await t.throwsAsync(promise, { message: /CandyMachineBotTaxError/ });

//   // And the payer was charged a bot tax.
//   const payerBalance = await umi.rpc.getBalance(payer.publicKey);
//   t.true(
//     isEqualToAmount(payerBalance, sol(9.9), sol(0.01)),
//     'payer was charged a bot tax'
//   );
// });
