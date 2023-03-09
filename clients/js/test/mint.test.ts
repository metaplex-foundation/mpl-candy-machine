import { createMintWithSingleToken } from '@metaplex-foundation/mpl-essentials';
import {
  generateSigner,
  none,
  transactionBuilder,
} from '@metaplex-foundation/umi';
import test from 'ava';
import {
  CandyMachine,
  fetchCandyMachine,
  findCandyGuardPda,
  mint as mintV1,
} from '../src';
import {
  assertSuccessfulMint,
  createCollectionNft,
  createUmi,
  createV1,
} from './_setup';

test.only('it can mint from a candy guard with no guards', async (t) => {
  // Given a candy machine with a candy guard that has no guards.
  const umi = await createUmi();
  const collectionMint = (await createCollectionNft(umi)).publicKey;
  const candyMachineSigner = await createV1(umi, {
    collectionMint,
    guards: {},
    groups: [],
  });
  const candyMachine = candyMachineSigner.publicKey;
  const candyGuard = findCandyGuardPda(umi, { base: candyMachine });

  // When we mint from the candy guard.
  const mint = generateSigner(umi);
  const owner = generateSigner(umi).publicKey;
  await transactionBuilder(umi)
    .add(createMintWithSingleToken(umi, { mint, owner }))
    .add(
      mintV1(umi, {
        candyMachine,
        candyGuard,
        nftMint: mint.publicKey,
        nftMintAuthority: umi.identity,
        collectionMint,
        collectionUpdateAuthority: umi.identity.publicKey,
        mintArgs: new Uint8Array(0),
        label: none(),
      })
    )
    .sendAndConfirm();

  // Then the mint was successful.
  await assertSuccessfulMint(t, umi, { mint, owner });

  // And the candy machine was updated.
  const candyMachineAccount = await fetchCandyMachine(umi, candyMachine);
  t.like(candyMachineAccount, <CandyMachine>{ itemsRedeemed: 1n });
});
