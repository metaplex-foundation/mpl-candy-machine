import {
  generateSigner,
  publicKey,
  transactionBuilder,
} from '@metaplex-foundation/umi';
import test from 'ava';
import {
  fetchGumballGuard,
  GumballGuard,
  setGumballGuardAuthority,
} from '../src';
import { createGumballGuard, createUmi } from './_setup';

test('it can update the authority of a gumball guard', async (t) => {
  // Given a Gumball Machine using authority A.
  const umi = await createUmi();
  const authorityA = generateSigner(umi);
  const gumballGuard = await createGumballGuard(umi, {
    authority: authorityA.publicKey,
  });

  // When we update it to use authority B.
  const authorityB = generateSigner(umi);
  await transactionBuilder()
    .add(
      setGumballGuardAuthority(umi, {
        gumballGuard,
        authority: authorityA,
        newAuthority: authorityB.publicKey,
      })
    )
    .sendAndConfirm(umi);

  // Then the Gumball Guard's authority was updated accordingly.
  const gumballGuardAccount = await fetchGumballGuard(umi, gumballGuard);
  t.like(gumballGuardAccount, <GumballGuard>{
    authority: publicKey(authorityB.publicKey),
  });
});
