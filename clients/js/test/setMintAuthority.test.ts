import {
  generateSigner,
  publicKey,
  transactionBuilder,
} from '@metaplex-foundation/umi';
import test from 'ava';
import { CandyMachine, fetchCandyMachine, setMintAuthority } from '../src';
import { createV1, createUmi, createV2 } from './_setup';

test('it can update the mint authority of a candy machine v1', async (t) => {
  // Given an Candy Machine with a mint authority equal to its authority A.
  const umi = await createUmi();
  const authorityA = generateSigner(umi);
  const candyMachine = await createV1(umi, {
    authority: authorityA.publicKey,
  });
  const { mintAuthority: mintAuthorityA } = await fetchCandyMachine(
    umi,
    candyMachine.publicKey
  );
  t.deepEqual(mintAuthorityA, authorityA.publicKey);

  // When we update its mint authority.
  const mintAuthorityB = generateSigner(umi);
  await transactionBuilder()
    .add(
      setMintAuthority(umi, {
        candyMachine: candyMachine.publicKey,
        authority: authorityA,
        mintAuthority: mintAuthorityB,
      })
    )
    .sendAndConfirm(umi);

  // Then the Candy Machine's mint authority was updated accordingly.
  const candyMachineAccount = await fetchCandyMachine(
    umi,
    candyMachine.publicKey
  );
  t.like(candyMachineAccount, <CandyMachine>{
    authority: publicKey(authorityA.publicKey),
    mintAuthority: publicKey(mintAuthorityB.publicKey),
  });
});

test('it can update the mint authority of a candy machine v2', async (t) => {
  // Given an Candy Machine with a mint authority equal to its authority A.
  const umi = await createUmi();
  const authorityA = generateSigner(umi);
  const candyMachine = await createV2(umi, {
    authority: authorityA.publicKey,
  });
  const { mintAuthority: mintAuthorityA } = await fetchCandyMachine(
    umi,
    candyMachine.publicKey
  );
  t.deepEqual(mintAuthorityA, authorityA.publicKey);

  // When we update its mint authority.
  const mintAuthorityB = generateSigner(umi);
  await transactionBuilder()
    .add(
      setMintAuthority(umi, {
        candyMachine: candyMachine.publicKey,
        authority: authorityA,
        mintAuthority: mintAuthorityB,
      })
    )
    .sendAndConfirm(umi);

  // Then the Candy Machine's mint authority was updated accordingly.
  const candyMachineAccount = await fetchCandyMachine(
    umi,
    candyMachine.publicKey
  );
  t.like(candyMachineAccount, <CandyMachine>{
    authority: publicKey(authorityA.publicKey),
    mintAuthority: publicKey(mintAuthorityB.publicKey),
  });
});
