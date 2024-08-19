/* eslint-disable no-await-in-loop */
import {
  fetchToken,
  setComputeUnitLimit,
} from '@metaplex-foundation/mpl-toolbox';
import {
  generateSigner,
  isEqualToAmount,
  none,
  PublicKey,
  sol,
  some,
  transactionBuilder,
  Umi,
} from '@metaplex-foundation/umi';
import { generateSignerWithSol } from '@metaplex-foundation/umi-bundle-tests';
import test from 'ava';
import {
  addNft,
  draw,
  fetchGumballMachine,
  findGumballMachineAuthorityPda,
  GumballMachine,
  GumballState,
  startSale,
  TokenStandard,
} from '../src';
import {
  assertItemBought,
  create,
  createMintWithHolders,
  createNft,
  createUmi,
  tomorrow,
  yesterday,
} from './_setup';

test('it can mint from a gumball guard with no guards', async (t) => {
  // Given a gumball machine with a gumball guard that has no guards.
  const umi = await createUmi();
  const nft = await createNft(umi);

  const gumballMachineSigner = await create(umi, {
    items: [
      {
        id: nft.publicKey,
        tokenStandard: TokenStandard.NonFungible,
      },
    ],
    startSale: true,
    guards: {},
    groups: [],
  });
  const gumballMachine = gumballMachineSigner.publicKey;

  // When we mint from the gumball guard.
  const buyer = generateSigner(umi);
  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      draw(umi, {
        gumballMachine,
        buyer,
      })
    )
    .sendAndConfirm(umi);

  // Then the mint was successful.
  await assertItemBought(t, umi, { gumballMachine, buyer: buyer.publicKey });

  // And the gumball machine was updated.
  const gumballMachineAccount = await fetchGumballMachine(umi, gumballMachine);
  t.like(gumballMachineAccount, <Partial<GumballMachine>>{
    itemsRedeemed: 1n,
    items: [
      {
        index: 0,
        isDrawn: true,
        isClaimed: false,
        mint: nft.publicKey,
        seller: umi.identity.publicKey,
        buyer: buyer.publicKey,
        tokenStandard: TokenStandard.NonFungible,
      },
    ],
  });
});

test('it sets state to SaleEnded on final draw', async (t) => {
  // Given a gumball machine with a gumball guard that has no guards.
  const umi = await createUmi();

  const gumballMachineSigner = await create(umi, {
    settings: { itemCapacity: 1 },
    items: [
      {
        id: (await createNft(umi)).publicKey,
        tokenStandard: TokenStandard.NonFungible,
      },
    ],
    startSale: true,
    guards: {},
    groups: [],
  });
  const gumballMachine = gumballMachineSigner.publicKey;

  // When we mint from the gumball guard.
  const buyer = generateSigner(umi);
  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      draw(umi, {
        gumballMachine,
        buyer,
      })
    )
    .sendAndConfirm(umi);

  // Then the mint was successful.
  await assertItemBought(t, umi, { gumballMachine, buyer: buyer.publicKey });

  // And the gumball machine was updated.
  const gumballMachineAccount = await fetchGumballMachine(umi, gumballMachine);
  t.like(gumballMachineAccount, <GumballMachine>{
    itemsRedeemed: 1n,
    itemsLoaded: 1,
    state: GumballState.SaleEnded,
  });
});

test('it can mint from a gumball guard with guards', async (t) => {
  // Given a gumball machine with some guards.
  const umi = await createUmi();

  const gumballMachineSigner = await create(umi, {
    items: [
      {
        id: (await createNft(umi)).publicKey,
        tokenStandard: TokenStandard.NonFungible,
      },
    ],
    startSale: true,
    guards: {
      botTax: { lamports: sol(0.01), lastInstruction: true },
      solPayment: { lamports: sol(2) },
    },
  });
  const gumballMachine = gumballMachineSigner.publicKey;

  // When we mint from the gumball guard.
  const buyer = generateSigner(umi);
  const payer = await generateSignerWithSol(umi, sol(10));
  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      draw(umi, {
        gumballMachine,
        payer,
        buyer,
        mintArgs: {
          solPayment: some(true),
        },
      })
    )
    .sendAndConfirm(umi);

  // Then the mint was successful.
  await assertItemBought(t, umi, { gumballMachine, buyer: buyer.publicKey });

  // And the payer was charged.
  const payerBalance = await umi.rpc.getBalance(payer.publicKey);
  t.true(isEqualToAmount(payerBalance, sol(8), sol(0.1)));

  // And the gumball machine was updated.
  const gumballMachineAccount = await fetchGumballMachine(umi, gumballMachine);
  t.like(gumballMachineAccount, <GumballMachine>{ itemsRedeemed: 1n });
});

