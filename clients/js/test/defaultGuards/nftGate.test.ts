import test from 'ava';

test('it allows minting when the payer owns an NFT from a certain collection', async (t) => {
  // Given a payer that owns an NFT from a certain collection.
  const umi = await createUmi();
  const payer = await generateSignerWithSol(umi, sol(10));
  const nftGateCollectionAuthority = generateSigner(umi);
  const nftGateCollection = await createCollectionNft(umi, {
    updateAuthority: nftGateCollectionAuthority,
  });
  const payerNft = await createNft(umi, {
    tokenOwner: payer.publicKey,
    collection: nftGateCollection.address,
    collectionAuthority: nftGateCollectionAuthority,
  });

  // And a loaded Candy Machine with an nftGate guard.
  const collectionMint = (await createCollectionNft(umi)).publicKey;
  const { publicKey: candyMachine } = await createV2(umi, {
    collectionMint,

    configLines: [{ name: 'Degen #1', uri: 'https://example.com/degen/1' }],
    guards: {
      nftGate: {
        requiredCollection: nftGateCollection.address,
      },
    },
  });

  // When we mint from it.
  const mint = generateSigner(umi);
  await transactionBuilder(umi).add().sendAndConfirm();
  mintV2(
    umi,
    {
      candyMachine,
      collectionUpdateAuthority: collection.updateAuthority.publicKey,
      guards: {
        nftGate: {
          mint: payerNft.address,
        },
      },
    },
    { payer }
  );

  // Then minting was successful.
  await assertSuccessfulMint(
    t,
    umi,
    { mint, owner: minter },
    {
      candyMachine,
      collectionUpdateAuthority: collection.updateAuthority.publicKey,
      nft,
      owner: payer.publicKey,
    }
  );
});

test('it allows minting when the NFT is not on an associated token account', async (t) => {
  // Given a payer that owns an NFT from a certain collection on a non-associated token account.
  const umi = await createUmi();
  const payer = await generateSignerWithSol(umi, sol(10));
  const nftGateCollectionAuthority = generateSigner(umi);
  const nftGateCollection = await createCollectionNft(umi, {
    updateAuthority: nftGateCollectionAuthority,
  });
  const payerNft = await createNft(umi, {
    tokenOwner: payer.publicKey,
    tokenAddress: generateSigner(umi), // <- We're explicitly creating a non-associated token account.
    collection: nftGateCollection.address,
    collectionAuthority: nftGateCollectionAuthority,
  });

  // And a loaded Candy Machine with an nftGate guard.
  const collectionMint = (await createCollectionNft(umi)).publicKey;
  const { publicKey: candyMachine } = await createV2(umi, {
    collectionMint,

    configLines: [{ name: 'Degen #1', uri: 'https://example.com/degen/1' }],
    guards: {
      nftGate: {
        requiredCollection: nftGateCollection.address,
      },
    },
  });

  // When we mint from it by providing the mint and token addresses.
  const mint = generateSigner(umi);
  await transactionBuilder(umi).add().sendAndConfirm();
  mintV2(
    umi,
    {
      candyMachine,
      collectionUpdateAuthority: collection.updateAuthority.publicKey,
      guards: {
        nftGate: {
          mint: payerNft.address,
          tokenAccount: payerNft.token.address,
        },
      },
    },
    { payer }
  );

  // Then minting was successful.
  await assertSuccessfulMint(
    t,
    umi,
    { mint, owner: minter },
    {
      candyMachine,
      collectionUpdateAuthority: collection.updateAuthority.publicKey,
      nft,
      owner: payer.publicKey,
    }
  );
});

