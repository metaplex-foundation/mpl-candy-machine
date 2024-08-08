import { setComputeUnitLimit } from '@metaplex-foundation/mpl-toolbox';
import { generateSigner, transactionBuilder } from '@metaplex-foundation/umi';
import test from 'ava';
import {
  drawFromGumballMachine,
  fetchGumballMachine,
  GumballMachine,
  TokenStandard,
} from '../src';
import { assertItemBought, create, createNft, createUmi } from './_setup';

test('it can mint directly from a gumball machine as the mint authority', async (t) => {
  // Given a loaded gumball machine.
  const umi = await createUmi();
  const gumballMachineSigner = await create(umi, {
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
  const gumballMachine = gumballMachineSigner.publicKey;

  // When we mint a new NFT directly from the gumball machine as the mint authority.
  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 400000 }))
    .add(
      drawFromGumballMachine(umi, {
        gumballMachine,
        mintAuthority: umi.identity,
      })
    )
    .sendAndConfirm(umi);

  // Then the mint was successful.
  await assertItemBought(t, umi, { gumballMachine });

  // And the gumball machine was updated.
  const gumballMachineAccount = await fetchGumballMachine(umi, gumballMachine);
  t.like(gumballMachineAccount, <GumballMachine>{ itemsRedeemed: 1n });
});

test('it cannot mint directly from a gumball machine if we are not the mint authority', async (t) => {
  // Given a loaded gumball machine with a mint authority A.
  const umi = await createUmi();
  const gumballMachineSigner = await create(umi, {
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
  const gumballMachine = gumballMachineSigner.publicKey;

  // When we try to mint directly from the gumball machine as mint authority B.
  const mintAuthorityB = generateSigner(umi);
  const promise = transactionBuilder()
    .add(
      drawFromGumballMachine(umi, {
        gumballMachine,
        mintAuthority: mintAuthorityB,
      })
    )
    .sendAndConfirm(umi);

  // Then we expect a program error.
  await t.throwsAsync(promise, {
    message: /A has one constraint was violated/,
  });

  // And the gumball machine stayed the same.
  const gumballMachineAccount = await fetchGumballMachine(umi, gumballMachine);
  t.like(gumballMachineAccount, <GumballMachine>{ itemsRedeemed: 0n });
});
