import {
  createAssociatedToken,
  createMint,
  findAssociatedTokenPda,
  mintTokensTo,
} from '@metaplex-foundation/mpl-essentials';
import {
  DigitalAssetWithToken,
  fetchDigitalAssetWithAssociatedToken,
  TokenStandard,
} from '@metaplex-foundation/mpl-token-metadata';
import {
  generateSigner,
  publicKey,
  some,
  transactionBuilder,
} from '@metaplex-foundation/umi';
import test from 'ava';
import { CandyMachine, fetchCandyMachine, mintFromCandyMachine } from '../src';
import {
  createCandyMachineWithItems,
  createCollectionNft,
  createUmi,
} from './_setup';

test('it can mint directly from a candy machine as the mint authority', async (t) => {
  // Given a loaded candy machine.
  const umi = await createUmi();
  const collectionMint = (await createCollectionNft(umi)).publicKey;
  const candyMachineSigner = await createCandyMachineWithItems(umi, {
    collectionMint,
    items: [
      { name: 'Degen #1', uri: 'https://example.com/degen/1' },
      { name: 'Degen #2', uri: 'https://example.com/degen/2' },
    ],
  });
  const candyMachine = candyMachineSigner.publicKey;

  // When we mint a new NFT directly from the candy machine as the mint authority.
  const nftMint = generateSigner(umi);
  const nftOwner = generateSigner(umi).publicKey;
  await transactionBuilder(umi)
    .add(createMint(umi, { mint: nftMint }))
    .add(
      createAssociatedToken(umi, {
        mint: nftMint.publicKey,
        owner: nftOwner,
      })
    )
    .add(
      mintTokensTo(umi, {
        amount: 1,
        mint: nftMint.publicKey,
        token: findAssociatedTokenPda(umi, {
          mint: nftMint.publicKey,
          owner: nftOwner,
        }),
      })
    )
    .add(
      mintFromCandyMachine(umi, {
        candyMachine,
        mintAuthority: umi.identity,
        nftMint: nftMint.publicKey,
        nftMintAuthority: umi.identity,
        collectionMint,
        collectionUpdateAuthority: umi.identity.publicKey,
      })
    )
    .sendAndConfirm();

  // Then the mint was successful.
  const nft = await fetchDigitalAssetWithAssociatedToken(
    umi,
    nftMint.publicKey,
    nftOwner
  );
  t.like(nft, <DigitalAssetWithToken>{
    publicKey: publicKey(nftMint),
    mint: {
      publicKey: publicKey(nftMint),
      supply: 1n,
    },
    token: {
      mint: publicKey(nftMint),
      owner: publicKey(nftOwner),
    },
    edition: { isOriginal: true },
    metadata: { tokenStandard: some(TokenStandard.NonFungible) },
  });

  // And the candy machine was updated.
  const candyMachineAccount = await fetchCandyMachine(umi, candyMachine);
  t.like(candyMachineAccount, <CandyMachine>{ itemsRedeemed: 1n });
});

test('it cannot mint directly from a candy machine if we are not the mint authority', async (t) => {
  // Given a loaded candy machine with a mint authority A.
  const umi = await createUmi();
  const mintAuthorityA = generateSigner(umi);
  const collectionMint = await createCollectionNft(umi, {
    authority: mintAuthorityA,
  });
  const candyMachineSigner = await createCandyMachineWithItems(umi, {
    authority: mintAuthorityA.publicKey,
    collectionMint: collectionMint.publicKey,
    collectionUpdateAuthority: mintAuthorityA,
    items: [
      { name: 'Degen #1', uri: 'https://example.com/degen/1' },
      { name: 'Degen #2', uri: 'https://example.com/degen/2' },
    ],
  });
  const candyMachine = candyMachineSigner.publicKey;

  // When we try to mint directly from the candy machine as mint authority B.
  const mintAuthorityB = generateSigner(umi);
  const nftMint = generateSigner(umi);
  const nftOwner = generateSigner(umi).publicKey;
  const promise = transactionBuilder(umi)
    .add(createMint(umi, { mint: nftMint }))
    .add(
      createAssociatedToken(umi, {
        mint: nftMint.publicKey,
        owner: nftOwner,
      })
    )
    .add(
      mintTokensTo(umi, {
        amount: 1,
        mint: nftMint.publicKey,
        token: findAssociatedTokenPda(umi, {
          mint: nftMint.publicKey,
          owner: nftOwner,
        }),
      })
    )
    .add(
      mintFromCandyMachine(umi, {
        candyMachine,
        mintAuthority: mintAuthorityB,
        nftMint: nftMint.publicKey,
        nftMintAuthority: umi.identity,
        collectionMint: collectionMint.publicKey,
        collectionUpdateAuthority: umi.identity.publicKey,
      })
    )
    .sendAndConfirm();

  // Then we expect a program error.
  await t.throwsAsync(promise, {
    message: /A has one constraint was violated/,
  });

  // And the candy machine stayed the same.
  const candyMachineAccount = await fetchCandyMachine(umi, candyMachine);
  t.like(candyMachineAccount, <CandyMachine>{ itemsRedeemed: 0n });
});
