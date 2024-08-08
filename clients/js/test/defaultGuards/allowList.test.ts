import { setComputeUnitLimit } from '@metaplex-foundation/mpl-toolbox';
import {
  base58PublicKey,
  generateSigner,
  publicKey,
  sol,
  some,
  transactionBuilder,
} from '@metaplex-foundation/umi';
import test from 'ava';
import {
  draw,
  findAllowListProofPda,
  findGumballGuardPda,
  getMerkleProof,
  getMerkleRoot,
  route,
  TokenStandard,
} from '../../src';
import {
  assertBotTax,
  assertItemBought,
  create,
  createNft,
  createUmi,
} from '../_setup';

test('it allows minting from wallets of a predefined list', async (t) => {
  // Given the identity is part of an allow list.
  const umi = await createUmi();
  const allowList = [
    base58PublicKey(umi.identity),
    'Ur1CbWSGsXCdedknRbJsEk7urwAvu1uddmQv51nAnXB',
    'GjwcWFQYzemBtpUoN5fMAP2FZviTtMRWCmrppGuTthJS',
    '2vjCrmEFiN9CLLhiqy8u1JPh48av8Zpzp3kNkdTtirYG',
    'AT8nPwujHAD14cLojTcB1qdBzA1VXnT6LVGuUd6Y73Cy',
  ];
  const merkleRoot = getMerkleRoot(allowList);

  // And given a loaded Gumball Machine with the allow list guard.

  const { publicKey: gumballMachine } = await create(umi, {
    items: [
      {
        id: (await createNft(umi)).publicKey,
        tokenStandard: TokenStandard.NonFungible,
      },
    ],
    startSale: true,
    guards: {
      allowList: some({ merkleRoot }),
    },
  });

  // When we verify the payer first by providing a valid merkle proof.
  await transactionBuilder()
    .add(
      route(umi, {
        gumballMachine,
        guard: 'allowList',
        routeArgs: {
          path: 'proof',
          merkleRoot,
          merkleProof: getMerkleProof(allowList, base58PublicKey(umi.identity)),
        },
      })
    )
    .sendAndConfirm(umi);

  // And then mint from the Gumball Machine using the identity.

  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      draw(umi, {
        gumballMachine,

        mintArgs: { allowList: some({ merkleRoot }) },
      })
    )
    .sendAndConfirm(umi);

  // Then minting was successful.
  await assertItemBought(t, umi, { gumballMachine });
});

test('it is possible to verify the proof and mint in the same transaction if there is space', async (t) => {
  // Given the identity is part of an allow list.
  const umi = await createUmi();
  const allowList = [
    publicKey(umi.identity),
    'Ur1CbWSGsXCdedknRbJsEk7urwAvu1uddmQv51nAnXB',
    'GjwcWFQYzemBtpUoN5fMAP2FZviTtMRWCmrppGuTthJS',
    '2vjCrmEFiN9CLLhiqy8u1JPh48av8Zpzp3kNkdTtirYG',
    'AT8nPwujHAD14cLojTcB1qdBzA1VXnT6LVGuUd6Y73Cy',
  ];
  const merkleRoot = getMerkleRoot(allowList);

  // And given a loaded Gumball Machine with the allow list guard.

  const { publicKey: gumballMachine } = await create(umi, {
    items: [
      {
        id: (await createNft(umi)).publicKey,
        tokenStandard: TokenStandard.NonFungible,
      },
    ],
    startSale: true,
    guards: {
      allowList: some({ merkleRoot }),
    },
  });

  // When we verify the identity using a valid merkle proof
  // and mint from the Gumball Machine at the same time.

  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      route(umi, {
        gumballMachine,
        guard: 'allowList',
        routeArgs: {
          path: 'proof',
          merkleRoot,
          merkleProof: getMerkleProof(allowList, base58PublicKey(umi.identity)),
        },
      })
    )
    .add(
      draw(umi, {
        gumballMachine,

        mintArgs: { allowList: some({ merkleRoot }) },
      })
    )
    .sendAndConfirm(umi);

  // Then minting was successful.
  await assertItemBought(t, umi, { gumballMachine });
});

