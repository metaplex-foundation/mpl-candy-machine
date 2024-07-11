import {
  createAssociatedToken,
  createMint,
  createToken,
  findAssociatedTokenPda,
  setComputeUnitLimit,
  transferTokens,
} from '@metaplex-foundation/mpl-toolbox';
import {
  generateSigner,
  publicKey,
  sol,
  some,
  transactionBuilder,
} from '@metaplex-foundation/umi';
import test from 'ava';
import { mintV2 } from '../../src';
import {
  assertBotTax,
  assertItemBought,
  createCollectionNft,
  createNft,
  createUmi,
  createV2,
  createVerifiedNft,
  getNewConfigLine,
} from '../_setup';

test('it allows minting when the payer owns an NFT from a certain collection', async (t) => {
  // Given the identity owns an NFT from a certain collection.
  const umi = await createUmi();
  const requiredCollectionAuthority = generateSigner(umi);
  const { publicKey: requiredCollection } = await createCollectionNft(umi, {
    authority: requiredCollectionAuthority,
  });
  const nftToVerify = await createVerifiedNft(umi, {
    tokenOwner: umi.identity.publicKey,
    collectionMint: requiredCollection,
    collectionAuthority: requiredCollectionAuthority,
  });

  // And a loaded Candy Machine with an nftGate guard.

  const { publicKey: candyMachine } = await createV2(umi, {
    configLines: [await getNewConfigLine(umi)],
    guards: {
      nftGate: some({ requiredCollection }),
    },
  });

  // When we mint from it.

  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      mintV2(umi, {
        candyMachine,

        mintArgs: {
          nftGate: some({ mint: nftToVerify.publicKey }),
        },
      })
    )
    .sendAndConfirm(umi);

  // Then minting was successful.
  await assertItemBought(t, umi, { candyMachine });
});

test('it allows minting even when the payer is different from the buyer', async (t) => {
  // Given a separate buyer that owns an NFT from a certain collection.
  const umi = await createUmi();
  const buyer = generateSigner(umi);
  const requiredCollectionAuthority = generateSigner(umi);
  const { publicKey: requiredCollection } = await createCollectionNft(umi, {
    authority: requiredCollectionAuthority,
  });
  const nftToVerify = await createVerifiedNft(umi, {
    tokenOwner: buyer.publicKey,
    collectionMint: requiredCollection,
    collectionAuthority: requiredCollectionAuthority,
  });

  // And a loaded Candy Machine with an nftGate guard.

  const { publicKey: candyMachine } = await createV2(umi, {
    configLines: [await getNewConfigLine(umi)],
    guards: {
      nftGate: some({ requiredCollection }),
    },
  });

  // When we mint from it.

  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      mintV2(umi, {
        candyMachine,

        buyer,

        mintArgs: {
          nftGate: some({ mint: nftToVerify.publicKey }),
        },
      })
    )
    .sendAndConfirm(umi);

  // Then minting was successful.
  await assertItemBought(t, umi, { candyMachine, buyer: publicKey(buyer) });
});

test('it allows minting when the NFT is not on an associated token account', async (t) => {
  // Given a payer that owns an NFT from a certain collection on a non-associated token account.
  const umi = await createUmi();
  const requiredCollectionAuthority = generateSigner(umi);
  const { publicKey: requiredCollection } = await createCollectionNft(umi, {
    authority: requiredCollectionAuthority,
  });
  const nftToVerify = generateSigner(umi);
  const nftToVerifyToken = generateSigner(umi);
  await transactionBuilder()
    .add(createMint(umi, { mint: nftToVerify }))
    .add(
      createToken(umi, {
        mint: nftToVerify.publicKey,
        owner: umi.identity.publicKey,
        token: nftToVerifyToken,
      })
    )
    .sendAndConfirm(umi);
  await createVerifiedNft(umi, {
    mint: nftToVerify,
    tokenOwner: umi.identity.publicKey,
    token: nftToVerifyToken.publicKey, // <- We're explicitly creating a non-associated token account.
    collectionMint: requiredCollection,
    collectionAuthority: requiredCollectionAuthority,
  });

  // And a loaded Candy Machine with an nftGate guard.

  const { publicKey: candyMachine } = await createV2(umi, {
    configLines: [await getNewConfigLine(umi)],
    guards: {
      nftGate: some({ requiredCollection }),
    },
  });

  // When we mint from it by providing the mint and token addresses.

  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      mintV2(umi, {
        candyMachine,

        mintArgs: {
          nftGate: some({
            mint: nftToVerify.publicKey,
            tokenAccount: nftToVerifyToken.publicKey,
          }),
        },
      })
    )
    .sendAndConfirm(umi);

  // Then minting was successful.
  await assertItemBought(t, umi, { candyMachine });
});

