import { createAccountWithRent } from '@metaplex-foundation/mpl-toolbox';
import { TokenStandard } from '@metaplex-foundation/mpl-token-metadata';
import {
  generateSigner,
  none,
  percentAmount,
  publicKey,
  some,
  transactionBuilder,
} from '@metaplex-foundation/umi';
import test from 'ava';
import {
  CandyMachine,
  Creator,
  fetchCandyMachine,
  initializeCandyMachineV2,
} from '../src';
import { createCollectionNft, createUmi } from './_setup';

/**
 * Note that most of the tests for the "initializeCandyMachineV2" instructions are
 * part of the "createCandyMachineV2" tests as they are more convenient to test.
 */

test('it can initialize a new candy machine account', async (t) => {
  // Given an empty candy machine account with a big enough size.
  const umi = await createUmi();
  const candyMachine = generateSigner(umi);
  await transactionBuilder()
    .add(
      createAccountWithRent(umi, {
        newAccount: candyMachine,
        space: 5000,
        programId: umi.programs.get('mplCandyMachineCore').publicKey,
      })
    )
    .sendAndConfirm(umi);

  // When we initialize a candy machine at this address.
  await transactionBuilder()
    .add(
      initializeCandyMachineV2(umi, {
        candyMachine: candyMachine.publicKey,
        itemCapacity: 20,
      })
    )
    .sendAndConfirm(umi);

  // Then we expect the candy machine account to have the right data.
  const candyMachineAccount = await fetchCandyMachine(
    umi,
    candyMachine.publicKey
  );
  t.like(candyMachineAccount, <CandyMachine>{
    publicKey: publicKey(candyMachine),
    authority: publicKey(umi.identity),
    mintAuthority: publicKey(umi.identity),
    version: 0,
    itemsRedeemed: 0n,
    itemsAvailable: 20n,
  });
});
