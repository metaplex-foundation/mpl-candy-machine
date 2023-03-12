import { setComputeUnitLimit } from '@metaplex-foundation/mpl-essentials';
import {
  base58PublicKey,
  generateSigner,
  sol,
  some,
  transactionBuilder,
} from '@metaplex-foundation/umi';
import test from 'ava';
import { getMerkleProof, getMerkleRoot, mintV2, route } from '../../src';
import {
  assertBotTax,
  assertSuccessfulMint,
  createCollectionNft,
  createUmi,
  createV2,
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

  // And given a loaded Candy Machine with the allow list guard.
  const collectionMint = (await createCollectionNft(umi)).publicKey;
  const { publicKey: candyMachine } = await createV2(umi, {
    collectionMint,
    configLines: [{ name: 'Degen #1', uri: 'https://example.com/degen/1' }],
    guards: {
      allowList: some({ merkleRoot }),
    },
  });

  // When we verify the payer first by providing a valid merkle proof.
  await transactionBuilder(umi)
    .add(
      route(umi, {
        candyMachine,
        guard: 'allowList',
        routeArgs: {
          path: 'proof',
          merkleRoot,
          merkleProof: getMerkleProof(allowList, base58PublicKey(umi.identity)),
        },
      })
    )
    .sendAndConfirm();

  // And then mint from the Candy Machine using the identity.
  const mint = generateSigner(umi);
  await transactionBuilder(umi)
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      mintV2(umi, {
        candyMachine,
        nftMint: mint,
        collectionMint,
        collectionUpdateAuthority: umi.identity.publicKey,
        mintArgs: { allowList: some({ merkleRoot }) },
      })
    )
    .sendAndConfirm();

  // Then minting was successful.
  await assertSuccessfulMint(t, umi, { mint, owner: umi.identity });
});

test('it is possible to verify the proof and mint in the same transaction if there is space', async (t) => {
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

  // And given a loaded Candy Machine with the allow list guard.
  const collectionMint = (await createCollectionNft(umi)).publicKey;
  const { publicKey: candyMachine } = await createV2(umi, {
    collectionMint,
    configLines: [{ name: 'Degen #1', uri: 'https://example.com/degen/1' }],
    guards: {
      allowList: some({ merkleRoot }),
    },
  });

  // When we verify the identity using a valid merkle proof
  // and mint from the Candy Machine at the same time.
  const mint = generateSigner(umi);
  await transactionBuilder(umi)
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      route(umi, {
        candyMachine,
        guard: 'allowList',
        routeArgs: {
          path: 'proof',
          merkleRoot,
          merkleProof: getMerkleProof(allowList, base58PublicKey(umi.identity)),
        },
      })
    )
    .add(
      mintV2(umi, {
        candyMachine,
        nftMint: mint,
        collectionMint,
        collectionUpdateAuthority: umi.identity.publicKey,
        mintArgs: { allowList: some({ merkleRoot }) },
      })
    )
    .sendAndConfirm();

  // Then minting was successful.
  await assertSuccessfulMint(t, umi, { mint, owner: umi.identity });
});

