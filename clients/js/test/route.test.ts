import {
  base58PublicKey,
  generateSigner,
  some,
  transactionBuilder,
} from '@metaplex-foundation/umi';
import test from 'ava';
import {
  findAllowListProofPda,
  findCandyGuardPda,
  getMerkleProof,
  getMerkleRoot,
  route,
} from '../src';
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

  // When we call the route instruction of the allow list guard.
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

  // Then the allow list proof PDA was created.
  const allowListProofPda = findAllowListProofPda(umi, {
    merkleRoot,
    user: minter.publicKey,
    candyMachine,
    candyGuard: findCandyGuardPda(umi, { base: candyMachine }),
  });
  t.true(await umi.rpc.accountExists(allowListProofPda));
});

test('it can call the route instruction of a specific guard on a group', async (t) => {
  // Given a Candy Machine with two allowList guards which supports the route instruction.
  const umi = await createUmi();
  const allowedWalletsA = [
    base58PublicKey(umi.identity),
    'Ur1CbWSGsXCdedknRbJsEk7urwAvu1uddmQv51nAnXB',
  ];
  const allowedWalletsB = [
    'GjwcWFQYzemBtpUoN5fMAP2FZviTtMRWCmrppGuTthJS',
    '2vjCrmEFiN9CLLhiqy8u1JPh48av8Zpzp3kNkdTtirYG',
  ];
  const merkleRootA = getMerkleRoot(allowedWalletsA);
  const merkleRootB = getMerkleRoot(allowedWalletsB);
  const { publicKey: candyMachine } = await createV2(umi, {
    groups: [
      {
        label: 'GROUP1',
        guards: { allowList: some({ merkleRoot: merkleRootA }) },
      },
      {
        label: 'GROUP2',
        guards: { allowList: some({ merkleRoot: merkleRootB }) },
      },
    ],
  });

  // When we call the "proof" route of the guard in group 1.
  const merkleProofA = getMerkleProof(
    allowedWalletsA,
    base58PublicKey(umi.identity)
  );
  await transactionBuilder(umi)
    .add(
      route(umi, {
        candyMachine,
        guard: 'allowList',
        group: some('GROUP1'),
        routeArgs: {
          path: 'proof',
          merkleRoot: merkleRootA,
          merkleProof: merkleProofA,
        },
      })
    )
    .sendAndConfirm();

  // Then the allow list proof PDA was created for group 1.
  const allowListProofPdaA = findAllowListProofPda(umi, {
    merkleRoot: merkleRootA,
    user: umi.identity.publicKey,
    candyMachine,
    candyGuard: findCandyGuardPda(umi, { base: candyMachine }),
  });
  t.true(await umi.rpc.accountExists(allowListProofPdaA));

  // But not for group 2.
  const allowListProofPdaB = findAllowListProofPda(umi, {
    merkleRoot: merkleRootB,
    user: umi.identity.publicKey,
    candyMachine,
    candyGuard: findCandyGuardPda(umi, { base: candyMachine }),
  });
  t.false(await umi.rpc.accountExists(allowListProofPdaB));
});

// Tests from JS SDK
// Test using CM v1
