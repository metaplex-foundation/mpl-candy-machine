import {
  generateSigner,
  publicKey,
  transactionBuilder,
} from '@metaplex-foundation/umi';
import test from 'ava';
import {
  CandyGuard,
  createCandyGuard,
  fetchCandyGuard,
  findCandyGuardPda,
  emptyDefaultGuardSetArgs,
  GuardGroup,
  GuardSet,
} from '../src';
import { createUmi } from './_setup';

test('it can create a candy guard without guards', async (t) => {
  // Given a base address.
  const umi = await createUmi();
  const base = generateSigner(umi);

  // When we create a new candy guard without guards.
  await transactionBuilder(umi)
    .add(createCandyGuard(umi, { base }))
    .sendAndConfirm();

  // Then a new candy guard account was created with the expected data.
  const candyGuard = findCandyGuardPda(umi, { base: base.publicKey });
  const candyGuardAccount = await fetchCandyGuard(umi, candyGuard);
  t.like(candyGuardAccount, <CandyGuard>{
    publicKey: publicKey(candyGuard),
    base: publicKey(base),
    authority: publicKey(umi.identity),
    guards: emptyDefaultGuardSetArgs,
    groups: [] as GuardGroup<GuardSet>[],
  });
});
