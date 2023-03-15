/* eslint-disable no-promise-executor-return */
import { setComputeUnitLimit } from '@metaplex-foundation/mpl-essentials';
import {
  findCollectionAuthorityRecordPda,
  findMasterEditionPda,
  findMetadataDelegateRecordPda,
  findMetadataPda,
  MetadataDelegateRole,
} from '@metaplex-foundation/mpl-token-metadata';
import {
  base58PublicKey,
  generateSigner,
  publicKey,
  transactionBuilder,
} from '@metaplex-foundation/umi';
import test from 'ava';
import {
  createLutForCandyMachine,
  findCandyGuardPda,
  findCandyMachineAuthorityPda,
  mintV2,
  setMintAuthority,
} from '../src';
import {
  assertSuccessfulMint,
  createCollectionNft,
  createUmi,
  createV1,
  createV2,
} from './_setup';

test('it can create a LUT for a candy machine v2', async (t) => {
  // Given a candy machine with a candy guard.
  const umi = await createUmi();
  const collectionMint = (await createCollectionNft(umi)).publicKey;
  const { publicKey: candyMachine } = await createV2(umi, {
    collectionMint,
    configLines: [{ name: 'Degen #1', uri: 'https://example.com/degen/1' }],
    guards: {},
  });

  // And given a transaction builder that mints an NFT without an LUT.
  const mint = generateSigner(umi);
  const builderWithoutLut = transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      mintV2(umi, {
        candyMachine,
        nftMint: mint,
        collectionMint,
        collectionUpdateAuthority: umi.identity.publicKey,
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

  // Then we expect the LUT addresses to be the following.
  const collectionAuthorityPda = findCandyMachineAuthorityPda(umi, {
    candyMachine,
  });
  t.deepEqual(
    lut.addresses.map(base58PublicKey).sort(),
    [
      candyMachine,
      findCandyGuardPda(umi, { base: candyMachine }),
      collectionMint,
      findMetadataPda(umi, { mint: collectionMint }),
      findMasterEditionPda(umi, { mint: collectionMint }),
      umi.identity.publicKey,
      collectionAuthorityPda,
      findMetadataDelegateRecordPda(umi, {
        mint: collectionMint,
        delegateRole: MetadataDelegateRole.Collection,
        updateAuthority: umi.identity.publicKey,
        delegate: collectionAuthorityPda,
      }),
      publicKey('Sysvar1nstructions1111111111111111111111111'),
      publicKey('SysvarS1otHashes111111111111111111111111111'),
    ]
      .map(base58PublicKey)
      .sort()
  );

  // And we expect the mint builder to be smaller with the LUT.
  const builderWithLut = builderWithoutLut.setAddressLookupTables([lut]);
  const transactionSizeDifference =
    builderWithoutLut.getTransactionSize(umi) -
    builderWithLut.getTransactionSize(umi);
  const expectedSizeDifference =
    (32 - 1) * 9 + // Replaces keys with indexes for 9 out of 10 addresses (one is a Signer).
    -32 + // Adds 32 bytes for the LUT address itself.
    -2; // Adds 2 bytes for writable and readonly array sizes.
  t.is(transactionSizeDifference, expectedSizeDifference);

  // And we can use the builder with LUT to mint an NFT
  // providing we wait a little bit for the LUT to become active.
  await new Promise((resolve) => setTimeout(resolve, 1000));
  await builderWithLut.sendAndConfirm(umi);
  await assertSuccessfulMint(t, umi, { mint, owner: umi.identity });
});

test('it can create a LUT for a candy machine v1', async (t) => {
  // Given a candy machine v1 with a candy guard.
  const umi = await createUmi();
  const collectionMint = (await createCollectionNft(umi)).publicKey;
  const { publicKey: candyMachine } = await createV1(umi, {
    collectionMint,
    configLines: [{ name: 'Degen #1', uri: 'https://example.com/degen/1' }],
    guards: {},
  });

  // When we create a LUT for the candy machine.
  const recentSlot = await umi.rpc.getSlot({ commitment: 'finalized' });
  const [, lut] = await createLutForCandyMachine(umi, recentSlot, candyMachine);

  // Then we expect the LUT addresses to contain the legacy collection authority Record.
  const collectionAuthorityPda = findCandyMachineAuthorityPda(umi, {
    candyMachine,
  });
  const collectionAuthorityRecord = findCollectionAuthorityRecordPda(umi, {
    mint: collectionMint,
    collectionAuthority: collectionAuthorityPda,
  });
  t.true(
    lut.addresses
      .map(base58PublicKey)
      .includes(base58PublicKey(collectionAuthorityRecord))
  );
});

test('it can create a LUT for a candy machine with no candy guard', async (t) => {
  // Given a candy machine with no candy guard.
  const umi = await createUmi();
  const collectionMint = (await createCollectionNft(umi)).publicKey;
  const { publicKey: candyMachine } = await createV2(umi, {
    collectionMint,
    configLines: [{ name: 'Degen #1', uri: 'https://example.com/degen/1' }],
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
  t.true(
    lut.addresses.map(base58PublicKey).includes(base58PublicKey(mintAuthority))
  );
});
