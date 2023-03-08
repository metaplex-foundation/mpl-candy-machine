import {
  createAssociatedToken,
  createMint,
  findAssociatedTokenPda,
  mintTokensTo,
} from '@metaplex-foundation/mpl-essentials';
import {
  generateSigner,
  publicKey,
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

  // When
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

  // Then
  const candyMachineAccount = await fetchCandyMachine(umi, candyMachine);
  t.like(candyMachineAccount, <CandyMachine>{
    authority: publicKey(umi.identity),
  });
});

// it cannot mint directly from a candy machine if we are not the mint authority