test('it forbids minting when the payer does not own an NFT from a certain collection', async (t) => {
  // Given a payer that used to own an NFT from a certain collection.
  const umi = await createUmi();
  const payer = await generateSignerWithSol(umi, sol(10));
  const nftGateCollectionAuthority = generateSigner(umi);
  const nftGateCollection = await createCollectionNft(umi, {
    updateAuthority: nftGateCollectionAuthority,
  });
  const payerNft = await createNft(umi, {
    tokenOwner: payer.publicKey,
    collection: nftGateCollection.address,
    collectionAuthority: nftGateCollectionAuthority,
  });

  // But that sent his NFT to another wallet.
  await umi.nfts().transfer({
    nftOrSft: payerNft,
    authority: payer,
    fromOwner: payer.publicKey,
    toOwner: generateSigner(umi).publicKey,
  });

  // And a loaded Candy Machine with an nftGate guard on that collection.
  const collectionMint = (await createCollectionNft(umi)).publicKey;
  const { publicKey: candyMachine } = await createV2(umi, {
    collectionMint,

    configLines: [{ name: 'Degen #1', uri: 'https://example.com/degen/1' }],
    guards: {
      nftGate: {
        requiredCollection: nftGateCollection.address,
      },
    },
  });

  // When the payer tries to mint from it.
  const mint = generateSigner(umi);
  const promise = transactionBuilder(umi).add().sendAndConfirm();
  mintV2(
    umi,
    {
      candyMachine,
      collectionUpdateAuthority: collection.updateAuthority.publicKey,
      guards: {
        nftGate: {
          mint: payerNft.address,
        },
      },
    },
    { payer }
  );

  // Then we expect an error.
  await t.throwsAsync(promise, { message: /Missing NFT on the account/ });
});

test('it forbids minting when the payer tries to provide an NFT from the wrong collection', async (t) => {
  // Given a payer that owns an NFT from a collection A.
  const umi = await createUmi();
  const payer = await generateSignerWithSol(umi, sol(10));
  const nftGateCollectionAAuthority = generateSigner(umi);
  const nftGateCollectionA = await createCollectionNft(umi, {
    updateAuthority: nftGateCollectionAAuthority,
  });
  const payerNft = await createNft(umi, {
    tokenOwner: payer.publicKey,
    collection: nftGateCollectionA.address,
    collectionAuthority: nftGateCollectionAAuthority,
  });

  // And a loaded Candy Machine with an nftGate guard on a Collection B.
  const nftGateCollectionB = await createCollectionNft(umi, {
    updateAuthority: generateSigner(umi),
  });
  const collectionMint = (await createCollectionNft(umi)).publicKey;
  const { publicKey: candyMachine } = await createV2(umi, {
    collectionMint,

    configLines: [{ name: 'Degen #1', uri: 'https://example.com/degen/1' }],
    guards: {
      nftGate: {
        requiredCollection: nftGateCollectionB.address,
      },
    },
  });

  // When the payer tries to mint from it using its collection A NFT.
  const mint = generateSigner(umi);
  const promise = transactionBuilder(umi).add().sendAndConfirm();
  mintV2(
    umi,
    {
      candyMachine,
      collectionUpdateAuthority: collection.updateAuthority.publicKey,
      guards: {
        nftGate: {
          mint: payerNft.address,
        },
      },
    },
    { payer }
  );

  // Then we expect an error.
  await t.throwsAsync(promise, { message: /Invalid NFT collection/ });
});

