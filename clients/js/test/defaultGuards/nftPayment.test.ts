import {
  fetchDigitalAssetWithAssociatedToken,
  TokenStandard as MplTokenStandard,
} from '@metaplex-foundation/mpl-token-metadata';
import {
  createMint,
  createToken,
  setComputeUnitLimit,
} from '@metaplex-foundation/mpl-toolbox';
import {
  generateSigner,
  publicKey,
  sol,
  some,
  transactionBuilder,
} from '@metaplex-foundation/umi';
import test from 'ava';
import { draw, TokenStandard } from '../../src';
import {
  assertBotTax,
  assertItemBought,
  create,
  createCollectionNft,
  createNft,
  createUmi,
  createVerifiedNft,
  createVerifiedProgrammableNft,
} from '../_setup';

test('it transfers an NFT from the payer to the destination', async (t) => {
  // Given a loaded Gumball Machine with an nftPayment guard on a required collection.
  const umi = await createUmi();
  const destination = generateSigner(umi).publicKey;
  const requiredCollectionAuthority = generateSigner(umi);
  const { publicKey: requiredCollection } = await createCollectionNft(umi, {
    authority: requiredCollectionAuthority,
  });

  const { publicKey: gumballMachine } = await create(umi, {
    items: [
      {
        id: (await createNft(umi)).publicKey,
        tokenStandard: TokenStandard.NonFungible,
      },
    ],
    startSale: true,
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

  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      draw(umi, {
        gumballMachine,

        mintArgs: {
          nftPayment: some({
            tokenStandard: MplTokenStandard.NonFungible,
            requiredCollection,
            mint: nftToSend.publicKey,
            destination,
          }),
        },
      })
    )
    .sendAndConfirm(umi);

  // Then minting was successful.
  await assertItemBought(t, umi, { gumballMachine });

  // And the NFT now belongs to the NFT destination.
  const updatedNft = await fetchDigitalAssetWithAssociatedToken(
    umi,
    nftToSend.publicKey,
    destination
  );
  t.deepEqual(updatedNft.token.owner, destination);
});

test('it allows minting even when the payer is different from the buyer', async (t) => {
  // Given a loaded Gumball Machine with an nftPayment guard on a required collection.
  const umi = await createUmi();
  const destination = generateSigner(umi).publicKey;
  const requiredCollectionAuthority = generateSigner(umi);
  const { publicKey: requiredCollection } = await createCollectionNft(umi, {
    authority: requiredCollectionAuthority,
  });

  const { publicKey: gumballMachine } = await create(umi, {
    items: [
      {
        id: (await createNft(umi)).publicKey,
        tokenStandard: TokenStandard.NonFungible,
      },
    ],
    startSale: true,
    guards: {
      nftPayment: some({ requiredCollection, destination }),
    },
  });

  // And given a separate buyer owns an NFT from that collection.
  const buyer = generateSigner(umi);
  const nftToSend = await createVerifiedNft(umi, {
    tokenOwner: buyer.publicKey,
    collectionMint: requiredCollection,
    collectionAuthority: requiredCollectionAuthority,
  });

  // When the buyer mints from it using its NFT to pay.

  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      draw(umi, {
        gumballMachine,

        buyer,

        mintArgs: {
          nftPayment: some({
            tokenStandard: MplTokenStandard.NonFungible,
            requiredCollection,
            mint: nftToSend.publicKey,
            destination,
          }),
        },
      })
    )
    .sendAndConfirm(umi);

  // Then minting was successful.
  await assertItemBought(t, umi, { gumballMachine, buyer: publicKey(buyer) });

  // And the NFT now belongs to the NFT destination.
  const updatedNft = await fetchDigitalAssetWithAssociatedToken(
    umi,
    nftToSend.publicKey,
    destination
  );
  t.deepEqual(updatedNft.token.owner, destination);
});

