import { TokenStandard as MplTokenStandard } from '@metaplex-foundation/mpl-token-metadata';
import { setComputeUnitLimit } from '@metaplex-foundation/mpl-toolbox';
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
  assertBurnedNft,
  assertItemBought,
  create,
  createCollectionNft,
  createNft,
  createUmi,
  createVerifiedNft,
  createVerifiedProgrammableNft,
} from '../_setup';

test('it burns a specific NFT to allow minting', async (t) => {
  // Given the identity owns an NFT from a certain collection.
  const umi = await createUmi();
  const requiredCollectionAuthority = generateSigner(umi);
  const { publicKey: requiredCollection } = await createCollectionNft(umi, {
    authority: requiredCollectionAuthority,
  });
  const nftToBurn = await createVerifiedNft(umi, {
    tokenOwner: umi.identity.publicKey,
    collectionMint: requiredCollection,
    collectionAuthority: requiredCollectionAuthority,
  });

  // And a loaded Gumball Machine with an nftBurn guard on that collection.

  const { publicKey: gumballMachine } = await create(umi, {
    items: [
      {
        id: (await createNft(umi)).publicKey,
        tokenStandard: TokenStandard.NonFungible,
      },
    ],
    startSale: true,
    guards: {
      nftBurn: some({ requiredCollection }),
    },
  });

  // When the identity mints from it using its NFT to burn.

  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      draw(umi, {
        gumballMachine,

        mintArgs: {
          nftBurn: some({
            tokenStandard: MplTokenStandard.NonFungible,
            requiredCollection,
            mint: nftToBurn.publicKey,
          }),
        },
      })
    )
    .sendAndConfirm(umi);

  // Then minting was successful.
  await assertItemBought(t, umi, { gumballMachine });

  // And the NFT was burned.
  await assertBurnedNft(t, umi, nftToBurn, umi.identity);
});

test('it allows minting even when the payer is different from the buyer', async (t) => {
  // Given a separate buyer owns an NFT from a certain collection.
  const umi = await createUmi();
  const buyer = generateSigner(umi);
  const requiredCollectionAuthority = generateSigner(umi);
  const { publicKey: requiredCollection } = await createCollectionNft(umi, {
    authority: requiredCollectionAuthority,
  });
  const nftToBurn = await createVerifiedNft(umi, {
    tokenOwner: buyer.publicKey,
    collectionMint: requiredCollection,
    collectionAuthority: requiredCollectionAuthority,
  });

  // And a loaded Gumball Machine with an nftBurn guard on that collection.

  const { publicKey: gumballMachine } = await create(umi, {
    items: [
      {
        id: (await createNft(umi)).publicKey,
        tokenStandard: TokenStandard.NonFungible,
      },
    ],
    startSale: true,
    guards: {
      nftBurn: some({ requiredCollection }),
    },
  });

  // When the buyer mints from it using its NFT to burn.

  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      draw(umi, {
        gumballMachine,

        buyer,

        mintArgs: {
          nftBurn: some({
            tokenStandard: MplTokenStandard.NonFungible,
            requiredCollection,
            mint: nftToBurn.publicKey,
          }),
        },
      })
    )
    .sendAndConfirm(umi);

  // Then minting was successful.
  await assertItemBought(t, umi, { gumballMachine, buyer: publicKey(buyer) });

  // And the NFT was burned.
  await assertBurnedNft(t, umi, nftToBurn, buyer);
});

test('it fails if there is not valid NFT to burn', async (t) => {
  // Given a loaded Gumball Machine with an nftBurn guard on a specific collection.
  const umi = await createUmi();
  const requiredCollection = (await createCollectionNft(umi)).publicKey;

  const { publicKey: gumballMachine } = await create(umi, {
    items: [
      {
        id: (await createNft(umi)).publicKey,
        tokenStandard: TokenStandard.NonFungible,
      },
    ],
    startSale: true,
    guards: {
      nftBurn: some({ requiredCollection }),
    },
  });

  // When we try to mint from it using an NFT that's not part of this collection.
  const nftToBurn = await createNft(umi);

  const promise = transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      draw(umi, {
        gumballMachine,

        mintArgs: {
          nftBurn: some({
            tokenStandard: MplTokenStandard.NonFungible,
            requiredCollection,
            mint: nftToBurn.publicKey,
          }),
        },
      })
    )
    .sendAndConfirm(umi);

  // Then we expect an error.
  await t.throwsAsync(promise, { message: /InvalidNftCollection/ });
});

test('it charges a bot tax when trying to mint using the wrong NFT', async (t) => {
  // Given a loaded Gumball Machine with a botTax guard and
  // an nftBurn guard on a specific collection.
  const umi = await createUmi();
  const requiredCollection = (await createCollectionNft(umi)).publicKey;

  const { publicKey: gumballMachine } = await create(umi, {
    items: [
      {
        id: (await createNft(umi)).publicKey,
        tokenStandard: TokenStandard.NonFungible,
      },
    ],
    startSale: true,
    guards: {
      botTax: some({ lamports: sol(0.01), lastInstruction: true }),
      nftBurn: some({ requiredCollection }),
    },
  });

  // When we try to mint from it using an NFT that's not part of this collection.
  const nftToBurn = await createNft(umi);

  const { signature } = await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      draw(umi, {
        gumballMachine,

        mintArgs: {
          nftBurn: some({
            tokenStandard: MplTokenStandard.NonFungible,
            requiredCollection,
            mint: nftToBurn.publicKey,
          }),
        },
      })
    )
    .sendAndConfirm(umi);

  // Then we expect a bot tax error.
  await assertBotTax(t, umi, signature, /InvalidNftCollection/);
});

test('it burns a specific Programmable NFT to allow minting', async (t) => {
  // Given the identity owns an NFT from a certain collection.
  const umi = await createUmi();
  const requiredCollectionAuthority = generateSigner(umi);
  const { publicKey: requiredCollection } = await createCollectionNft(umi, {
    authority: requiredCollectionAuthority,
  });
  const pnftToBurn = await createVerifiedProgrammableNft(umi, {
    tokenOwner: umi.identity.publicKey,
    collectionMint: requiredCollection,
    collectionAuthority: requiredCollectionAuthority,
  });

  // And a loaded Gumball Machine with an nftBurn guard on that collection.

  const { publicKey: gumballMachine } = await create(umi, {
    items: [
      {
        id: (await createNft(umi)).publicKey,
        tokenStandard: TokenStandard.NonFungible,
      },
    ],
    startSale: true,
    guards: {
      nftBurn: some({ requiredCollection }),
    },
  });

  // When the identity mints from it using its pNFT to burn.

  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      draw(umi, {
        gumballMachine,

        mintArgs: {
          nftBurn: some({
            tokenStandard: MplTokenStandard.ProgrammableNonFungible,
            requiredCollection,
            mint: pnftToBurn.publicKey,
          }),
        },
      })
    )
    .sendAndConfirm(umi);

  // Then minting was successful.
  await assertItemBought(t, umi, { gumballMachine });

  // And the NFT was burned.
  await assertBurnedNft(t, umi, pnftToBurn, umi.identity);
});
