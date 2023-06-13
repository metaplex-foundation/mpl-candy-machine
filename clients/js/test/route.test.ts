import {
  generateSigner,
  none,
  sol,
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
import { createUmi, createV1, createV2 } from './_setup';

test('it can call the route instruction of a specific guard', async (t) => {
  // Given a candy machine with an allow list guard.
  const umi = await createUmi();
  const minter = generateSigner(umi).publicKey;
  const allowedWallets = [
    minter,
    'Ur1CbWSGsXCdedknRbJsEk7urwAvu1uddmQv51nAnXB',
    'GjwcWFQYzemBtpUoN5fMAP2FZviTtMRWCmrppGuTthJS',
    '2vjCrmEFiN9CLLhiqy8u1JPh48av8Zpzp3kNkdTtirYG',
  ];
  const merkleRoot = getMerkleRoot(allowedWallets);
  const { publicKey: candyMachine } = await createV2(umi, {
    guards: { allowList: some({ merkleRoot }) },
  });

  // When we call the route instruction of the allow list guard.
  const merkleProof = getMerkleProof(allowedWallets, minter);
  await transactionBuilder()
    .add(
      route(umi, {
        candyMachine,
        guard: 'allowList',
        routeArgs: { path: 'proof', merkleRoot, merkleProof, minter },
      })
    )
    .sendAndConfirm(umi);

  // Then the allow list proof PDA was created.
  const [allowListProofPda] = findAllowListProofPda(umi, {
    merkleRoot,
    user: minter,
    candyMachine,
    candyGuard: findCandyGuardPda(umi, { base: candyMachine })[0],
  });
  t.true(await umi.rpc.accountExists(allowListProofPda));
});

test('it can call the route instruction of a specific guard on a group', async (t) => {
  // Given a Candy Machine with two allowList guards which supports the route instruction.
  const umi = await createUmi();
  const allowedWalletsA = [
    umi.identity.publicKey,
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
  const merkleProofA = getMerkleProof(allowedWalletsA, umi.identity.publicKey);
  await transactionBuilder()
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
    .sendAndConfirm(umi);

  // Then the allow list proof PDA was created for group 1.
  const [allowListProofPdaA] = findAllowListProofPda(umi, {
    merkleRoot: merkleRootA,
    user: umi.identity.publicKey,
    candyMachine,
    candyGuard: findCandyGuardPda(umi, { base: candyMachine })[0],
  });
  t.true(await umi.rpc.accountExists(allowListProofPdaA));

  // But not for group 2.
  const [allowListProofPdaB] = findAllowListProofPda(umi, {
    merkleRoot: merkleRootB,
    user: umi.identity.publicKey,
    candyMachine,
    candyGuard: findCandyGuardPda(umi, { base: candyMachine })[0],
  });
  t.false(await umi.rpc.accountExists(allowListProofPdaB));
});

test('it cannot call the route instruction of a guard that does not support it', async (t) => {
  // Given a candy machine with an bot tax guard which does not support the route instruction.
  const umi = await createUmi();
  const { publicKey: candyMachine } = await createV2(umi, {
    guards: { botTax: some({ lamports: sol(0.01), lastInstruction: true }) },
  });

  // When we try to call the route instruction of the bot tax guard.
  const promise = transactionBuilder()
    .add(route(umi, { candyMachine, guard: 'botTax', routeArgs: {} }))
    .sendAndConfirm(umi);

  // Then we expect a program error.
  await t.throwsAsync(promise, { message: /InstructionNotFound/ });
});

test('it must provide a group label if the candy guard has groups', async (t) => {
  // Given a candy machine with an allow list guard in a group.
  const umi = await createUmi();
  const allowedWallets = [umi.identity.publicKey];
  const merkleRoot = getMerkleRoot(allowedWallets);
  const { publicKey: candyMachine } = await createV2(umi, {
    groups: [{ label: 'GROUP1', guards: { allowList: some({ merkleRoot }) } }],
  });

  // When we try to call the route instruction without a group label.
  const merkleProof = getMerkleProof(allowedWallets, allowedWallets[0]);
  const promise = transactionBuilder()
    .add(
      route(umi, {
        candyMachine,
        guard: 'allowList',
        group: none(),
        routeArgs: { path: 'proof', merkleRoot, merkleProof },
      })
    )
    .sendAndConfirm(umi);

  // Then we expect a program error.
  await t.throwsAsync(promise, { message: /RequiredGroupLabelNotFound/ });
});

test('it must not provide a group label if the candy guard does not have groups', async (t) => {
  // Given a candy machine with an allow list guard and no groups.
  const umi = await createUmi();
  const allowedWallets = [umi.identity.publicKey];
  const merkleRoot = getMerkleRoot(allowedWallets);
  const { publicKey: candyMachine } = await createV2(umi, {
    guards: { allowList: some({ merkleRoot }) },
  });

  // When we try to call the route instruction with a group label.
  const merkleProof = getMerkleProof(allowedWallets, allowedWallets[0]);
  const promise = transactionBuilder()
    .add(
      route(umi, {
        candyMachine,
        guard: 'allowList',
        group: some('GROUPX'),
        routeArgs: { path: 'proof', merkleRoot, merkleProof },
      })
    )
    .sendAndConfirm(umi);

  // Then we expect a program error.
  await t.throwsAsync(promise, { message: /GroupNotFound/ });
});

test('it can call the route instruction for guards associated with a candy machine v1', async (t) => {
  // Given a candy machine with an allow list guard.
  const umi = await createUmi();
  const allowedWallets = [
    umi.identity.publicKey,
    'Ur1CbWSGsXCdedknRbJsEk7urwAvu1uddmQv51nAnXB',
  ];
  const merkleRoot = getMerkleRoot(allowedWallets);
  const { publicKey: candyMachine } = await createV1(umi, {
    guards: { allowList: some({ merkleRoot }) },
  });

  // When we call the route instruction of the allow list guard.
  const merkleProof = getMerkleProof(allowedWallets, umi.identity.publicKey);
  await transactionBuilder()
    .add(
      route(umi, {
        candyMachine,
        guard: 'allowList',
        routeArgs: { path: 'proof', merkleRoot, merkleProof },
      })
    )
    .sendAndConfirm(umi);

  // Then the allow list proof PDA was created.
  const [allowListProofPda] = findAllowListProofPda(umi, {
    merkleRoot,
    user: umi.identity.publicKey,
    candyMachine,
    candyGuard: findCandyGuardPda(umi, { base: candyMachine })[0],
  });
  t.true(await umi.rpc.accountExists(allowListProofPda));
});
