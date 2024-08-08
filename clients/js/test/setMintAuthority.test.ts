import {
  generateSigner,
  publicKey,
  transactionBuilder,
} from '@metaplex-foundation/umi';
import test from 'ava';
import { fetchGumballMachine, GumballMachine, setMintAuthority } from '../src';
import { create, createUmi } from './_setup';

test('it can update the mint authority of a gumball machine v2', async (t) => {
  // Given an Gumball Machine with a mint authority equal to its authority A.
  const umi = await createUmi();
  const authorityA = generateSigner(umi);
  const gumballMachine = await create(umi, {
    authority: authorityA.publicKey,
  });
  const { mintAuthority: mintAuthorityA } = await fetchGumballMachine(
    umi,
    gumballMachine.publicKey
  );
  t.deepEqual(mintAuthorityA, authorityA.publicKey);

  // When we update its mint authority.
  const mintAuthorityB = generateSigner(umi);
  await transactionBuilder()
    .add(
      setMintAuthority(umi, {
        gumballMachine: gumballMachine.publicKey,
        authority: authorityA,
        mintAuthority: mintAuthorityB,
      })
    )
    .sendAndConfirm(umi);

  // Then the Gumball Machine's mint authority was updated accordingly.
  const gumballMachineAccount = await fetchGumballMachine(
    umi,
    gumballMachine.publicKey
  );
  t.like(gumballMachineAccount, <GumballMachine>{
    authority: publicKey(authorityA.publicKey),
    mintAuthority: publicKey(mintAuthorityB.publicKey),
  });
});
