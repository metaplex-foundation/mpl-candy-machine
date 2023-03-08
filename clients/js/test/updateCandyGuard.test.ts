import { publicKey, transactionBuilder } from '@metaplex-foundation/umi';
import test from 'ava';
import { CandyGuard, fetchCandyGuard } from '../src';
import { createCandyGuard, createUmi } from './_setup';

test('it can update the guards of a candy guard', async (t) => {
  // Given
  const umi = await createUmi();
  const candyGuard = await createCandyGuard(umi);

  // When
  await transactionBuilder(umi).sendAndConfirm();

  // Then
  const candyGuardAccount = await fetchCandyGuard(umi, candyGuard);
  t.like(candyGuardAccount, <CandyGuard>{
    authority: publicKey(umi.identity),
  });
});
