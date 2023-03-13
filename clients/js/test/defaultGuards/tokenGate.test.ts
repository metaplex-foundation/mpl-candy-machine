// import test from 'ava';

// test('it allows minting when the payer owns a specific token', async (t) => {
//   // Given a payer with one token.
//   const umi = await createUmi();
//   const payer = await generateSignerWithSol(umi, sol(10));
//   const { token: payerTokens } = await createMintAndToken(umi, {
//     mintAuthority: generateSigner(umi),
//     owner: payer.publicKey,
//     initialSupply: token(1),
//   });

//   // And a loaded Candy Machine with the token gate guard.
//   const collectionMint = (await createCollectionNft(umi)).publicKey;
//   const { publicKey: candyMachine } = await createV2(umi, {
//     collectionMint,

//     configLines: [{ name: 'Degen #1', uri: 'https://example.com/degen/1' }],
//     guards: {
//       tokenGate: {
//         mint: payerTokens.mint.address,
//         amount: token(1),
//       },
//     },
//   });

//   // When the payer mints from it.
//   const mint = generateSigner(umi);
//   await transactionBuilder(umi).add().sendAndConfirm();
//   mintV2(
//     umi,
//     {
//       candyMachine,
//       collectionUpdateAuthority: collection.updateAuthority.publicKey,
//       guards: {
//         tokenGate: {
//           tokenAccount: payerTokens.address,
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
// });

// test('it allows minting when the payer owns multiple tokens from a specific mint', async (t) => {
//   // Given a payer with 42 tokens.
//   const umi = await createUmi();
//   const payer = await generateSignerWithSol(umi, sol(10));
//   const { token: payerTokens } = await createMintAndToken(umi, {
//     mintAuthority: generateSigner(umi),
//     owner: payer.publicKey,
//     initialSupply: token(42),
//   });

//   // And a loaded Candy Machine with the token gate guard that requires 5 tokens.
//   const collectionMint = (await createCollectionNft(umi)).publicKey;
//   const { publicKey: candyMachine } = await createV2(umi, {
//     collectionMint,

//     configLines: [{ name: 'Degen #1', uri: 'https://example.com/degen/1' }],
//     guards: {
//       tokenGate: {
//         mint: payerTokens.mint.address,
//         amount: token(5),
//       },
//     },
//   });

//   // When the payer mints from it.
//   const mint = generateSigner(umi);
//   await transactionBuilder(umi).add().sendAndConfirm();
//   mintV2(
//     umi,
//     {
//       candyMachine,
//       collectionUpdateAuthority: collection.updateAuthority.publicKey,
//       guards: {
//         tokenGate: {
//           tokenAccount: payerTokens.address,
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
// });

// test('it defaults to using the associated token account of the payer', async (t) => {
//   // Given a payer with one token using an associated token account.
//   const umi = await createUmi();
//   const payer = await generateSignerWithSol(umi, sol(10));
//   const { token: payerTokens } = await createMintAndToken(umi, {
//     mintAuthority: generateSigner(umi),
//     owner: payer.publicKey,
//     initialSupply: token(1),
//   });

//   // And a loaded Candy Machine with the token gate guard.
//   const collectionMint = (await createCollectionNft(umi)).publicKey;
//   const { publicKey: candyMachine } = await createV2(umi, {
//     collectionMint,

//     configLines: [{ name: 'Degen #1', uri: 'https://example.com/degen/1' }],
//     guards: {
//       tokenGate: {
//         mint: payerTokens.mint.address,
//         amount: token(1),
//       },
//     },
//   });

//   // When the payer mints from it without specifying the token account.
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

// test('it forbids minting when the owner does not own a specific token', async (t) => {
//   // Given a payer with zero tokens.
//   const umi = await createUmi();
//   const payer = await generateSignerWithSol(umi, sol(10));
//   const { token: payerTokens } = await createMintAndToken(umi, {
//     mintAuthority: generateSigner(umi),
//     owner: payer.publicKey,
//     initialSupply: token(0),
//   });

