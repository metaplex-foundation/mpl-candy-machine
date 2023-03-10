import { transactionBuilder } from '@metaplex-foundation/umi';
import test from 'ava';
import { route } from '../src';
import { createUmi, createV2 } from './_setup';

test('it can call the route instruction of a specific guard', async (t) => {
  // Given a candy machine with an allow list guard.
  const umi = await createUmi();
  const { publicKey: candyMachine } = await createV2(umi, {
    //
  });

  // When
  await transactionBuilder(umi)
    .add(
      route(umi, {
        candyMachine,
        guard: 'allowList',
        routeArgs: {
          path: 'proof',
          merkleRoot: 'root',
          merkleProof: 'proof',
        },
      })
    )
    .sendAndConfirm();

  // Then
});

// Tests from JS SDK
// Test using CM v1
