/* eslint-disable no-promise-executor-return */
import { getMplTokenMetadataProgramId } from '@metaplex-foundation/mpl-token-metadata';
import {
  getSplAssociatedTokenProgramId,
  getSplTokenProgramId,
  getSysvar,
  setComputeUnitLimit,
} from '@metaplex-foundation/mpl-toolbox';
import { generateSigner, transactionBuilder } from '@metaplex-foundation/umi';
import test from 'ava';
import {
  createLutForGumballMachine,
  draw,
  findGumballGuardPda,
  getMallowGumballProgramId,
  setMintAuthority,
  TokenStandard,
} from '../src';
import { assertItemBought, create, createNft, createUmi } from './_setup';

test('it can create a LUT for a gumball machine v2', async (t) => {
  // Given a gumball machine with a gumball guard.
  const umi = await createUmi();
  const { publicKey: gumballMachine } = await create(umi, {
    items: [
      {
        id: (await createNft(umi)).publicKey,
        tokenStandard: TokenStandard.NonFungible,
      },
    ],
    startSale: true,
    guards: {},
  });

  // And given a transaction builder that mints an NFT without an LUT.
  const builderWithoutLut = transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      draw(umi, {
        gumballMachine,
      })
    );

  // When we create a LUT for the gumball machine.
  const recentSlot = await umi.rpc.getSlot({ commitment: 'finalized' });
  const [lutBuilder, lut] = await createLutForGumballMachine(
    umi,
    recentSlot,
    gumballMachine
  );
  await lutBuilder.sendAndConfirm(umi);

  t.deepEqual(
    [...lut.addresses].sort(),
    [
      gumballMachine,
      findGumballGuardPda(umi, { base: gumballMachine })[0],
      umi.identity.publicKey,
      getSysvar('instructions'),
      getSysvar('slotHashes'),
      getSplTokenProgramId(umi),
      getSplAssociatedTokenProgramId(umi),
      getMplTokenMetadataProgramId(umi),
      getMallowGumballProgramId(umi),
    ].sort()
  );

  // And we expect the mint builder to be smaller with the LUT.
  const builderWithLut = builderWithoutLut.setAddressLookupTables([lut]);
  const transactionSizeDifference =
    builderWithoutLut.getTransactionSize(umi) -
    builderWithLut.getTransactionSize(umi);
  const expectedSizeDifference =
    (32 - 1) * 7 + // Replaces keys with indexes for 7 out of 10 addresses (one is a Signer).
    -32 + // Adds 32 bytes for the LUT address itself.
    -2; // Adds 2 bytes for writable and readonly array sizes.
  t.is(transactionSizeDifference, expectedSizeDifference);

  // And we can use the builder with LUT to mint an NFT
  // providing we wait a little bit for the LUT to become active.
  await new Promise((resolve) => setTimeout(resolve, 1000));
  await builderWithLut.sendAndConfirm(umi);

  assertItemBought(t, umi, { gumballMachine });
});

test('it can create a LUT for a gumball machine with no gumball guard', async (t) => {
  // Given a gumball machine with no gumball guard.
  const umi = await createUmi();

  const { publicKey: gumballMachine } = await create(umi, {
    items: [
      {
        id: (await createNft(umi)).publicKey,
        tokenStandard: TokenStandard.NonFungible,
      },
    ],
    startSale: true,
  });

  // And a custom mint authority.
  const mintAuthority = generateSigner(umi);
  await setMintAuthority(umi, {
    gumballMachine,
    mintAuthority,
  }).sendAndConfirm(umi);

  // When we create a LUT for the gumball machine.
  const recentSlot = await umi.rpc.getSlot({ commitment: 'finalized' });
  const [, lut] = await createLutForGumballMachine(
    umi,
    recentSlot,
    gumballMachine
  );

  // Then we expect the LUT addresses to contain the mint authority.
  t.true(lut.addresses.includes(mintAuthority.publicKey));
});
