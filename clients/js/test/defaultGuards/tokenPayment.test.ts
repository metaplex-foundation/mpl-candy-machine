import {
  fetchToken,
  setComputeUnitLimit,
} from '@metaplex-foundation/mpl-toolbox';
import {
  generateSigner,
  publicKey,
  sol,
  some,
  transactionBuilder,
} from '@metaplex-foundation/umi';
import test from 'ava';
import {
  draw,
  fetchGumballMachine,
  findGumballMachineAuthorityPda,
  TokenStandard,
} from '../../src';
import {
  assertBotTax,
  assertItemBought,
  create,
  createMintWithHolders,
  createNft,
  createUmi,
} from '../_setup';

test('it transfers tokens from the payer to the destination', async (t) => {
  // Given a mint account such that:
  // - The destination treasury has 100 tokens.
  // - The payer has 12 tokens.
  const umi = await createUmi();
  const gumballMachineSigner = generateSigner(umi);
  const gumballMachine = gumballMachineSigner.publicKey;
  const destination = findGumballMachineAuthorityPda(umi, {
    gumballMachine: gumballMachine,
  })[0];
  const [tokenMint, destinationAta, identityAta] = await createMintWithHolders(
    umi,
    {
      holders: [
        { owner: destination, amount: 100 },
        { owner: umi.identity, amount: 12 },
      ],
    }
  );

  // And a loaded Gumball Machine with a tokenPayment guard that requires 5 tokens.

  await create(umi, {
    gumballMachine: gumballMachineSigner,
    items: [
      {
        id: (await createNft(umi)).publicKey,
        tokenStandard: TokenStandard.NonFungible,
      },
    ],
    startSale: true,
    settings: {
      paymentMint: tokenMint.publicKey,
    },
    guards: {
      tokenPayment: some({
        mint: tokenMint.publicKey,
        amount: 5,
      }),
    },
  });

  // When we mint from it.

  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      draw(umi, {
        gumballMachine,
        mintArgs: {
          tokenPayment: some({ mint: tokenMint.publicKey }),
        },
      })
    )
    .sendAndConfirm(umi);

  // Then minting was successful.
  await assertItemBought(t, umi, { gumballMachine });

  // And the treasury token received 5 tokens.
  const destinationTokenAccount = await fetchToken(umi, destinationAta);
  t.is(destinationTokenAccount.amount, 105n);

  // And the payer lost 5 tokens.
  const payerTokenAccount = await fetchToken(umi, identityAta);
  t.is(payerTokenAccount.amount, 7n);

  // Total revenue is incremented
  const gumballMachineAccount = await fetchGumballMachine(umi, gumballMachine);
  t.is(gumballMachineAccount.totalRevenue, 5n, 'total revenue is incremented');
});

test('it allows minting even when the payer is different from the buyer', async (t) => {
  // Given a mint account such that:
  // - The destination treasury has 100 tokens.
  // - An explicit buyer has 12 tokens.
  const umi = await createUmi();
  const buyer = generateSigner(umi);
  const gumballMachineSigner = generateSigner(umi);
  const gumballMachine = gumballMachineSigner.publicKey;
  const destination = findGumballMachineAuthorityPda(umi, {
    gumballMachine: gumballMachine,
  })[0];
  const [tokenMint, destinationAta, buyerAta] = await createMintWithHolders(
    umi,
    {
      holders: [
        { owner: destination, amount: 100 },
        { owner: buyer, amount: 12 },
      ],
    }
  );

  // And a loaded Gumball Machine with a tokenPayment guard that requires 5 tokens.

  await create(umi, {
    gumballMachine: gumballMachineSigner,
    items: [
      {
        id: (await createNft(umi)).publicKey,
        tokenStandard: TokenStandard.NonFungible,
      },
    ],
    startSale: true,
    settings: {
      paymentMint: tokenMint.publicKey,
    },
    guards: {
      tokenPayment: some({
        mint: tokenMint.publicKey,
        amount: 5,
      }),
    },
  });

  // When the buyer mints from it.

  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      draw(umi, {
        gumballMachine,

        buyer,

        mintArgs: {
          tokenPayment: some({ mint: tokenMint.publicKey }),
        },
      })
    )
    .sendAndConfirm(umi);

  // Then minting was successful.
  await assertItemBought(t, umi, { gumballMachine, buyer: publicKey(buyer) });

  // And the treasury token received 5 tokens.
  const destinationTokenAccount = await fetchToken(umi, destinationAta);
  t.is(destinationTokenAccount.amount, 105n);

  // And the buyer lost 5 tokens.
  const buyerTokenAccount = await fetchToken(umi, buyerAta);
  t.is(buyerTokenAccount.amount, 7n);
});

