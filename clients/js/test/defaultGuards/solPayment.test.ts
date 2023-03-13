import test from 'ava';

test('it transfers SOL from the payer to the destination', async (t) => {
  // Given a loaded Candy Machine with a solPayment guard.
  const umi = await createUmi();
  const treasury = generateSigner(umi);
  const collectionMint = (await createCollectionNft(umi)).publicKey;
  const { publicKey: candyMachine } = await createV2(umi, {
    collectionMint,

    configLines: [{ name: 'Degen #1', uri: 'https://example.com/degen/1' }],
    guards: {
      solPayment: {
        amount: sol(1),
        destination: treasury.publicKey,
      },
    },
  });

  // When we mint for another owner using an explicit payer.
  const payer = await generateSignerWithSol(umi, sol(10));
  const owner = generateSigner(umi).publicKey;
  const mint = generateSigner(umi);
  await transactionBuilder(umi).add().sendAndConfirm();
  mintV2(
    umi,
    {
      candyMachine,
      collectionUpdateAuthority: collection.updateAuthority.publicKey,
      owner,
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
      owner,
    }
  );

  // And the treasury received SOLs.
  const treasuryBalance = await umi.rpc.getBalance(treasury.publicKey);
  t.true(isEqualToAmount(treasuryBalance, sol(1)), 'treasury received SOLs');

  // And the payer lost SOLs.
  const payerBalance = await umi.rpc.getBalance(payer.publicKey);
  t.true(isEqualToAmount(payerBalance, sol(9), sol(0.1)), 'payer lost SOLs');
});

test('it fails if the payer does not have enough funds', async (t) => {
  // Given a loaded Candy Machine with a solPayment guard costing 5 SOLs.
  const umi = await createUmi();
  const treasury = generateSigner(umi);
  const collectionMint = (await createCollectionNft(umi)).publicKey;
  const { publicKey: candyMachine } = await createV2(umi, {
    collectionMint,

    configLines: [{ name: 'Degen #1', uri: 'https://example.com/degen/1' }],
    guards: {
      solPayment: {
        amount: sol(5),
        destination: treasury.publicKey,
      },
    },
  });

  // When we mint from it using a payer that only has 4 SOL.
  const payer = await generateSignerWithSol(umi, 4);
  const mint = generateSigner(umi);
  const promise = transactionBuilder(umi).add().sendAndConfirm();
  mintV2(
    umi,
    {
      candyMachine,
      collectionUpdateAuthority: collection.updateAuthority.publicKey,
    },
    { payer }
  );

  // Then we expect an error.
  await t.throwsAsync(promise, {
    message: /Not enough SOL to pay for the mint/,
  });

  // And the payer didn't loose any SOL.
  const payerBalance = await umi.rpc.getBalance(payer.publicKey);
  t.true(isEqualToAmount(payerBalance, sol(4)), 'payer did not lose SOLs');
});

test('it charges a bot tax if the payer does not have enough funds', async (t) => {
  // Given a loaded Candy Machine with a solPayment guard costing 5 SOLs and a botTax guard.
  const umi = await createUmi();
  const treasury = generateSigner(umi);
  const collectionMint = (await createCollectionNft(umi)).publicKey;
  const { publicKey: candyMachine } = await createV2(umi, {
    collectionMint,

    configLines: [{ name: 'Degen #1', uri: 'https://example.com/degen/1' }],
    guards: {
      botTax: {
        lamports: sol(0.1),
        lastInstruction: true,
      },
      solPayment: {
        amount: sol(5),
        destination: treasury.publicKey,
      },
    },
  });

  // When we mint from it using a payer that only has 4 SOL.
  const payer = await generateSignerWithSol(umi, 4);
  const mint = generateSigner(umi);
  const promise = transactionBuilder(umi).add().sendAndConfirm();
  mintV2(
    umi,
    {
      candyMachine,
      collectionUpdateAuthority: collection.updateAuthority.publicKey,
    },
    { payer }
  );

  // Then we expect a bot tax error.
  await t.throwsAsync(promise, { message: /CandyMachineBotTaxError/ });

  // And the payer was charged a bot tax.
  const payerBalance = await umi.rpc.getBalance(payer.publicKey);
  t.true(
    isEqualToAmount(payerBalance, sol(3.9), sol(0.01)),
    'payer was charged a bot tax'
  );
});