test('it can mint from a gumball guard with token payment guard', async (t) => {
  // Given a gumball machine with some guards.
  const umi = await createUmi();
  const buyerUmi = await createUmi();
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
        { owner: buyerUmi.identity, amount: 12 },
      ],
    }
  );

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
      tokenPayment: { mint: tokenMint.publicKey, amount: 5 },
    },
  });

  // When we mint from the gumball guard.
  await transactionBuilder()
    .add(setComputeUnitLimit(buyerUmi, { units: 600_000 }))
    .add(
      draw(buyerUmi, {
        gumballMachine,
        mintArgs: {
          tokenPayment: { mint: tokenMint.publicKey },
        },
      })
    )
    .sendAndConfirm(buyerUmi);

  // Then the mint was successful.
  await assertItemBought(t, umi, {
    gumballMachine,
    buyer: buyerUmi.identity.publicKey,
  });

  // And the treasury token received 5 tokens.
  const destinationTokenAccount = await fetchToken(umi, destinationAta);
  t.is(destinationTokenAccount.amount, 105n);

  // And the payer lost 5 tokens.
  const payerTokenAccount = await fetchToken(umi, identityAta);
  t.is(payerTokenAccount.amount, 7n);
});

test('it can mint from a gumball guard with groups', async (t) => {
  // Given a gumball machine with guard groups.
  const umi = await createUmi();

  const gumballMachineSigner = await create(umi, {
    items: [
      {
        id: (await createNft(umi)).publicKey,
        tokenStandard: TokenStandard.NonFungible,
      },
    ],
    startSale: true,
    guards: {
      botTax: { lamports: sol(0.01), lastInstruction: true },
      solPayment: { lamports: sol(2) },
    },
    groups: [
      { label: 'GROUP1', guards: { startDate: { date: yesterday() } } },
      { label: 'GROUP2', guards: { startDate: { date: tomorrow() } } },
    ],
  });
  const gumballMachine = gumballMachineSigner.publicKey;

  // When we mint from it using GROUP1.
  const buyer = generateSigner(umi);
  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      draw(umi, {
        gumballMachine,
        buyer,
        mintArgs: { solPayment: some(true) },
        group: 'GROUP1',
      })
    )
    .sendAndConfirm(umi);

  // Then the mint was successful.
  await assertItemBought(t, umi, { gumballMachine, buyer: buyer.publicKey });
});

test('it cannot mint using the default guards if the gumball guard has groups', async (t) => {
  // Given a gumball machine with guard groups.
  const umi = await createUmi();

  const gumballMachineSigner = await create(umi, {
    items: [
      {
        id: (await createNft(umi)).publicKey,
        tokenStandard: TokenStandard.NonFungible,
      },
    ],
    startSale: true,
    guards: { solPayment: { lamports: sol(2) } },
    groups: [
      { label: 'GROUP1', guards: { startDate: { date: yesterday() } } },
      { label: 'GROUP2', guards: { startDate: { date: tomorrow() } } },
    ],
  });
  const gumballMachine = gumballMachineSigner.publicKey;

  // When we try to mint using the default guards.
  const buyer = generateSigner(umi);
  const promise = transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      draw(umi, {
        gumballMachine,
        buyer,
        mintArgs: { solPayment: some(true) },
        group: none(),
      })
    )
    .sendAndConfirm(umi);

  // Then we expect a program error.
  await t.throwsAsync(promise, { message: /RequiredGroupLabelNotFound/ });
});

test('it cannot mint from a group if the provided group label does not exist', async (t) => {
  // Given a gumball machine with no guard groups.
  const umi = await createUmi();

  const { publicKey: gumballMachine } = await create(umi, {
    items: [
      {
        id: (await createNft(umi)).publicKey,
        tokenStandard: TokenStandard.NonFungible,
      },
    ],
    startSale: true,
    guards: { solPayment: { lamports: sol(2) } },
    groups: [{ label: 'GROUP1', guards: { startDate: { date: yesterday() } } }],
  });

  // When we try to mint using a group that does not exist.
  const buyer = generateSigner(umi);
  const promise = transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      draw(umi, {
        gumballMachine,
        buyer,
        mintArgs: { solPayment: some(true) },
        group: 'GROUPX',
      })
    )
    .sendAndConfirm(umi);

  // Then we expect a program error.
  await t.throwsAsync(promise, { message: /GroupNotFound/ });
});

