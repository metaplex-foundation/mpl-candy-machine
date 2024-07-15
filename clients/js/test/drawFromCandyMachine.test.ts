import { setComputeUnitLimit } from '@metaplex-foundation/mpl-toolbox';
import { generateSigner, transactionBuilder } from '@metaplex-foundation/umi';
import test from 'ava';
import {
  CandyMachine,
  drawFromCandyMachine,
  fetchCandyMachine,
  TokenStandard,
} from '../src';
import { assertItemBought, createNft, createUmi, createV2 } from './_setup';

test('it can mint directly from a candy machine as the mint authority', async (t) => {
  // Given a loaded candy machine.
  const umi = await createUmi();
  const candyMachineSigner = await createV2(umi, {
    items: [
      {
        id: (await createNft(umi)).publicKey,
        tokenStandard: TokenStandard.NonFungible,
      },
      {
        id: (await createNft(umi)).publicKey,
        tokenStandard: TokenStandard.NonFungible,
      },
    ],
    startSale: true,
  });
  const candyMachine = candyMachineSigner.publicKey;

  // When we mint a new NFT directly from the candy machine as the mint authority.
  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 400000 }))
    .add(
      drawFromCandyMachine(umi, {
        candyMachine,
        mintAuthority: umi.identity,
      })
    )
    .sendAndConfirm(umi);

  // Then the mint was successful.
  await assertItemBought(t, umi, { candyMachine });

  // And the candy machine was updated.
  const candyMachineAccount = await fetchCandyMachine(umi, candyMachine);
  t.like(candyMachineAccount, <CandyMachine>{ itemsRedeemed: 1n });
});

test('it cannot mint directly from a candy machine if we are not the mint authority', async (t) => {
  // Given a loaded candy machine with a mint authority A.
  const umi = await createUmi();
  const candyMachineSigner = await createV2(umi, {
    items: [
      {
        id: (await createNft(umi)).publicKey,
        tokenStandard: TokenStandard.NonFungible,
      },
      {
        id: (await createNft(umi)).publicKey,
        tokenStandard: TokenStandard.NonFungible,
      },
    ],
    startSale: true,
  });
  const candyMachine = candyMachineSigner.publicKey;

  // When we try to mint directly from the candy machine as mint authority B.
  const mintAuthorityB = generateSigner(umi);
  const promise = transactionBuilder()
    .add(
      drawFromCandyMachine(umi, {
        candyMachine,
        mintAuthority: mintAuthorityB,
      })
    )
    .sendAndConfirm(umi);

  // Then we expect a program error.
  await t.throwsAsync(promise, {
    message: /A has one constraint was violated/,
  });

  // And the candy machine stayed the same.
  const candyMachineAccount = await fetchCandyMachine(umi, candyMachine);
  t.like(candyMachineAccount, <CandyMachine>{ itemsRedeemed: 0n });
});
