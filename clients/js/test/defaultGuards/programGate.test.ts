// import test from 'ava';

// test('it allows minting with specified program in transaction', async (t) => {
//   // Given a loaded Candy Machine with a programGate guard allowing the memo program.
//   const umi = await createUmi();
//   const collectionMint = (await createCollectionNft(umi)).publicKey;
//   const { publicKey: candyMachine } = await createV2(umi, {
//     collectionMint,

//     configLines: [{ name: 'Degen #1', uri: 'https://example.com/degen/1' }],
//     guards: {
//       programGate: {
//         additional: [MEMO_PROGRAM_ID],
//       },
//     },
//   });

//   // When we mint an NFT with a memo instruction in the transaction.
//   const payer = await generateSignerWithSol(umi, sol(10));
//   const transactionBuilder = await umi.candyMachines().builders().mint(
//     {
//       candyMachine,
//       collectionUpdateAuthority: collection.updateAuthority.publicKey,
//     },
//     { payer }
//   );
//   transactionBuilder.add(createMemoInstruction());
//   await umi.rpc().sendAndConfirmTransaction(transactionBuilder);

//   // Then minting was successful.
//   const { mintSigner, tokenAddress } = transactionBuilder.getContext();
//   const nft = (await umi.nfts().findByMint({
//     mintAddress: mintSigner.publicKey,
//     tokenAddress,
//   })) as NftWithToken;
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

// test('it forbids minting with unspecified program in transaction', async (t) => {
//   // Given a loaded Candy Machine with a programGate guard allowing no additional programs.
//   const umi = await createUmi();
//   const collectionMint = (await createCollectionNft(umi)).publicKey;
//   const { publicKey: candyMachine } = await createV2(umi, {
//     collectionMint,

//     configLines: [{ name: 'Degen #1', uri: 'https://example.com/degen/1' }],
//     guards: {
//       programGate: {
//         additional: [],
//       },
//     },
//   });

//   // When we try to mint an NFT with a memo instruction in the transaction.
//   const payer = await generateSignerWithSol(umi, sol(10));
//   const transactionBuilder = await umi.candyMachines().builders().mint(
//     {
//       candyMachine,
//       collectionUpdateAuthority: collection.updateAuthority.publicKey,
//     },
//     { payer }
//   );
//   transactionBuilder.add(createMemoInstruction());
//   const promise = umi.rpc().sendAndConfirmTransaction(transactionBuilder);

//   // Then we expect an error.
//   await assertThrows(
//     t,
//     promise,
//     /An unauthorized program was found in the transaction/
//   );
// });

// test('it forbids candy machine creation with more than 5 specified programs', async (t) => {
//   // When we try to create a Candy Machine with a
//   // programGate guard allowing more than 5 programs.
//   const umi = await createUmi();
//   const promise = createCandyMachine(umi, {
//     configLines: [{ name: 'Degen #1', uri: 'https://example.com/degen/1' }],
//     guards: {
//       programGate: {
//         additional: Array(6).fill(MEMO_PROGRAM_ID),
//       },
//     },
//   });

//   // Then we expect an error.
//   await t.throwsAsync(promise, {
//     message: /MaximumOfFiveAdditionalProgramsError/,
//   });
// });

// test('it charges a bot tax when minting with unspecified program in transaction', async (t) => {
//   // Given a loaded Candy Machine with a botTax guard
//   // and a programGate guard allowing no additional programs.
//   const umi = await createUmi();
//   const collectionMint = (await createCollectionNft(umi)).publicKey;
//   const { publicKey: candyMachine } = await createV2(umi, {
//     collectionMint,

//     configLines: [{ name: 'Degen #1', uri: 'https://example.com/degen/1' }],
//     guards: {
//       botTax: {
//         lamports: sol(0.1),
//         lastInstruction: false,
//       },
//       programGate: {
//         additional: [],
//       },
//     },
//   });

//   // When we try to mint an NFT with a memo instruction in the transaction.
//   const payer = await generateSignerWithSol(umi, sol(10));
//   const transactionBuilder = await umi.candyMachines().builders().mint(
//     {
//       candyMachine,
//       collectionUpdateAuthority: collection.updateAuthority.publicKey,
//     },
//     { payer }
//   );
//   transactionBuilder.add(createMemoInstruction());
//   await umi.rpc().sendAndConfirmTransaction(transactionBuilder);

//   // Then the transaction succeeded but the NFT was not minted.
//   const { mintSigner, tokenAddress } = transactionBuilder.getContext();
//   const promise = umi.nfts().findByMint({
//     mintAddress: mintSigner.publicKey,
//     tokenAddress,
//   });
//   await t.throwsAsync(promise, { message: /AccountNotFoundError/ });

//   // And the payer was charged a bot tax.
//   const payerBalance = await umi.rpc.getBalance(payer.publicKey);
//   t.true(
//     isEqualToAmount(payerBalance, sol(9.9), sol(0.01)),
//     'payer was charged a bot tax'
//   );
// });

// const createMemoInstruction = (message = 'Hello World!') =>
//   TransactionBuilder.make().add({
//     instruction: new TransactionInstruction({
//       keys: [],
//       programId: MEMO_PROGRAM_ID,
//       data: Buffer.from(message, 'utf8'),
//     }),
//     signers: [],
//   });
