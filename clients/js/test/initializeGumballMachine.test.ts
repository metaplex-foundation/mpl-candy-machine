import { createAccountWithRent } from '@metaplex-foundation/mpl-toolbox';
import {
  generateSigner,
  none,
  publicKey,
  transactionBuilder,
} from '@metaplex-foundation/umi';
import test from 'ava';
import {
  fetchGumballMachine,
  GumballMachine,
  GumballSettings,
  GumballState,
  initializeGumballMachine,
} from '../src';
import { createUmi, defaultGumballSettings } from './_setup';

/**
 * Note that most of the tests for the "initializeGumballMachine" instructions are
 * part of the "createGumballMachine" tests as they are more convenient to test.
 */

test('it can initialize a new gumball machine account', async (t) => {
  // Given an empty gumball machine account with a big enough size.
  const umi = await createUmi();
  const gumballMachine = generateSigner(umi);
  await transactionBuilder()
    .add(
      createAccountWithRent(umi, {
        newAccount: gumballMachine,
        space: 5000,
        programId: umi.programs.get('mallowGumball').publicKey,
      })
    )
    .sendAndConfirm(umi);

  const settings: GumballSettings = {
    ...defaultGumballSettings(),
    uri: 'https://arweave.net/abc123',
    itemCapacity: 20n,
    itemsPerSeller: 1,
    sellersMerkleRoot: none(),
    curatorFeeBps: 500,
    hideSoldItems: false,
  };
  // When we initialize a gumball machine at this address.
  await transactionBuilder()
    .add(
      initializeGumballMachine(umi, {
        gumballMachine: gumballMachine.publicKey,
        settings,
        feeConfig: {
          feeAccount: publicKey(umi.identity),
          feeBps: 500,
        },
      })
    )
    .sendAndConfirm(umi);

  // Then we expect the gumball machine account to have the right data.
  const gumballMachineAccount = await fetchGumballMachine(
    umi,
    gumballMachine.publicKey
  );
  t.like(gumballMachineAccount, <GumballMachine>{
    publicKey: publicKey(gumballMachine),
    authority: publicKey(umi.identity),
    mintAuthority: publicKey(umi.identity),
    version: 0,
    itemsRedeemed: 0n,
    itemsLoaded: 0,
    state: GumballState.None,
    settings,
  });
});