test('it can mint using an explicit payer', async (t) => {
  // Given a gumball machine with guards.
  const umi = await createUmi();

  const { publicKey: gumballMachine } = await create(umi, {
    items: [
      {
        id: (await createNft(umi)).publicKey,
        tokenStandard: TokenStandard.NonFungible,
      },
    ],
    startSale: true,
    guards: { solPayment: { lamports: sol(2) } },
  });

  // And an explicit payer with 10 SOL.
  const payer = await generateSignerWithSol(umi, sol(10));

  // When we mint from it using that payer.
  const buyer = generateSigner(umi);
  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      draw(umi, {
        gumballMachine,
        buyer,
        payer,
        mintArgs: { solPayment: some(true) },
      })
    )
    .sendAndConfirm(umi);

  // Then the mint was successful.
  await assertItemBought(t, umi, { gumballMachine, buyer: buyer.publicKey });

  // And the payer was charged.
  const payerBalance = await umi.rpc.getBalance(payer.publicKey);
  t.true(isEqualToAmount(payerBalance, sol(8), sol(0.1)));
});

test('it cannot mint from a gumball machine not in sale started state', async (t) => {
  // Given an empty gumball machine.
  const umi = await createUmi();

  const { publicKey: gumballMachine } = await create(umi, {
    items: [
      {
        id: (await createNft(umi)).publicKey,
        tokenStandard: TokenStandard.NonFungible,
      },
    ],
    guards: {},
  });

  // When we try to mint from it.
  const buyer = generateSigner(umi);
  const promise = transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      draw(umi, {
        gumballMachine,
        buyer,
      })
    )
    .sendAndConfirm(umi);

  // Then we expect a program error.
  await t.throwsAsync(promise, { message: /InvalidState/ });
});

test('it cannot mint from a gumball machine that has been fully minted', async (t) => {
  // Given a gumball machine that has been fully minted.
  const umi = await createUmi();

  const { publicKey: gumballMachine } = await create(umi, {
    items: [
      {
        id: (await createNft(umi)).publicKey,
        tokenStandard: TokenStandard.NonFungible,
      },
    ],
    startSale: true,
    guards: {},
  });

  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      draw(umi, {
        buyer: umi.identity,
        gumballMachine,
      })
    )
    .sendAndConfirm(umi);
  await assertItemBought(t, umi, { gumballMachine });

  // When we try to mint from it again.
  const promise = transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      draw(umi, {
        gumballMachine,
      })
    )
    .sendAndConfirm(umi);

  // Then we expect a program error.
  await t.throwsAsync(promise, { message: /InvalidState/ });
});

test('it can mint from a gumball machine in a random order', async (t) => {
  // Given a gumball machine with non-sequential config line settings.
  const umi = await createUmi();

  const indices = Array.from({ length: 5 }, (x, i) => i);
  const items = (await Promise.all(indices.map(() => createNft(umi)))).map(
    (item) => ({ id: item.publicKey, tokenStandard: TokenStandard.NonFungible })
  );

  const { publicKey: gumballMachine } = await create(umi, {
    guards: {},
  });

  await Promise.all(
    items.map((item) =>
      transactionBuilder()
        .add(
          addNft(umi, {
            gumballMachine,
            mint: item.id,
          })
        )
        .sendAndConfirm(umi)
    )
  );

  await transactionBuilder()
    .add(
      startSale(umi, {
        gumballMachine,
      })
    )
    .sendAndConfirm(umi);

  // When we mint from it.
  const minted = await drain(umi, gumballMachine, indices.length);

  // Then the mints are not sequential.
  t.notDeepEqual(indices, minted);

  // And the mints are unique.
  minted.sort((a, b) => a - b);
  t.deepEqual(indices, minted);
});

const drain = async (
  umi: Umi,
  gumballMachine: PublicKey,
  available: number
) => {
  const indices: number[] = [];

  for (let i = 0; i < available; i += 1) {
    const buyer = generateSigner(umi);
    await transactionBuilder()
      .add(setComputeUnitLimit(umi, { units: 600_000 }))
      .add(
        draw(umi, {
          gumballMachine,
          buyer,
        })
      )
      .sendAndConfirm(umi);

    const gumballMachineAccount = await fetchGumballMachine(
      umi,
      gumballMachine
    );
    const buyerItem = gumballMachineAccount.items.find(
      (item) => item.buyer === buyer.publicKey
    );
    indices.push(buyerItem?.index ?? -1);
  }

  return indices;
};
