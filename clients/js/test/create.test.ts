import {
  generateSigner,
  publicKey,
  sol,
  some,
  transactionBuilder,
} from '@metaplex-foundation/umi';
import test from 'ava';
import {
  create,
  emptyDefaultGuardSetArgs,
  fetchGumballGuard,
  fetchGumballMachine,
  findGumballGuardPda,
  GuardGroup,
  GuardSet,
  GumballGuard,
  GumballMachine,
} from '../src';
import { createUmi, defaultGumballSettings } from './_setup';

test('it can create a gumball machine with an associated gumball guard', async (t) => {
  // Given an existing collection NFT.
  const umi = await createUmi();

  // When we create a new gumball machine with an associated gumball guard.
  const feeAccount = generateSigner(umi).publicKey;
  const gumballMachine = generateSigner(umi);
  const createInstructions = await create(umi, {
    gumballMachine,
    feeConfig: some({
      feeAccount,
      feeBps: 500,
    }),
    guards: {
      botTax: some({ lamports: sol(0.01), lastInstruction: true }),
      solPayment: some({ lamports: sol(2) }),
    },
    settings: defaultGumballSettings(),
  });
  await transactionBuilder().add(createInstructions).sendAndConfirm(umi);

  // Then we created a new gumball guard derived from the gumball machine's address.
  const gumballGuard = findGumballGuardPda(umi, {
    base: gumballMachine.publicKey,
  });
  const gumballGuardAccount = await fetchGumballGuard(umi, gumballGuard);
  t.like(gumballGuardAccount, <GumballGuard>{
    publicKey: publicKey(gumballGuard),
    base: publicKey(gumballMachine),
    authority: publicKey(umi.identity),
    guards: {
      ...emptyDefaultGuardSetArgs,
      botTax: some({ lamports: sol(0.01), lastInstruction: true }),
      solPayment: some({ lamports: sol(2) }),
    },
    groups: [] as GuardGroup<GuardSet>[],
  });

  // And the created gumball machine uses it as a mint authority.
  const gumballMachineAccount = await fetchGumballMachine(
    umi,
    gumballMachine.publicKey
  );
  t.like(gumballMachineAccount, <GumballMachine>{
    publicKey: publicKey(gumballMachine),
    authority: publicKey(umi.identity),
    mintAuthority: publicKey(gumballGuard),
    marketplaceFeeConfig: some({
      feeAccount,
      feeBps: 500,
    }),
  });
});
