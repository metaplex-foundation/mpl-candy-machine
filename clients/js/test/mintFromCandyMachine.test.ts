import { createMintWithSingleToken } from '@metaplex-foundation/mpl-essentials';
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
import { createCollectionNft, createUmi, createV1 } from './_setup';

test('it can mint directly from a candy machine as the mint authority', async (t) => {
  // Given a loaded candy machine.
  const umi = await createUmi();
  const collectionMint = (await createCollectionNft(umi)).publicKey;
  const candyMachineSigner = await createV1(umi, {
    collectionMint,
    configLines: [
      { name: 'Degen #1', uri: 'https://example.com/degen/1' },
      { name: 'Degen #2', uri: 'https://example.com/degen/2' },
    ],
  });
  const candyMachine = candyMachineSigner.publicKey;

  // When we mint a new NFT directly from the candy machine as the mint authority.
  const mint = generateSigner(umi);
  const owner = generateSigner(umi).publicKey;
  await transactionBuilder(umi)
    .add(createMintWithSingleToken(umi, { mint, owner }))
    .add(
      mintFromCandyMachine(umi, {
        candyMachine,
        mintAuthority: umi.identity,
        nftMint: mint.publicKey,
        nftMintAuthority: umi.identity,
        collectionMint,
        collectionUpdateAuthority: umi.identity.publicKey,
      })
    )
    .sendAndConfirm();

  // Then the mint was successful.
  const nft = await fetchDigitalAssetWithAssociatedToken(
    umi,
    mint.publicKey,
    owner
  );
  t.like(nft, <DigitalAssetWithToken>{
    publicKey: publicKey(mint),
    mint: {
      publicKey: publicKey(mint),
      supply: 1n,
    },
    token: {
      mint: publicKey(mint),
      owner: publicKey(owner),
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
  const candyMachineSigner = await createV1(umi, {
    authority: mintAuthorityA.publicKey,
    collectionMint: collectionMint.publicKey,
    collectionUpdateAuthority: mintAuthorityA,
    configLines: [
      { name: 'Degen #1', uri: 'https://example.com/degen/1' },
      { name: 'Degen #2', uri: 'https://example.com/degen/2' },
    ],
  });
  const candyMachine = candyMachineSigner.publicKey;

  // When we try to mint directly from the candy machine as mint authority B.
  const mintAuthorityB = generateSigner(umi);
  const mint = generateSigner(umi);
  const owner = generateSigner(umi).publicKey;
  const promise = transactionBuilder(umi)
    .add(createMintWithSingleToken(umi, { mint, owner }))
    .add(
      mintFromCandyMachine(umi, {
        candyMachine,
        mintAuthority: mintAuthorityB,
        nftMint: mint.publicKey,
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

// TODO: it cannot mint from a candy machine v2.
