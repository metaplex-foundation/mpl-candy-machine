import {
  generateSigner,
  publicKey,
  transactionBuilder,
} from '@metaplex-foundation/umi';
import test from 'ava';
import {
  CandyMachine,
  fetchCandyMachine,
  setCandyMachineAuthority,
} from '../src';
import { createCandyMachine, createUmi } from './_setup';

test('it can update the authority of a candy machine', async (t) => {
  // Given a Candy Machine using authority A.
  const umi = await createUmi();
  const authorityA = generateSigner(umi);
  const candyMachine = await createCandyMachine(umi, {
    authority: authorityA.publicKey,
  });

  // When we update it to use authority B.
  const authorityB = generateSigner(umi);
  await transactionBuilder(umi)
    .add(
      setCandyMachineAuthority(umi, {
        candyMachine: candyMachine.publicKey,
        authority: authorityA,
        newAuthority: authorityB.publicKey,
      })
    )
    .sendAndConfirm();

  // Then the Candy Machine's authority was updated accordingly.
  const candyMachineAccount = await fetchCandyMachine(
    umi,
    candyMachine.publicKey
  );
  t.like(candyMachineAccount, <CandyMachine>{
    authority: publicKey(authorityB.publicKey),
  });
});