test('it allows minting even when the payer is different from the buyer', async (t) => {
  // Given a separate buyer that is part of an allow list.
  const umi = await createUmi();
  const buyer = generateSigner(umi);
  const allowList = [
    publicKey(buyer),
    'Ur1CbWSGsXCdedknRbJsEk7urwAvu1uddmQv51nAnXB',
    'GjwcWFQYzemBtpUoN5fMAP2FZviTtMRWCmrppGuTthJS',
    '2vjCrmEFiN9CLLhiqy8u1JPh48av8Zpzp3kNkdTtirYG',
    'AT8nPwujHAD14cLojTcB1qdBzA1VXnT6LVGuUd6Y73Cy',
  ];
  const merkleRoot = getMerkleRoot(allowList);

  // And given a loaded Gumball Machine with the allow list guard.

  const { publicKey: gumballMachine } = await create(umi, {
    items: [
      {
        id: (await createNft(umi)).publicKey,
        tokenStandard: TokenStandard.NonFungible,
      },
    ],
    startSale: true,
    guards: {
      allowList: some({ merkleRoot }),
    },
  });

  // When we verify and mint from the Gumball Machine using the buyer.

  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      route(umi, {
        gumballMachine,
        guard: 'allowList',
        routeArgs: {
          path: 'proof',
          merkleRoot,
          merkleProof: getMerkleProof(allowList, base58PublicKey(buyer)),
          buyer: publicKey(buyer), // <-- We need to tell the route instruction who the buyer is.
        },
      })
    )
    .add(
      draw(umi, {
        gumballMachine,

        buyer,

        mintArgs: { allowList: some({ merkleRoot }) },
      })
    )
    .sendAndConfirm(umi);

  // Then minting was successful.
  await assertItemBought(t, umi, { gumballMachine, buyer: publicKey(buyer) });
});

test('it forbids minting from wallets that are not part of a predefined list', async (t) => {
  // Given the identity is not part of the allow list.
  const umi = await createUmi();
  const allowList = [
    'Ur1CbWSGsXCdedknRbJsEk7urwAvu1uddmQv51nAnXB',
    'GjwcWFQYzemBtpUoN5fMAP2FZviTtMRWCmrppGuTthJS',
    '2vjCrmEFiN9CLLhiqy8u1JPh48av8Zpzp3kNkdTtirYG',
    'AT8nPwujHAD14cLojTcB1qdBzA1VXnT6LVGuUd6Y73Cy',
  ];
  const merkleRoot = getMerkleRoot(allowList);

  // And given a loaded Gumball Machine with the allow list guard.

  const { publicKey: gumballMachine } = await create(umi, {
    items: [
      {
        id: (await createNft(umi)).publicKey,
        tokenStandard: TokenStandard.NonFungible,
      },
    ],
    startSale: true,
    guards: {
      allowList: some({ merkleRoot }),
    },
  });

  // When the identity tries to verify itself on the allow list.
  const promise = transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      route(umi, {
        gumballMachine,
        guard: 'allowList',
        routeArgs: {
          path: 'proof',
          merkleRoot,
          merkleProof: getMerkleProof(allowList, base58PublicKey(umi.identity)),
        },
      })
    )
    .sendAndConfirm(umi);

  // Then we expect a program error.
  await t.throwsAsync(promise, { message: /AddressNotFoundInAllowedList/ });
});

