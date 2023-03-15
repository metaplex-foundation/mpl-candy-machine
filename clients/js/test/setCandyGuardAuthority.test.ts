import {
  generateSigner,
  publicKey,
  transactionBuilder,
} from '@metaplex-foundation/umi';
import test from 'ava';
import { CandyGuard, fetchCandyGuard, setCandyGuardAuthority } from '../src';
import { createCandyGuard, createUmi } from './_setup';

test('it can update the authority of a candy guard', async (t) => {
  // Given a Candy Machine using authority A.
  const umi = await createUmi();
  const authorityA = generateSigner(umi);
  const candyGuard = await createCandyGuard(umi, {
    authority: authorityA.publicKey,
  });

  // When we update it to use authority B.
  const authorityB = generateSigner(umi);
  await transactionBuilder()
    .add(
      setCandyGuardAuthority(umi, {
        candyGuard,
        authority: authorityA,
        newAuthority: authorityB.publicKey,
      })
    )
    .sendAndConfirm(umi);

  // Then the Candy Guard's authority was updated accordingly.
  const candyGuardAccount = await fetchCandyGuard(umi, candyGuard);
  t.like(candyGuardAccount, <CandyGuard>{
    authority: publicKey(authorityB.publicKey),
  });
});
