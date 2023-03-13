// import { generateSigner } from '@metaplex-foundation/umi';
// import test from 'ava';
// import { createUmi } from '../_setup';

// test('it transfers tokens from the payer to the destination', async (t) => {
//   // Given a loaded Candy Machine with a tokenPayment guard that requires 5 tokens.
//   const umi = await createUmi();
//   const treasuryAuthority = generateSigner(umi);
//   const { token: tokenTreasury } = await createMintAndToken(umi, {
//     mintAuthority: treasuryAuthority,
//     owner: treasuryAuthority.publicKey,
//     initialSupply: token(100),
//   });

//   const collectionMint = (await createCollectionNft(umi)).publicKey;
//   const { publicKey: candyMachine } = await createV2(umi, {
//     collectionMint,

//     configLines: [{ name: 'Degen #1', uri: 'https://example.com/degen/1' }],
//     guards: {
//       tokenPayment: {
//         amount: token(5),
//         mint: tokenTreasury.mint.address,
//         destinationAta: tokenTreasury.address,
//       },
//     },
//   });

//   // And a payer that has 12 of these tokens.
//   const payer = await generateSignerWithSol(umi, sol(10));
//   const {} = await umi.tokens().mint({
//     mintAddress: tokenTreasury.mint.address,
//     mintAuthority: treasuryAuthority,
//     toOwner: payer.publicKey,
//     amount: token(12),
//   });

//   // When we mint from it using that payer.
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

//   // And the treasury token received 5 tokens.
//   const updatedTokenTreasury = await umi
//     .tokens()
//     .findTokenByAddress({ address: tokenTreasury.address });

//   t.true(
//     isEqualToAmount(updatedTokenTreasury.amount, token(105)),
//     'treasury received tokens'
//   );

//   // And the payer lost 5 tokens.
//   const payerToken = await umi.tokens().findTokenWithMintByMint({
//     mint: tokenTreasury.mint.address,
//     addressType: 'owner',
//     address: payer.publicKey,
//   });

//   t.true(isEqualToAmount(payerToken.amount, token(7)), 'payer lost tokens');
// });

// test('it fails if the payer does not have enough tokens', async (t) => {
//   // Given a loaded Candy Machine with a tokenPayment guard that requires 5 tokens.
//   const umi = await createUmi();
//   const treasuryAuthority = generateSigner(umi);
//   const { token: tokenTreasury } = await createMintAndToken(umi, {
//     mintAuthority: treasuryAuthority,
//     owner: treasuryAuthority.publicKey,
//   });

//   const collectionMint = (await createCollectionNft(umi)).publicKey;
//   const { publicKey: candyMachine } = await createV2(umi, {
//     collectionMint,

//     configLines: [{ name: 'Degen #1', uri: 'https://example.com/degen/1' }],
//     guards: {
//       tokenPayment: {
//         amount: token(5),
//         mint: tokenTreasury.mint.address,
//         destinationAta: tokenTreasury.address,
//       },
//     },
//   });

//   // And a payer that has only 4 of these tokens.
//   const payer = await generateSignerWithSol(umi, sol(10));
//   const {} = await umi.tokens().mint({
//     mintAddress: tokenTreasury.mint.address,
//     mintAuthority: treasuryAuthority,
//     toOwner: payer.publicKey,
//     amount: token(4),
//   });

//   // When we try to mint from it using that payer.
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
//   await t.throwsAsync(promise, { message: /Not enough tokens on the account/ });
// });

// test('it charges a bot tax if the payer does not have enough tokens', async (t) => {
//   // Given a loaded Candy Machine with a tokenPayment guard that requires 5 tokens and a botTax guard.
//   const umi = await createUmi();
//   const treasuryAuthority = generateSigner(umi);
//   const { token: tokenTreasury } = await createMintAndToken(umi, {
//     mintAuthority: treasuryAuthority,
//     owner: treasuryAuthority.publicKey,
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
//       tokenPayment: {
//         amount: token(5),
//         mint: tokenTreasury.mint.address,
//         destinationAta: tokenTreasury.address,
//       },
//     },
//   });

//   // And a payer that has only 4 of these tokens.
//   const payer = await generateSignerWithSol(umi, sol(10));
//   const {} = await umi.tokens().mint({
//     mintAddress: tokenTreasury.mint.address,
//     mintAuthority: treasuryAuthority,
//     toOwner: payer.publicKey,
//     amount: token(4),
//   });

//   // When we try to mint from it using that payer.
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