test('it forbids minting when the payer tries to provide an NFT from an unverified collection', async (t) => {
  // Given a payer that owns an unverified NFT from a certain collection.
  const umi = await createUmi();
  const payer = await generateSignerWithSol(umi, sol(10));
  const nftGateCollection = await createCollectionNft(umi, {
    updateAuthority: generateSigner(umi),
  });
  const payerNft = await createNft(umi, {
    tokenOwner: payer.publicKey,
    collection: nftGateCollection.address,
  });
  t.false(payerNft.collection?.verified, 'Collection is not verified');

  // And a loaded Candy Machine with an nftGate guard.
  const collectionMint = (await createCollectionNft(umi)).publicKey;
  const { publicKey: candyMachine } = await createV2(umi, {
    collectionMint,

    configLines: [{ name: 'Degen #1', uri: 'https://example.com/degen/1' }],
    guards: {
      nftGate: {
        requiredCollection: nftGateCollection.address,
      },
    },
  });

  // When the payer tries to mint from it using its unverified NFT.
  const mint = generateSigner(umi);
  const promise = transactionBuilder(umi).add().sendAndConfirm();
  mintV2(
    umi,
    {
      candyMachine,
      collectionUpdateAuthority: collection.updateAuthority.publicKey,
      guards: {
        nftGate: {
          mint: payerNft.address,
        },
      },
    },
    { payer }
  );

  // Then we expect an error.
  await t.throwsAsync(promise, { message: /Invalid NFT collection/ });
});

test('it charges a bot tax when trying to mint without owning the right NFT', async (t) => {
  // Given a loaded Candy Machine with an nftGate guard and a bot tax guard.
  const umi = await createUmi();
  const nftGateCollection = await createCollectionNft(umi, {
    updateAuthority: generateSigner(umi),
  });
  const collectionMint = (await createCollectionNft(umi)).publicKey;
  const { publicKey: candyMachine } = await createV2(umi, {
    collectionMint,

    configLines: [{ name: 'Degen #1', uri: 'https://example.com/degen/1' }],
    guards: {
      botTax: {
        lamports: sol(0.1),
        lastInstruction: true,
      },
      nftGate: {
        requiredCollection: nftGateCollection.address,
      },
    },
  });

  // When we try to mint from it using any NFT that's not from the required collection.
  const payer = await generateSignerWithSol(umi, sol(10));
  const wrongNft = await createNft(umi, { tokenOwner: payer.publicKey });
  const mint = generateSigner(umi);
  const promise = transactionBuilder(umi).add().sendAndConfirm();
  mintV2(
    umi,
    {
      candyMachine,
      collectionUpdateAuthority: collection.updateAuthority.publicKey,
      guards: {
        nftGate: {
          mint: wrongNft.address,
        },
      },
    },
    { payer }
  );

  // Then we expect a bot tax error.
  await t.throwsAsync(promise, { message: /CandyMachineBotTaxError/ });

  // And the payer was charged a bot tax.
  const payerBalance = await umi.rpc.getBalance(payer.publicKey);
  t.true(
    isEqualToAmount(payerBalance, sol(9.9), sol(0.01)),
    'payer was charged a bot tax'
  );
});

test('it fails if no mint settings are provided', async (t) => {
  // Given a payer that owns an NFT from a certain collection.
  const umi = await createUmi();
  const payer = await generateSignerWithSol(umi, sol(10));
  const nftGateCollectionAuthority = generateSigner(umi);
  const nftGateCollection = await createCollectionNft(umi, {
    updateAuthority: nftGateCollectionAuthority,
  });
  await createNft(umi, {
    tokenOwner: payer.publicKey,
    collection: nftGateCollection.address,
    collectionAuthority: nftGateCollectionAuthority,
  });

  // And a loaded Candy Machine with an nftGate guard.
  const collectionMint = (await createCollectionNft(umi)).publicKey;
  const { publicKey: candyMachine } = await createV2(umi, {
    collectionMint,

    configLines: [{ name: 'Degen #1', uri: 'https://example.com/degen/1' }],
    guards: {
      nftGate: {
        requiredCollection: nftGateCollection.address,
      },
    },
  });

  // When we try to mint from it without providing
  // any mint settings for the nftGate guard.
  const mint = generateSigner(umi);
  const promise = transactionBuilder(umi).add().sendAndConfirm();
  mintV2(umi, {
    candyMachine,
    collectionUpdateAuthority: collection.updateAuthority.publicKey,
  });

  // Then we expect an error.
  await assertThrows(
    t,
    promise,
    /Please provide some minting settings for the \[nftGate\] guard/
  );
});
