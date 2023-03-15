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
import { createV1, createV2, createUmi } from './_setup';

test('it can update the authority of a candy machine v1', async (t) => {
  // Given a Candy Machine using authority A.
  const umi = await createUmi();
  const authorityA = generateSigner(umi);
  const candyMachine = await createV1(umi, {
    authority: authorityA.publicKey,
  });

  // When we update it to use authority B.
  const authorityB = generateSigner(umi);
  await transactionBuilder()
    .add(
      setCandyMachineAuthority(umi, {
        candyMachine: candyMachine.publicKey,
        authority: authorityA,
        newAuthority: authorityB.publicKey,
      })
    )
    .sendAndConfirm(umi);

  // Then the Candy Machine's authority was updated accordingly.
  const candyMachineAccount = await fetchCandyMachine(
    umi,
    candyMachine.publicKey
  );
  t.like(candyMachineAccount, <CandyMachine>{
    authority: publicKey(authorityB.publicKey),
  });
});

test('it can update the authority of a candy machine v2', async (t) => {
  // Given a Candy Machine using authority A.
  const umi = await createUmi();
  const authorityA = generateSigner(umi);
  const candyMachine = await createV2(umi, {
    authority: authorityA.publicKey,
  });

  // When we update it to use authority B.
  const authorityB = generateSigner(umi);
  await transactionBuilder()
    .add(
      setCandyMachineAuthority(umi, {
        candyMachine: candyMachine.publicKey,
        authority: authorityA,
        newAuthority: authorityB.publicKey,
      })
    )
    .sendAndConfirm(umi);

  // Then the Candy Machine's authority was updated accordingly.
  const candyMachineAccount = await fetchCandyMachine(
    umi,
    candyMachine.publicKey
  );
  t.like(candyMachineAccount, <CandyMachine>{
    authority: publicKey(authorityB.publicKey),
  });
});
