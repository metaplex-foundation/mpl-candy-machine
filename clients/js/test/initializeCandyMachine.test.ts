import { createAccountWithRent } from '@metaplex-foundation/mpl-essentials';
import { generateSigner, transactionBuilder } from '@metaplex-foundation/umi';
import test from 'ava';
import { initializeCandyMachine } from '../src';
import { createUmi } from './_setup';

/**
 * Note that most of the tests for the "initializeCandyMachine" instructions are
 * part of the "createCandyMachine" tests as they are more convenient to test.
 */

test('it can initialize a new candy machine account', async (t) => {
  // Given an empty candy machine account.
  const umi = await createUmi();
  const candyMachine = generateSigner(umi);
  await transactionBuilder(umi)
    .add(
      createAccountWithRent(umi, {
        newAccount: candyMachine,
        space: 1000,
        programId: umi.programs.get('mplCandyMachineCore').publicKey,
      })
    )
    .sendAndConfirm();

  // When
  await transactionBuilder(umi)
    .add(
      initializeCandyMachine(umi, {
        candyMachine: candyMachine.publicKey,
        data: {},
      } as any)
    )
    .sendAndConfirm();

  // Then
  t.pass();
});