test('it fails if the payer does not have enough tokens', async (t) => {
  // Given a mint account such that the payer has 4 tokens.
  const umi = await createUmi();
  const gumballMachineSigner = generateSigner(umi);
  const gumballMachine = gumballMachineSigner.publicKey;
  const destination = findGumballMachineAuthorityPda(umi, {
    gumballMachine: gumballMachine,
  })[0];
  const [tokenMint, identityAta] = await createMintWithHolders(umi, {
    holders: [
      { owner: umi.identity, amount: 4 },
      { owner: destination, amount: 0 },
    ],
  });

  // And a loaded Gumball Machine with a tokenPayment guard that requires 5 tokens.

  await create(umi, {
    gumballMachine: gumballMachineSigner,
    items: [
      {
        id: (await createNft(umi)).publicKey,
        tokenStandard: TokenStandard.NonFungible,
      },
    ],
    startSale: true,
    settings: {
      paymentMint: tokenMint.publicKey,
    },
    guards: {
      tokenPayment: some({
        mint: tokenMint.publicKey,
        amount: 5,
      }),
    },
  });

  // When we try to mint from it.

  const promise = transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      draw(umi, {
        gumballMachine,

        mintArgs: {
          tokenPayment: some({ mint: tokenMint.publicKey }),
        },
      })
    )
    .sendAndConfirm(umi);

  // Then we expect a program error.
  await t.throwsAsync(promise, { message: /NotEnoughTokens/ });

  // And the payer still has 4 tokens.
  const payerTokenAccount = await fetchToken(umi, identityAta);
  t.is(payerTokenAccount.amount, 4n);
});

test('it charges a bot tax if the payer does not have enough tokens', async (t) => {
  // Given a mint account such that the payer has 4 tokens.
  const umi = await createUmi();
  const gumballMachineSigner = generateSigner(umi);
  const gumballMachine = gumballMachineSigner.publicKey;
  const destination = findGumballMachineAuthorityPda(umi, {
    gumballMachine: gumballMachine,
  })[0];
  const [tokenMint, identityAta] = await createMintWithHolders(umi, {
    holders: [
      { owner: umi.identity, amount: 4 },
      { owner: destination, amount: 0 },
    ],
  });

  // And a loaded Gumball Machine with a bot tax guard and a tokenPayment guard that requires 5 tokens.

  await create(umi, {
    gumballMachine: gumballMachineSigner,
    items: [
      {
        id: (await createNft(umi)).publicKey,
        tokenStandard: TokenStandard.NonFungible,
      },
    ],
    startSale: true,
    settings: {
      paymentMint: tokenMint.publicKey,
    },
    guards: {
      botTax: some({ lamports: sol(0.1), lastInstruction: true }),
      tokenPayment: some({
        mint: tokenMint.publicKey,
        amount: 5,
      }),
    },
  });

  // When we try to mint from it.

  const { signature } = await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      draw(umi, {
        gumballMachine,

        mintArgs: {
          tokenPayment: some({ mint: tokenMint.publicKey }),
        },
      })
    )
    .sendAndConfirm(umi);

  // Then we expect a silent bot tax error.
  await assertBotTax(t, umi, signature, /NotEnoughTokens/);

  // And the payer still has 4 tokens.
  const payerTokenAccount = await fetchToken(umi, identityAta);
  t.is(payerTokenAccount.amount, 4n);
});

test('it fails if a different mint is provided in draw', async (t) => {
  // Given a mint account such that the payer has 4 tokens.
  const umi = await createUmi();
  const gumballMachineSigner = generateSigner(umi);
  const gumballMachine = gumballMachineSigner.publicKey;
  const destination = findGumballMachineAuthorityPda(umi, {
    gumballMachine: gumballMachine,
  })[0];
  const [tokenMint] = await createMintWithHolders(umi, {
    holders: [
      { owner: destination, amount: 0 },
      { owner: umi.identity, amount: 4 },
    ],
  });

  const [otherTokenMint] = await createMintWithHolders(umi, {
    holders: [
      { owner: destination, amount: 0 },
      { owner: umi.identity, amount: 4 },
    ],
  });

  // And a loaded Gumball Machine with a tokenPayment guard that requires 5 tokens.
  await create(umi, {
    gumballMachine: gumballMachineSigner,
    items: [
      {
        id: (await createNft(umi)).publicKey,
        tokenStandard: TokenStandard.NonFungible,
      },
    ],
    startSale: true,
    settings: {
      paymentMint: tokenMint.publicKey,
    },
    guards: {
      tokenPayment: some({
        mint: tokenMint.publicKey,
        amount: 5,
      }),
    },
  });

  // When we try to mint from it.
  const promise = transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      draw(umi, {
        gumballMachine,
        mintArgs: {
          tokenPayment: some({ mint: otherTokenMint.publicKey }),
        },
      })
    )
    .sendAndConfirm(umi);

  // Then we expect a program error.
  await t.throwsAsync(promise, { message: /Public key mismatch/ });
});
