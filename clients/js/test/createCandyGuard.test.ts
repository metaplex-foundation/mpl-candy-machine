import {
  generateSigner,
  publicKey,
  transactionBuilder,
} from '@metaplex-foundation/umi';
import test from 'ava';
import { CandyGuard, fetchCandyGuard, findCandyGuardPda } from '../src';
import { createUmi } from './_setup';
import { createCandyGuard as baseCreateCandyGuard } from '../src/generated/instructions/createCandyGuard';

test('it can create a candy guard without guards', async (t) => {
  // Given ...
  const umi = await createUmi();
  const base = generateSigner(umi);

  // When
  await transactionBuilder(umi)
    .add(baseCreateCandyGuard(umi, { base, data: new Uint8Array(12) }))
    .sendAndConfirm();

  // When
  // await transactionBuilder(umi)
  //   .add(createCandyGuard(umi, { base }))
  //   .sendAndConfirm();

  // Then
  const candyGuard = findCandyGuardPda(umi, { base: base.publicKey });
  const candyGuardAccount = await fetchCandyGuard(umi, candyGuard);
  console.log(candyGuardAccount);
  t.like(candyGuardAccount, <CandyGuard>{
    publicKey: publicKey(candyGuard),
  });
});