test('it allows minting even when the payer is different from the minter', async (t) => {
  // Given a separate minter that is part of an allow list.
  const umi = await createUmi();
  const minter = generateSigner(umi);
  const allowList = [
    base58PublicKey(minter),
    'Ur1CbWSGsXCdedknRbJsEk7urwAvu1uddmQv51nAnXB',
    'GjwcWFQYzemBtpUoN5fMAP2FZviTtMRWCmrppGuTthJS',
    '2vjCrmEFiN9CLLhiqy8u1JPh48av8Zpzp3kNkdTtirYG',
    'AT8nPwujHAD14cLojTcB1qdBzA1VXnT6LVGuUd6Y73Cy',
  ];
  const merkleRoot = getMerkleRoot(allowList);

  // And given a loaded Candy Machine with the allow list guard.
  const collectionMint = (await createCollectionNft(umi)).publicKey;
  const { publicKey: candyMachine } = await createV2(umi, {
    collectionMint,
    configLines: [{ name: 'Degen #1', uri: 'https://example.com/degen/1' }],
    guards: {
      allowList: some({ merkleRoot }),
    },
  });

  // When we verify and mint from the Candy Machine using the minter.
  const mint = generateSigner(umi);
  await transactionBuilder(umi)
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      route(umi, {
        candyMachine,
        guard: 'allowList',
        routeArgs: {
          path: 'proof',
          merkleRoot,
          merkleProof: getMerkleProof(allowList, base58PublicKey(minter)),
          minter, // <-- We need to tell the route instruction who the minter is.
        },
      })
    )
    .add(
      mintV2(umi, {
        candyMachine,
        nftMint: mint,
        minter,
        collectionMint,
        collectionUpdateAuthority: umi.identity.publicKey,
        mintArgs: { allowList: some({ merkleRoot }) },
      })
    )
    .sendAndConfirm();

  // Then minting was successful.
  await assertSuccessfulMint(t, umi, { mint, owner: minter });
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

  // And given a loaded Candy Machine with the allow list guard.
  const collectionMint = (await createCollectionNft(umi)).publicKey;
  const { publicKey: candyMachine } = await createV2(umi, {
    collectionMint,
    configLines: [{ name: 'Degen #1', uri: 'https://example.com/degen/1' }],
    guards: {
      allowList: some({ merkleRoot }),
    },
  });

  // When the identity tries to verify itself on the allow list.
  const promise = transactionBuilder(umi)
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      route(umi, {
        candyMachine,
        guard: 'allowList',
        routeArgs: {
          path: 'proof',
          merkleRoot,
          merkleProof: getMerkleProof(allowList, base58PublicKey(umi.identity)),
        },
      })
    )
    .sendAndConfirm();

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

  // And given a loaded Candy Machine with the allow list guard.
  const collectionMint = (await createCollectionNft(umi)).publicKey;
  const { publicKey: candyMachine } = await createV2(umi, {
    collectionMint,
    configLines: [{ name: 'Degen #1', uri: 'https://example.com/degen/1' }],
    guards: {
      allowList: some({ merkleRoot }),
    },
  });

  // When the identity tries to verify itself using the wrong proof.
  const wrongProof = getMerkleProof(
    allowList,
    'Ur1CbWSGsXCdedknRbJsEk7urwAvu1uddmQv51nAnXB'
  );
  const promise = transactionBuilder(umi)
    .add(
      route(umi, {
        candyMachine,
        guard: 'allowList',
        routeArgs: {
          path: 'proof',
          merkleRoot,
          merkleProof: wrongProof,
        },
      })
    )
    .sendAndConfirm();

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

  // And given a loaded Candy Machine with an allow list guard.
  const collectionMint = (await createCollectionNft(umi)).publicKey;
  const { publicKey: candyMachine } = await createV2(umi, {
    collectionMint,
    configLines: [{ name: 'Degen #1', uri: 'https://example.com/degen/1' }],
    guards: {
      allowList: some({ merkleRoot }),
    },
  });

  // When the identity tries to mints from that Candy Machine
  // without having been verified via the route instruction.
  const mint = generateSigner(umi);
  const promise = transactionBuilder(umi)
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      mintV2(umi, {
        candyMachine,
        nftMint: mint,
        collectionMint,
        collectionUpdateAuthority: umi.identity.publicKey,
        mintArgs: { allowList: some({ merkleRoot }) },
      })
    )
    .sendAndConfirm();

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

  // And given a loaded Candy Machine with an allow list and a bot tax guard.
  const collectionMint = (await createCollectionNft(umi)).publicKey;
  const { publicKey: candyMachine } = await createV2(umi, {
    collectionMint,
    configLines: [{ name: 'Degen #1', uri: 'https://example.com/degen/1' }],
    guards: {
      botTax: some({ lamports: sol(0.01), lastInstruction: true }),
      allowList: some({ merkleRoot }),
    },
  });

  // When the identity tries to mints from that Candy Machine
  // without having been verified via the route instruction.
  const mint = generateSigner(umi);
  const { signature } = await transactionBuilder(umi)
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      mintV2(umi, {
        candyMachine,
        nftMint: mint,
        collectionMint,
        collectionUpdateAuthority: umi.identity.publicKey,
        mintArgs: { allowList: some({ merkleRoot }) },
      })
    )
    .sendAndConfirm();

  // Then we expect a silent bot tax error.
  await assertBotTax(t, umi, mint, signature, /MissingAllowedListProof/);
});