test('it forbids minting from wallets that are providing the wrong proof', async (t) => {
  // Given the identity is part of the allow list.
  const umi = await createUmi();
  const allowList = [
    base58PublicKey(umi.identity),
    'Ur1CbWSGsXCdedknRbJsEk7urwAvu1uddmQv51nAnXB',
    'GjwcWFQYzemBtpUoN5fMAP2FZviTtMRWCmrppGuTthJS',
    '2vjCrmEFiN9CLLhiqy8u1JPh48av8Zpzp3kNkdTtirYG',
    'AT8nPwujHAD14cLojTcB1qdBzA1VXnT6LVGuUd6Y73Cy',
  ];
  const merkleRoot = getMerkleRoot(allowList);

  // And given a loaded Gumball Machine with the allow list guard.

  const { publicKey: gumballMachine } = await create(umi, {
    items: [
      {
        id: (await createNft(umi)).publicKey,
        tokenStandard: TokenStandard.NonFungible,
      },
    ],
    startSale: true,
    guards: {
      allowList: some({ merkleRoot }),
    },
  });

  // When the identity tries to verify itself using the wrong proof.
  const wrongProof = getMerkleProof(
    allowList,
    'Ur1CbWSGsXCdedknRbJsEk7urwAvu1uddmQv51nAnXB'
  );
  const promise = transactionBuilder()
    .add(
      route(umi, {
        gumballMachine,
        guard: 'allowList',
        routeArgs: {
          path: 'proof',
          merkleRoot,
          merkleProof: wrongProof,
        },
      })
    )
    .sendAndConfirm(umi);

  // Then we expect a program error.
  await t.throwsAsync(promise, { message: /AddressNotFoundInAllowedList/ });
});

test('it forbids minting if the wallet has not been verified via the route instruction first', async (t) => {
  // Given the identity is part of an allow list.
  const umi = await createUmi();
  const allowList = [
    base58PublicKey(umi.identity),
    'Ur1CbWSGsXCdedknRbJsEk7urwAvu1uddmQv51nAnXB',
    'GjwcWFQYzemBtpUoN5fMAP2FZviTtMRWCmrppGuTthJS',
    '2vjCrmEFiN9CLLhiqy8u1JPh48av8Zpzp3kNkdTtirYG',
    'AT8nPwujHAD14cLojTcB1qdBzA1VXnT6LVGuUd6Y73Cy',
  ];
  const merkleRoot = getMerkleRoot(allowList);

  // And given a loaded Gumball Machine with an allow list guard.

  const { publicKey: gumballMachine } = await create(umi, {
    items: [
      {
        id: (await createNft(umi)).publicKey,
        tokenStandard: TokenStandard.NonFungible,
      },
    ],
    startSale: true,
    guards: {
      allowList: some({ merkleRoot }),
    },
  });

  // When the identity tries to mints from that Gumball Machine
  // without having been verified via the route instruction.

  const promise = transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      draw(umi, {
        gumballMachine,

        mintArgs: { allowList: some({ merkleRoot }) },
      })
    )
    .sendAndConfirm(umi);

  // Then we expect a program error.
  await t.throwsAsync(promise, { message: /MissingAllowedListProof/ });
});

test('it charges a bot tax when trying to mint whilst not verified', async (t) => {
  // Given the identity is part of an allow list.
  const umi = await createUmi();
  const allowList = [
    base58PublicKey(umi.identity),
    'Ur1CbWSGsXCdedknRbJsEk7urwAvu1uddmQv51nAnXB',
    'GjwcWFQYzemBtpUoN5fMAP2FZviTtMRWCmrppGuTthJS',
    '2vjCrmEFiN9CLLhiqy8u1JPh48av8Zpzp3kNkdTtirYG',
    'AT8nPwujHAD14cLojTcB1qdBzA1VXnT6LVGuUd6Y73Cy',
  ];
  const merkleRoot = getMerkleRoot(allowList);

  // And given a loaded Gumball Machine with an allow list and a bot tax guard.

  const { publicKey: gumballMachine } = await create(umi, {
    items: [
      {
        id: (await createNft(umi)).publicKey,
        tokenStandard: TokenStandard.NonFungible,
      },
    ],
    startSale: true,
    guards: {
      botTax: some({ lamports: sol(0.01), lastInstruction: true }),
      allowList: some({ merkleRoot }),
    },
  });

  // When the identity tries to mints from that Gumball Machine
  // without having been verified via the route instruction.

  const { signature } = await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      draw(umi, {
        gumballMachine,

        mintArgs: { allowList: some({ merkleRoot }) },
      })
    )
    .sendAndConfirm(umi);

  // Then we expect a silent bot tax error.
  await assertBotTax(t, umi, signature, /MissingAllowedListProof/);
});