//   // And a loaded Candy Machine with the token gate guard.
//   const collectionMint = (await createCollectionNft(umi)).publicKey;
//   const { publicKey: candyMachine } = await createV2(umi, {
//     collectionMint,

//     configLines: [{ name: 'Degen #1', uri: 'https://example.com/degen/1' }],
//     guards: {
//       tokenGate: {
//         mint: payerTokens.mint.address,
//         amount: token(1),
//       },
//     },
//   });

//   // When the payer tries to mint from it.
//   const mint = generateSigner(umi);
//   const promise = transactionBuilder(umi).add().sendAndConfirm();
//   mintV2(
//     umi,
//     {
//       candyMachine,
//       collectionUpdateAuthority: collection.updateAuthority.publicKey,
//       guards: {
//         tokenGate: {
//           tokenAccount: payerTokens.address,
//         },
//       },
//     },
//     { payer }
//   );

//   // Then we expect an error.
//   await t.throwsAsync(promise, { message: /Not enough tokens on the account/ });
// });

// test('it forbids minting when the owner does not own enough tokens', async (t) => {
//   // Given a payer with 5 tokens.
//   const umi = await createUmi();
//   const payer = await generateSignerWithSol(umi, sol(10));
//   const { token: payerTokens } = await createMintAndToken(umi, {
//     mintAuthority: generateSigner(umi),
//     owner: payer.publicKey,
//     initialSupply: token(5),
//   });

//   // And a loaded Candy Machine with the token gate guard that requires 10 tokens.
//   const collectionMint = (await createCollectionNft(umi)).publicKey;
//   const { publicKey: candyMachine } = await createV2(umi, {
//     collectionMint,

//     configLines: [{ name: 'Degen #1', uri: 'https://example.com/degen/1' }],
//     guards: {
//       tokenGate: {
//         mint: payerTokens.mint.address,
//         amount: token(10),
//       },
//     },
//   });

//   // When the payer tries to mint from it.
//   const mint = generateSigner(umi);
//   const promise = transactionBuilder(umi).add().sendAndConfirm();
//   mintV2(
//     umi,
//     {
//       candyMachine,
//       collectionUpdateAuthority: collection.updateAuthority.publicKey,
//       guards: {
//         tokenGate: {
//           tokenAccount: payerTokens.address,
//         },
//       },
//     },
//     { payer }
//   );

//   // Then we expect an error.
//   await t.throwsAsync(promise, { message: /Not enough tokens on the account/ });
// });

// test('it charges a bot tax when trying to mint without the right amount of tokens', async (t) => {
//   // Given a payer with zero tokens.
//   const umi = await createUmi();
//   const payer = await generateSignerWithSol(umi, sol(10));
//   const { token: payerTokens } = await createMintAndToken(umi, {
//     mintAuthority: generateSigner(umi),
//     owner: payer.publicKey,
//     initialSupply: token(0),
//   });

//   // And a loaded Candy Machine with the token gate guard and the bot tax guard.
//   const collectionMint = (await createCollectionNft(umi)).publicKey;
//   const { publicKey: candyMachine } = await createV2(umi, {
//     collectionMint,

//     configLines: [{ name: 'Degen #1', uri: 'https://example.com/degen/1' }],
//     guards: {
//       botTax: {
//         lamports: sol(0.1),
//         lastInstruction: true,
//       },
//       tokenGate: {
//         mint: payerTokens.mint.address,
//         amount: token(1),
//       },
//     },
//   });

//   // When the payer tries to mint from it.
//   const mint = generateSigner(umi);
//   const promise = transactionBuilder(umi).add().sendAndConfirm();
//   mintV2(
//     umi,
//     {
//       candyMachine,
//       collectionUpdateAuthority: collection.updateAuthority.publicKey,
//       guards: {
//         tokenGate: {
//           tokenAccount: payerTokens.address,
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
