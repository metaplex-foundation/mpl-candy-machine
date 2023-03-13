import {
  createMint,
  createToken,
  setComputeUnitLimit,
} from '@metaplex-foundation/mpl-essentials';
import { fetchDigitalAssetWithAssociatedToken } from '@metaplex-foundation/mpl-token-metadata';
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
  createUmi,
  createV2,
  createVerifiedNft,
} from '../_setup';

test('it transfers an NFT from the payer to the destination', async (t) => {
  // Given a loaded Candy Machine with an nftPayment guard on a required collection.
  const umi = await createUmi();
  const destination = generateSigner(umi).publicKey;
  const requiredCollectionAuthority = generateSigner(umi);
  const { publicKey: requiredCollection } = await createCollectionNft(umi, {
    authority: requiredCollectionAuthority,
  });
  const collectionMint = (await createCollectionNft(umi)).publicKey;
  const { publicKey: candyMachine } = await createV2(umi, {
    collectionMint,
    configLines: [{ name: 'Degen #1', uri: 'https://example.com/degen/1' }],
    guards: {
      nftPayment: some({ requiredCollection, destination }),
    },
  });

  // And given the identity owns an NFT from that collection.
  const nftToSend = await createVerifiedNft(umi, {
    tokenOwner: umi.identity.publicKey,
    collectionMint: requiredCollection,
    collectionAuthority: requiredCollectionAuthority,
  });

  // When the payer mints from it using its NFT to pay.
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
          nftPayment: some({
            requiredCollection,
            mint: nftToSend.publicKey,
            destination,
          }),
        },
      })
    )
    .sendAndConfirm();

  // Then minting was successful.
  await assertSuccessfulMint(t, umi, { mint, owner: umi.identity });

  // And the NFT now belongs to the NFT destination.
  const updatedNft = await fetchDigitalAssetWithAssociatedToken(
    umi,
    nftToSend.publicKey,
    destination
  );
  t.deepEqual(updatedNft.token.owner, destination);
});

test('it allows minting even when the payer is different from the minter', async (t) => {
  // Given a loaded Candy Machine with an nftPayment guard on a required collection.
  const umi = await createUmi();
  const destination = generateSigner(umi).publicKey;
  const requiredCollectionAuthority = generateSigner(umi);
  const { publicKey: requiredCollection } = await createCollectionNft(umi, {
    authority: requiredCollectionAuthority,
  });
  const collectionMint = (await createCollectionNft(umi)).publicKey;
  const { publicKey: candyMachine } = await createV2(umi, {
    collectionMint,
    configLines: [{ name: 'Degen #1', uri: 'https://example.com/degen/1' }],
    guards: {
      nftPayment: some({ requiredCollection, destination }),
    },
  });

  // And given a separate minter owns an NFT from that collection.
  const minter = generateSigner(umi);
  const nftToSend = await createVerifiedNft(umi, {
    tokenOwner: minter.publicKey,
    collectionMint: requiredCollection,
    collectionAuthority: requiredCollectionAuthority,
  });

  // When the minter mints from it using its NFT to pay.
  const mint = generateSigner(umi);
  await transactionBuilder(umi)
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      mintV2(umi, {
        candyMachine,
        nftMint: mint,
        minter,
        collectionMint,
        collectionUpdateAuthority: umi.identity.publicKey,
        mintArgs: {
          nftPayment: some({
            requiredCollection,
            mint: nftToSend.publicKey,
            destination,
          }),
        },
      })
    )
    .sendAndConfirm();

  // Then minting was successful.
  await assertSuccessfulMint(t, umi, { mint, owner: minter });

  // And the NFT now belongs to the NFT destination.
  const updatedNft = await fetchDigitalAssetWithAssociatedToken(
    umi,
    nftToSend.publicKey,
    destination
  );
  t.deepEqual(updatedNft.token.owner, destination);
});

test('it works when the provided NFT is not on an associated token account', async (t) => {
  // Given a loaded Candy Machine with an nftPayment guard on a required collection.
  const umi = await createUmi();
  const destination = generateSigner(umi).publicKey;
  const requiredCollectionAuthority = generateSigner(umi);
  const { publicKey: requiredCollection } = await createCollectionNft(umi, {
    authority: requiredCollectionAuthority,
  });
  const collectionMint = (await createCollectionNft(umi)).publicKey;
  const { publicKey: candyMachine } = await createV2(umi, {
    collectionMint,
    configLines: [{ name: 'Degen #1', uri: 'https://example.com/degen/1' }],
    guards: {
      nftPayment: some({ requiredCollection, destination }),
    },
  });

  // And a payer that owns an NFT from that collection
  // but not on an associated token account.
  const nftToSend = generateSigner(umi);
  const nftToSendToken = generateSigner(umi);
  await transactionBuilder(umi)
    .add(createMint(umi, { mint: nftToSend }))
    .add(
      createToken(umi, {
        mint: nftToSend.publicKey,
        owner: umi.identity.publicKey,
        token: nftToSendToken,
      })
    )
    .sendAndConfirm();
  await createVerifiedNft(umi, {
    mint: nftToSend,
    tokenOwner: umi.identity.publicKey,
    token: nftToSendToken.publicKey, // <- We're explicitly creating a non-associated token account.
    collectionMint: requiredCollection,
    collectionAuthority: requiredCollectionAuthority,
  });

  // When the payer mints from it using its NFT to pay
  // whilst providing the token address.
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
          nftPayment: some({
            requiredCollection,
            mint: nftToSend.publicKey,
            destination,
            tokenAccount: nftToSendToken.publicKey,
          }),
        },
      })
    )
    .sendAndConfirm();

  // Then minting was successful.
  await assertSuccessfulMint(t, umi, { mint, owner: umi.identity });

  // And the NFT now belongs to the NFT destination.
  const updatedNft = await fetchDigitalAssetWithAssociatedToken(
    umi,
    nftToSend.publicKey,
    destination
  );
  t.deepEqual(updatedNft.token.owner, destination);
});

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