test('it works when the provided NFT is not on an associated token account', async (t) => {
  // Given a loaded Gumball Machine with an nftPayment guard on a required collection.
  const umi = await createUmi();
  const destination = generateSigner(umi).publicKey;
  const requiredCollectionAuthority = generateSigner(umi);
  const { publicKey: requiredCollection } = await createCollectionNft(umi, {
    authority: requiredCollectionAuthority,
  });

  const { publicKey: gumballMachine } = await create(umi, {
    items: [
      {
        id: (await createNft(umi)).publicKey,
        tokenStandard: TokenStandard.NonFungible,
      },
    ],
    startSale: true,
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

  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      draw(umi, {
        gumballMachine,

        mintArgs: {
          nftPayment: some({
            tokenStandard: MplTokenStandard.NonFungible,
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
  await assertItemBought(t, umi, { gumballMachine });

  // And the NFT now belongs to the NFT destination.
  const updatedNft = await fetchDigitalAssetWithAssociatedToken(
    umi,
    nftToSend.publicKey,
    destination
  );
  t.deepEqual(updatedNft.token.owner, destination);
});

test('it fails if the payer does not own the right NFT', async (t) => {
  // Given a loaded Gumball Machine with an nftPayment guard on a required collection.
  const umi = await createUmi();
  const destination = generateSigner(umi).publicKey;
  const requiredCollectionAuthority = generateSigner(umi);
  const { publicKey: requiredCollection } = await createCollectionNft(umi, {
    authority: requiredCollectionAuthority,
  });

  const { publicKey: gumballMachine } = await create(umi, {
    items: [
      {
        id: (await createNft(umi)).publicKey,
        tokenStandard: TokenStandard.NonFungible,
      },
    ],
    startSale: true,
    guards: {
      nftPayment: some({ requiredCollection, destination }),
    },
  });

  // And given the identity owns an NFT this is not from that collection.
  const wrongNft = await createNft(umi, {
    tokenOwner: umi.identity.publicKey,
  });

  // When the identity tries to mint from it using its NFT to pay.

  const promise = transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      draw(umi, {
        gumballMachine,

        mintArgs: {
          nftPayment: some({
            tokenStandard: MplTokenStandard.NonFungible,
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
  // Given a loaded Gumball Machine with an nftPayment guard on a required collection.
  const umi = await createUmi();
  const destination = generateSigner(umi).publicKey;
  const requiredCollectionAuthority = generateSigner(umi);
  const { publicKey: requiredCollection } = await createCollectionNft(umi, {
    authority: requiredCollectionAuthority,
  });

  const { publicKey: gumballMachine } = await create(umi, {
    items: [
      {
        id: (await createNft(umi)).publicKey,
        tokenStandard: TokenStandard.NonFungible,
      },
    ],
    startSale: true,
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

  const promise = transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      draw(umi, {
        gumballMachine,

        mintArgs: {
          nftPayment: some({
            tokenStandard: MplTokenStandard.NonFungible,
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
  // Given a loaded Gumball Machine with an nftPayment guard on a required collection and a bot tax.
  const umi = await createUmi();
  const destination = generateSigner(umi).publicKey;
  const requiredCollectionAuthority = generateSigner(umi);
  const { publicKey: requiredCollection } = await createCollectionNft(umi, {
    authority: requiredCollectionAuthority,
  });

  const { publicKey: gumballMachine } = await create(umi, {
    items: [
      {
        id: (await createNft(umi)).publicKey,
        tokenStandard: TokenStandard.NonFungible,
      },
    ],
    startSale: true,
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

  const { signature } = await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      draw(umi, {
        gumballMachine,

        mintArgs: {
          nftPayment: some({
            tokenStandard: MplTokenStandard.NonFungible,
            requiredCollection,
            mint: wrongNft.publicKey,
            destination,
          }),
        },
      })
    )
    .sendAndConfirm(umi);

  // Then we expect a bot tax error.
  await assertBotTax(t, umi, signature, /InvalidNftCollection/);
});

test('it transfers a Programmable NFT from the payer to the destination', async (t) => {
  // Given a loaded Gumball Machine with an nftPayment guard on a required collection.
  const umi = await createUmi();
  const destination = generateSigner(umi).publicKey;
  const requiredCollectionAuthority = generateSigner(umi);
  const { publicKey: requiredCollection } = await createCollectionNft(umi, {
    authority: requiredCollectionAuthority,
  });

  const { publicKey: gumballMachine } = await create(umi, {
    items: [
      {
        id: (await createNft(umi)).publicKey,
        tokenStandard: TokenStandard.NonFungible,
      },
    ],
    startSale: true,
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

  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 800_000 }))
    .add(
      draw(umi, {
        gumballMachine,

        mintArgs: {
          nftPayment: some({
            tokenStandard: MplTokenStandard.ProgrammableNonFungible,
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
  await assertItemBought(t, umi, { gumballMachine });

  // And the NFT now belongs to the NFT destination.
  const updatedNft = await fetchDigitalAssetWithAssociatedToken(
    umi,
    pnftToSend.publicKey,
    destination
  );
  t.deepEqual(updatedNft.token.owner, destination);
  t.like(updatedNft.metadata, {
    tokenStandard: some(MplTokenStandard.ProgrammableNonFungible),
  });
});
