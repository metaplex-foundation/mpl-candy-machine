import { generateSigner, transactionBuilder } from '@metaplex-foundation/umi';
import test from 'ava';
import { TokenStandard } from '@metaplex-foundation/mpl-token-metadata';
import {
  AccountVersion,
  CandyMachine,
  fetchCandyMachine,
  setTokenStandard,
} from '../src';
import { createCollectionNft, createUmi, createV2 } from './_setup';

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
