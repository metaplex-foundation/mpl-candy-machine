import {
  base58PublicKey,
  generateSigner,
  some,
  transactionBuilder,
} from '@metaplex-foundation/umi';
import test from 'ava';
import { getMerkleProof, getMerkleRoot, route } from '../src';
import { createUmi, createV2 } from './_setup';

test('it can call the route instruction of a specific guard', async (t) => {
  // Given a candy machine with an allow list guard.
  const umi = await createUmi();
  const minter = generateSigner(umi);
  const allowedWallets = [
    base58PublicKey(minter),
    'Ur1CbWSGsXCdedknRbJsEk7urwAvu1uddmQv51nAnXB',
    'GjwcWFQYzemBtpUoN5fMAP2FZviTtMRWCmrppGuTthJS',
    '2vjCrmEFiN9CLLhiqy8u1JPh48av8Zpzp3kNkdTtirYG',
  ];
  const merkleRoot = getMerkleRoot(allowedWallets);
  const { publicKey: candyMachine } = await createV2(umi, {
    guards: { allowList: some({ merkleRoot }) },
  });

  // When
  const merkleProof = getMerkleProof(allowedWallets, base58PublicKey(minter));
  await transactionBuilder(umi)
    .add(
      route(umi, {
        candyMachine,
        guard: 'allowList',
        routeArgs: { path: 'proof', merkleRoot, merkleProof, minter },
      })
    )
    .sendAndConfirm();

  // Then
  t.pass();
});

// Tests from JS SDK
// Test using CM v1
