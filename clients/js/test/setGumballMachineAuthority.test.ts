import {
  generateSigner,
  publicKey,
  transactionBuilder,
} from '@metaplex-foundation/umi';
import test from 'ava';
import {
  fetchGumballMachine,
  GumballMachine,
  setGumballMachineAuthority,
} from '../src';
import { create, createUmi } from './_setup';

test('it can update the authority of a gumball machine v2', async (t) => {
  // Given a Gumball Machine using authority A.
  const umi = await createUmi();
  const authorityA = generateSigner(umi);
  const gumballMachine = await create(umi, {
    authority: authorityA.publicKey,
  });

  // When we update it to use authority B.
  const authorityB = generateSigner(umi);
  await transactionBuilder()
    .add(
      setGumballMachineAuthority(umi, {
        gumballMachine: gumballMachine.publicKey,
        authority: authorityA,
        newAuthority: authorityB.publicKey,
      })
    )
    .sendAndConfirm(umi);

  // Then the Gumball Machine's authority was updated accordingly.
  const gumballMachineAccount = await fetchGumballMachine(
    umi,
    gumballMachine.publicKey
  );
  t.like(gumballMachineAccount, <GumballMachine>{
    authority: publicKey(authorityB.publicKey),
  });
});
