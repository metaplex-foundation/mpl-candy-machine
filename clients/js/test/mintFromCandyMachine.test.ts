import { createMintWithAssociatedToken } from '@metaplex-foundation/mpl-toolbox';
import { generateSigner, transactionBuilder } from '@metaplex-foundation/umi';
import test from 'ava';
import { CandyMachine, fetchCandyMachine, mintFromCandyMachine } from '../src';
import { createCollectionNft, createUmi, createV2 } from './_setup';

test('it cannot mint from a candy machine v2', async (t) => {
  // Given a loaded candy machine v2.
  const umi = await createUmi();
  const collectionMint = (await createCollectionNft(umi)).publicKey;
  const candyMachineSigner = await createV2(umi, {
    collectionMint,
    configLines: [
      { name: 'Degen #1', uri: 'https://example.com/degen/1' },
      { name: 'Degen #2', uri: 'https://example.com/degen/2' },
    ],
  });
  const candyMachine = candyMachineSigner.publicKey;

  // When we try to mint from it directly usint the mint v1 instruction.
  const mint = generateSigner(umi);
  const owner = generateSigner(umi).publicKey;
  const promise = transactionBuilder()
    .add(createMintWithAssociatedToken(umi, { mint, owner, amount: 1 }))
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
    .sendAndConfirm(umi);

  // Then we expect a program error.
  await t.throwsAsync(promise, { message: /Use MintV2 instead/ });

  // And the candy machine stayed the same.
  const candyMachineAccount = await fetchCandyMachine(umi, candyMachine);
  t.like(candyMachineAccount, <CandyMachine>{ itemsRedeemed: 0n });
});
