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
  createLutForCandyMachine,
  fetchCandyMachine,
  findCandyGuardPda,
  getMplCandyMachineCoreProgramId,
  mintV2,
  setMintAuthority,
} from '../src';
import {
  assertItemBought,
  createUmi,
  createV2,
  getNewConfigLine,
} from './_setup';

test('it can create a LUT for a candy machine v2', async (t) => {
  // Given a candy machine with a candy guard.
  const umi = await createUmi();
  const { publicKey: candyMachine } = await createV2(umi, {
    configLines: [await getNewConfigLine(umi)],
    guards: {},
  });

  // And given a transaction builder that mints an NFT without an LUT.
  const builderWithoutLut = transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      mintV2(umi, {
        candyMachine,
      })
    );

  // When we create a LUT for the candy machine.
  const recentSlot = await umi.rpc.getSlot({ commitment: 'finalized' });
  const [lutBuilder, lut] = await createLutForCandyMachine(
    umi,
    recentSlot,
    candyMachine
  );
  await lutBuilder.sendAndConfirm(umi);

  t.deepEqual(
    [...lut.addresses].sort(),
    [
      candyMachine,
      findCandyGuardPda(umi, { base: candyMachine })[0],
      umi.identity.publicKey,
      getSysvar('instructions'),
      getSysvar('slotHashes'),
      getSplTokenProgramId(umi),
      getSplAssociatedTokenProgramId(umi),
      getMplTokenMetadataProgramId(umi),
      getMplCandyMachineCoreProgramId(umi),
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

  assertItemBought(t, umi, { candyMachine });
});

test('it can create a LUT for a candy machine with no candy guard', async (t) => {
  // Given a candy machine with no candy guard.
  const umi = await createUmi();

  const { publicKey: candyMachine } = await createV2(umi, {
    configLines: [await getNewConfigLine(umi)],
  });

  // And a custom mint authority.
  const mintAuthority = generateSigner(umi);
  await setMintAuthority(umi, {
    candyMachine,
    mintAuthority,
  }).sendAndConfirm(umi);

  // When we create a LUT for the candy machine.
  const recentSlot = await umi.rpc.getSlot({ commitment: 'finalized' });
  const [, lut] = await createLutForCandyMachine(umi, recentSlot, candyMachine);

  // Then we expect the LUT addresses to contain the mint authority.
  t.true(lut.addresses.includes(mintAuthority.publicKey));
});
