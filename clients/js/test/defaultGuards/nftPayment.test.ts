import {
  createMint,
  createToken,
  setComputeUnitLimit,
} from '@metaplex-foundation/mpl-toolbox';
import {
  TokenStandard,
  fetchDigitalAssetWithAssociatedToken,
} from '@metaplex-foundation/mpl-token-metadata';
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
  assertSuccessfulMint,
  createCollectionNft,
  createNft,
  createUmi,
  createV2,
  createVerifiedNft,
  createVerifiedProgrammableNft,
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
  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      mintV2(umi, {
        candyMachine,
        nftMint: mint,
        collectionMint,
        collectionUpdateAuthority: umi.identity.publicKey,
        mintArgs: {
          nftPayment: some({
            tokenStandard: TokenStandard.NonFungible,
            requiredCollection,
            mint: nftToSend.publicKey,
            destination,
          }),
        },
      })
    )
    .sendAndConfirm(umi);

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
          nftPayment: some({
            tokenStandard: TokenStandard.NonFungible,
            requiredCollection,
            mint: nftToSend.publicKey,
            destination,
          }),
        },
      })
    )
    .sendAndConfirm(umi);

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
  await transactionBuilder()
    .add(createMint(umi, { mint: nftToSend }))
    .add(
      createToken(umi, {
        mint: nftToSend.publicKey,
        owner: umi.identity.publicKey,
        token: nftToSendToken,
      })
    )
    .sendAndConfirm(umi);
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
  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      mintV2(umi, {
        candyMachine,
        nftMint: mint,
        collectionMint,
        collectionUpdateAuthority: umi.identity.publicKey,
        mintArgs: {
          nftPayment: some({
            tokenStandard: TokenStandard.NonFungible,
            requiredCollection,
            mint: nftToSend.publicKey,
            destination,
            tokenAccount: nftToSendToken.publicKey,
          }),
        },
      })
    )
    .sendAndConfirm(umi);

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

test('it fails if the payer does not own the right NFT', async (t) => {
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

  // And given the identity owns an NFT this is not from that collection.
  const wrongNft = await createNft(umi, {
    tokenOwner: umi.identity.publicKey,
  });

  // When the identity tries to mint from it using its NFT to pay.
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
          nftPayment: some({
            tokenStandard: TokenStandard.NonFungible,
            requiredCollection,
            mint: wrongNft.publicKey,
            destination,
          }),
        },
      })
    )
    .sendAndConfirm(umi);

  // Then we expect an error.
  await t.throwsAsync(promise, { message: /InvalidNftCollection/ });
});

test('it fails if the payer tries to provide an NFT from an unverified collection', async (t) => {
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

  // And given the identity owns an unverified NFT from that collection.
  const unverifiedNftToSend = await createNft(umi, {
    tokenOwner: umi.identity.publicKey,
    collection: some({ key: requiredCollection, verified: false }),
  });

  // When the identity tries to mint from it using its NFT to pay.
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
          nftPayment: some({
            tokenStandard: TokenStandard.NonFungible,
            requiredCollection,
            mint: unverifiedNftToSend.publicKey,
            destination,
          }),
        },
      })
    )
    .sendAndConfirm(umi);

  // Then we expect an error.
  await t.throwsAsync(promise, { message: /InvalidNftCollection/ });
});

test('it charges a bot tax when trying to pay with the wrong NFT', async (t) => {
  // Given a loaded Candy Machine with an nftPayment guard on a required collection and a bot tax.
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
      botTax: some({ lamports: sol(0.1), lastInstruction: true }),
      nftPayment: some({ requiredCollection, destination }),
    },
  });

  // And given the identity owns an NFT this is not from that collection.
  const wrongNft = await createNft(umi, {
    tokenOwner: umi.identity.publicKey,
  });

  // When the identity tries to mint from it using its NFT to pay.
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
          nftPayment: some({
            tokenStandard: TokenStandard.NonFungible,
            requiredCollection,
            mint: wrongNft.publicKey,
            destination,
          }),
        },
      })
    )
    .sendAndConfirm(umi);

  // Then we expect a bot tax error.
  await assertBotTax(t, umi, mint, signature, /InvalidNftCollection/);
});

test('it transfers a Programmable NFT from the payer to the destination', async (t) => {
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

  // And given the identity owns a Programmable NFT from that collection.
  const pnftToSend = await createVerifiedProgrammableNft(umi, {
    tokenOwner: umi.identity.publicKey,
    collectionMint: requiredCollection,
    collectionAuthority: requiredCollectionAuthority,
    ruleSet: some(publicKey('eBJLFYPxJmMGKuFwpDWkzxZeUrad92kZRC5BJLpzyT9')),
  });

  // When the payer mints from it using its NFT to pay.
  const mint = generateSigner(umi);
  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 800_000 }))
    .add(
      mintV2(umi, {
        candyMachine,
        nftMint: mint,
        collectionMint,
        collectionUpdateAuthority: umi.identity.publicKey,
        mintArgs: {
          nftPayment: some({
            tokenStandard: TokenStandard.ProgrammableNonFungible,
            requiredCollection,
            mint: pnftToSend.publicKey,
            destination,
            ruleSet: publicKey('eBJLFYPxJmMGKuFwpDWkzxZeUrad92kZRC5BJLpzyT9'),
          }),
        },
      })
    )
    .sendAndConfirm(umi);

  // Then minting was successful.
  await assertSuccessfulMint(t, umi, { mint, owner: umi.identity });

  // And the NFT now belongs to the NFT destination.
  const updatedNft = await fetchDigitalAssetWithAssociatedToken(
    umi,
    pnftToSend.publicKey,
    destination
  );
  t.deepEqual(updatedNft.token.owner, destination);
  t.like(updatedNft.metadata, {
    tokenStandard: some(TokenStandard.ProgrammableNonFungible),
  });
});