test('it forbids minting when the payer does not own an NFT from a certain collection', async (t) => {
  // Given the identity owns an NFT from a certain collection.
  const umi = await createUmi();
  const requiredCollectionAuthority = generateSigner(umi);
  const { publicKey: requiredCollection } = await createCollectionNft(umi, {
    authority: requiredCollectionAuthority,
  });
  const { publicKey: nftToVerify } = await createVerifiedNft(umi, {
    tokenOwner: umi.identity.publicKey,
    collectionMint: requiredCollection,
    collectionAuthority: requiredCollectionAuthority,
  });

  // But sent their NFT to another wallet.
  const destination = generateSigner(umi).publicKey;
  await transactionBuilder()
    .add(createAssociatedToken(umi, { mint: nftToVerify, owner: destination }))
    .add(
      transferTokens(umi, {
        authority: umi.identity,
        source: findAssociatedTokenPda(umi, {
          mint: nftToVerify,
          owner: umi.identity.publicKey,
        }),
        destination: findAssociatedTokenPda(umi, {
          mint: nftToVerify,
          owner: destination,
        }),
        amount: 1,
      })
    )
    .sendAndConfirm(umi);

  // And a loaded Candy Machine with an nftGate guard on that collection.

  const { publicKey: candyMachine } = await createV2(umi, {
    configLines: [await getNewConfigLine(umi)],
    guards: {
      nftGate: some({ requiredCollection }),
    },
  });

  // When the payer tries to mint from it.

  const promise = transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      mintV2(umi, {
        candyMachine,

        mintArgs: {
          nftGate: some({ mint: nftToVerify }),
        },
      })
    )
    .sendAndConfirm(umi);

  // Then we expect an error.
  await t.throwsAsync(promise, { message: /MissingNft/ });
});

test('it forbids minting when the payer tries to provide an NFT from the wrong collection', async (t) => {
  // Given the identity owns an NFT from a collection A.
  const umi = await createUmi();
  const requiredCollectionAuthorityA = generateSigner(umi);
  const { publicKey: requiredCollectionA } = await createCollectionNft(umi, {
    authority: requiredCollectionAuthorityA,
  });
  const { publicKey: nftToVerify } = await createVerifiedNft(umi, {
    tokenOwner: umi.identity.publicKey,
    collectionMint: requiredCollectionA,
    collectionAuthority: requiredCollectionAuthorityA,
  });

  // And a loaded Candy Machine with an nftGate guard on a Collection B.
  const requiredCollectionAuthorityB = generateSigner(umi);
  const { publicKey: requiredCollectionB } = await createCollectionNft(umi, {
    authority: requiredCollectionAuthorityB,
  });

  const { publicKey: candyMachine } = await createV2(umi, {
    configLines: [await getNewConfigLine(umi)],
    guards: {
      nftGate: some({ requiredCollection: requiredCollectionB }),
    },
  });

  // When the identity tries to mint from it using its collection A NFT.

  const promise = transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      mintV2(umi, {
        candyMachine,

        mintArgs: {
          nftGate: some({ mint: nftToVerify }),
        },
      })
    )
    .sendAndConfirm(umi);

  // Then we expect an error.
  await t.throwsAsync(promise, { message: /InvalidNftCollection/ });
});

test('it forbids minting when the payer tries to provide an NFT from an unverified collection', async (t) => {
  // Given a payer that owns an unverified NFT from a certain collection.
  const umi = await createUmi();
  const requiredCollectionAuthority = generateSigner(umi);
  const { publicKey: requiredCollection } = await createCollectionNft(umi, {
    authority: requiredCollectionAuthority,
  });
  const { publicKey: nftToVerify } = await createNft(umi, {
    tokenOwner: umi.identity.publicKey,
  });

  // And a loaded Candy Machine with an nftGate guard.

  const { publicKey: candyMachine } = await createV2(umi, {
    configLines: [await getNewConfigLine(umi)],
    guards: {
      nftGate: some({ requiredCollection }),
    },
  });

  // When the payer tries to mint from it using its unverified NFT.

  const promise = transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      mintV2(umi, {
        candyMachine,

        mintArgs: {
          nftGate: some({ mint: nftToVerify }),
        },
      })
    )
    .sendAndConfirm(umi);

  // Then we expect an error.
  await t.throwsAsync(promise, { message: /InvalidNftCollection/ });
});

test('it charges a bot tax when trying to mint without owning the right NFT', async (t) => {
  // Given a loaded Candy Machine with an nftGate guard and a bot tax guard.
  const umi = await createUmi();
  const { publicKey: requiredCollection } = await createCollectionNft(umi);

  const { publicKey: candyMachine } = await createV2(umi, {
    configLines: [await getNewConfigLine(umi)],
    guards: {
      botTax: some({ lamports: sol(0.1), lastInstruction: true }),
      nftGate: some({ requiredCollection }),
    },
  });

  // When we try to mint from it using any NFT that's not from the required collection.
  const wrongNft = await createNft(umi);

  const { signature } = await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      mintV2(umi, {
        candyMachine,

        mintArgs: {
          nftGate: some({ mint: wrongNft.publicKey }),
        },
      })
    )
    .sendAndConfirm(umi);

  // Then we expect a bot tax error.
  await assertBotTax(t, umi, signature, /InvalidNftCollection/);
});