test('it creates a proof for a buyer even when the buyer is not a signer', async (t) => {
  // Given a separate buyer that is part of an allow list and not a signer.
  const umi = await createUmi();
  const buyer = generateSigner(umi).publicKey;
  const allowList = [
    base58PublicKey(buyer),
    'Ur1CbWSGsXCdedknRbJsEk7urwAvu1uddmQv51nAnXB',
    'GjwcWFQYzemBtpUoN5fMAP2FZviTtMRWCmrppGuTthJS',
    '2vjCrmEFiN9CLLhiqy8u1JPh48av8Zpzp3kNkdTtirYG',
    'AT8nPwujHAD14cLojTcB1qdBzA1VXnT6LVGuUd6Y73Cy',
  ];
  const merkleRoot = getMerkleRoot(allowList);

  // And given a loaded Gumball Machine with the allow list guard.

  const { publicKey: gumballMachine } = await create(umi, {
    items: [
      {
        id: (await createNft(umi)).publicKey,
        tokenStandard: TokenStandard.NonFungible,
      },
    ],
    startSale: true,
    guards: {
      allowList: some({ merkleRoot }),
    },
  });

  // When we verify the buyer on the allow list from the Gumball Machine.
  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      route(umi, {
        gumballMachine,
        guard: 'allowList',
        routeArgs: {
          path: 'proof',
          merkleRoot,
          merkleProof: getMerkleProof(allowList, base58PublicKey(buyer)),
          buyer, // <-- We need to tell the route instruction who the buyer is.
        },
      })
    )
    .sendAndConfirm(umi);

  // Then a proof has been created for the buyer.
  const [gumballGuard] = findGumballGuardPda(umi, { base: gumballMachine });
  t.true(
    await umi.rpc.accountExists(
      findAllowListProofPda(umi, {
        gumballGuard,
        gumballMachine,
        merkleRoot,
        user: buyer,
      })[0]
    )
  );

  // But no proof has been created for the payer.
  t.false(
    await umi.rpc.accountExists(
      findAllowListProofPda(umi, {
        gumballGuard,
        gumballMachine,
        merkleRoot,
        user: publicKey(umi.payer),
      })[0]
    )
  );
});

test('it creates a proof for the payer when the buyer is not present', async (t) => {
  // Given the payer that is part of an allow list.
  const umi = await createUmi();
  const allowList = [
    base58PublicKey(umi.payer),
    'Ur1CbWSGsXCdedknRbJsEk7urwAvu1uddmQv51nAnXB',
    'GjwcWFQYzemBtpUoN5fMAP2FZviTtMRWCmrppGuTthJS',
    '2vjCrmEFiN9CLLhiqy8u1JPh48av8Zpzp3kNkdTtirYG',
    'AT8nPwujHAD14cLojTcB1qdBzA1VXnT6LVGuUd6Y73Cy',
  ];
  const merkleRoot = getMerkleRoot(allowList);

  // And given a loaded Gumball Machine with the allow list guard.

  const { publicKey: gumballMachine } = await create(umi, {
    items: [
      {
        id: (await createNft(umi)).publicKey,
        tokenStandard: TokenStandard.NonFungible,
      },
    ],
    startSale: true,
    guards: {
      allowList: some({ merkleRoot }),
    },
  });

  // When we verify the payer on the allow list from the Gumball Machine.
  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      route(umi, {
        gumballMachine,
        guard: 'allowList',
        routeArgs: {
          path: 'proof',
          merkleRoot,
          merkleProof: getMerkleProof(allowList, base58PublicKey(umi.payer)),
        },
      })
    )
    .sendAndConfirm(umi);

  // Then a proof has been created for the payer.
  const [gumballGuard] = findGumballGuardPda(umi, { base: gumballMachine });
  t.true(
    await umi.rpc.accountExists(
      findAllowListProofPda(umi, {
        gumballGuard,
        gumballMachine,
        merkleRoot,
        user: publicKey(umi.payer),
      })[0]
    )
  );
});
