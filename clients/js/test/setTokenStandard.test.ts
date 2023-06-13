import { generateSigner, transactionBuilder } from '@metaplex-foundation/umi';
import test from 'ava';
import {
  TokenStandard,
  findCollectionAuthorityRecordPda,
} from '@metaplex-foundation/mpl-token-metadata';
import {
  AccountVersion,
  CandyMachine,
  fetchCandyMachine,
  findCandyMachineAuthorityPda,
  setTokenStandard,
} from '../src';
import { createV1, createCollectionNft, createUmi, createV2 } from './_setup';

test('it can change token standard from NFT to pNFT', async (t) => {
  // Given a Candy Machine with NFT token standard.
  const umi = await createUmi();
  const collectionUpdateAuthority = generateSigner(umi);
  const collection = await createCollectionNft(umi, {
    authority: collectionUpdateAuthority,
  });
  const candyMachine = await createV1(umi, {
    collectionMint: collection.publicKey,
    collectionUpdateAuthority,
  });

  // Then the Candy Machine's token standard is NFT.
  let candyMachineAccount = await fetchCandyMachine(
    umi,
    candyMachine.publicKey
  );

  t.like(candyMachineAccount, <CandyMachine>{
    tokenStandard: TokenStandard.NonFungible,
    version: AccountVersion.V1,
  });

  // When we update its token standard to pNFT
  await transactionBuilder()
    .add(
      setTokenStandard(umi, {
        candyMachine: candyMachine.publicKey,
        collectionMint: collection.publicKey,
        collectionUpdateAuthority,
        collectionAuthorityRecord: findCollectionAuthorityRecordPda(umi, {
          mint: collection.publicKey,
          collectionAuthority: findCandyMachineAuthorityPda(umi, {
            candyMachine: candyMachine.publicKey,
          })[0],
        }),
        tokenStandard: TokenStandard.ProgrammableNonFungible,
      })
    )
    .sendAndConfirm(umi);

  // Then the Candy Machine's token standard is pNFT.
  candyMachineAccount = await fetchCandyMachine(umi, candyMachine.publicKey);

  t.like(candyMachineAccount, <CandyMachine>{
    tokenStandard: TokenStandard.ProgrammableNonFungible,
    version: AccountVersion.V2,
  });
});

test('it can change token standard from pNFT to NFT', async (t) => {
  // Given a Candy Machine with pNFT token standard.
  const umi = await createUmi();
  const collectionUpdateAuthority = generateSigner(umi);
  const collection = await createCollectionNft(umi, {
    authority: collectionUpdateAuthority,
  });
  const candyMachine = await createV2(umi, {
    collectionMint: collection.publicKey,
    collectionUpdateAuthority,
    tokenStandard: TokenStandard.ProgrammableNonFungible,
  });

  // Then the Candy Machine's token standard is pNFT.
  let candyMachineAccount = await fetchCandyMachine(
    umi,
    candyMachine.publicKey
  );

  t.like(candyMachineAccount, <CandyMachine>{
    tokenStandard: TokenStandard.ProgrammableNonFungible,
    version: AccountVersion.V2,
  });

  // When we update its token standard to NFT
  await transactionBuilder()
    .add(
      setTokenStandard(umi, {
        candyMachine: candyMachine.publicKey,
        collectionMint: collection.publicKey,
        collectionUpdateAuthority,
        tokenStandard: TokenStandard.NonFungible,
      })
    )
    .sendAndConfirm(umi);

  // Then the Candy Machine's token standard is NFT.
  candyMachineAccount = await fetchCandyMachine(umi, candyMachine.publicKey);

  t.like(candyMachineAccount, <CandyMachine>{
    tokenStandard: TokenStandard.NonFungible,
    version: AccountVersion.V2,
  });
});

test('it can change token standard from NFT to pNFT and then back to NFT', async (t) => {
  // Given a Candy Machine with NFT token standard.
  const umi = await createUmi();
  const collectionUpdateAuthority = generateSigner(umi);
  const collection = await createCollectionNft(umi, {
    authority: collectionUpdateAuthority,
  });
  const candyMachine = await createV1(umi, {
    collectionMint: collection.publicKey,
    collectionUpdateAuthority,
  });

  // Then the Candy Machine's token standard is NFT.
  let candyMachineAccount = await fetchCandyMachine(
    umi,
    candyMachine.publicKey
  );

  t.like(candyMachineAccount, <CandyMachine>{
    tokenStandard: TokenStandard.NonFungible,
    version: AccountVersion.V1,
  });

  // When we update its token standard to pNFT
  await transactionBuilder()
    .add(
      setTokenStandard(umi, {
        candyMachine: candyMachine.publicKey,
        collectionMint: collection.publicKey,
        collectionUpdateAuthority,
        collectionAuthorityRecord: findCollectionAuthorityRecordPda(umi, {
          mint: collection.publicKey,
          collectionAuthority: findCandyMachineAuthorityPda(umi, {
            candyMachine: candyMachine.publicKey,
          })[0],
        }),
        tokenStandard: TokenStandard.ProgrammableNonFungible,
      })
    )
    .sendAndConfirm(umi);

  // Then the Candy Machine's token standard is pNFT.
  candyMachineAccount = await fetchCandyMachine(umi, candyMachine.publicKey);

  t.like(candyMachineAccount, <CandyMachine>{
    tokenStandard: TokenStandard.ProgrammableNonFungible,
    version: AccountVersion.V2,
  });

  // When we update its token standard to NFT
  await transactionBuilder()
    .add(
      setTokenStandard(umi, {
        candyMachine: candyMachine.publicKey,
        collectionMint: collection.publicKey,
        collectionUpdateAuthority,
        tokenStandard: TokenStandard.NonFungible,
      })
    )
    .sendAndConfirm(umi);

  // Then the Candy Machine's token standard is NFT.
  candyMachineAccount = await fetchCandyMachine(umi, candyMachine.publicKey);

  t.like(candyMachineAccount, <CandyMachine>{
    tokenStandard: TokenStandard.NonFungible,
    version: AccountVersion.V2,
  });
});
