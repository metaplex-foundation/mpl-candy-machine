import {
  dateTime,
  generateSigner,
  publicKey,
  sol,
  some,
  subtractAmounts,
  transactionBuilder,
} from '@metaplex-foundation/umi';
import { generateSignerWithSol } from '@metaplex-foundation/umi-bundle-tests';
import test from 'ava';
import {
  createGumballGuard,
  emptyDefaultGuardSetArgs,
  fetchGumballGuard,
  findGumballGuardPda,
  GuardGroup,
  GuardSet,
  GumballGuard,
} from '../src';
import { createUmi } from './_setup';

test('it can create a gumball guard without guards', async (t) => {
  // Given a base address.
  const umi = await createUmi();
  const base = generateSigner(umi);

  // When we create a new gumball guard without guards.
  await transactionBuilder()
    .add(createGumballGuard(umi, { base }))
    .sendAndConfirm(umi);

  // Then a new gumball guard account was created with the expected data.
  const gumballGuard = findGumballGuardPda(umi, { base: base.publicKey });
  const gumballGuardAccount = await fetchGumballGuard(umi, gumballGuard);
  t.like(gumballGuardAccount, <GumballGuard>{
    publicKey: publicKey(gumballGuard),
    base: publicKey(base),
    authority: publicKey(umi.identity),
    guards: emptyDefaultGuardSetArgs,
    groups: [] as GuardGroup<GuardSet>[],
  });
});

test('it can create a gumball guard with guards', async (t) => {
  // Given a base address.
  const umi = await createUmi();
  const base = generateSigner(umi);

  // When we create a new gumball guard with guards.
  const gatekeeperNetwork = generateSigner(umi).publicKey;
  const tokenMint = generateSigner(umi).publicKey;
  await transactionBuilder()
    .add(
      createGumballGuard(umi, {
        base,
        guards: {
          botTax: some({ lamports: sol(0.001), lastInstruction: true }),
          solPayment: some({ lamports: sol(1.5) }),
          startDate: some({ date: '2023-03-07T16:13:00.000Z' }),
          endDate: some({ date: '2023-03-08T16:13:00.000Z' }),
          gatekeeper: some({ gatekeeperNetwork, expireOnUse: true }),
          tokenPayment: some({
            amount: 42,
            mint: tokenMint,
          }),
        },
      })
    )
    .sendAndConfirm(umi);

  // Then a new gumball guard account was created with the expected data.
  const gumballGuard = findGumballGuardPda(umi, { base: base.publicKey });
  const gumballGuardAccount = await fetchGumballGuard(umi, gumballGuard);
  t.like(gumballGuardAccount, <GumballGuard>{
    publicKey: publicKey(gumballGuard),
    base: publicKey(base),
    authority: publicKey(umi.identity),
    guards: {
      ...emptyDefaultGuardSetArgs,
      botTax: some({ lamports: sol(0.001), lastInstruction: true }),
      solPayment: some({ lamports: sol(1.5) }),
      startDate: some({ date: dateTime('2023-03-07T16:13:00.000Z') }),
      endDate: some({ date: dateTime('2023-03-08T16:13:00.000Z') }),
      gatekeeper: some({ gatekeeperNetwork, expireOnUse: true }),
      tokenPayment: some({
        amount: 42n,
        mint: tokenMint,
      }),
    },
    groups: [] as GuardGroup<GuardSet>[],
  });
});

test('it can create a gumball guard with guard groups', async (t) => {
  // Given a base address.
  const umi = await createUmi();
  const base = generateSigner(umi);

  // When we create a new gumball guard with guard groups.
  const gatekeeperNetwork = generateSigner(umi).publicKey;
  const tokenGateMint = generateSigner(umi).publicKey;
  const merkleRoot = new Uint8Array(Array(32).fill(42));
  await transactionBuilder()
    .add(
      createGumballGuard(umi, {
        base,
        guards: {
          // Bot tax for all groups.
          botTax: some({ lamports: sol(0.01), lastInstruction: false }),
          // Mint finished after 24h for all groups.
          endDate: some({ date: '2022-09-06T16:00:00.000Z' }),
        },
        groups: [
          {
            // First group for VIPs.
            label: 'VIP',
            guards: {
              startDate: some({ date: '2022-09-05T16:00:00.000Z' }),
              allowList: some({ merkleRoot }),
              solPayment: some({
                lamports: sol(1),
              }),
            },
          },
          {
            // Second group for whitelist token holders.
            label: 'WLIST',
            guards: {
              startDate: some({ date: '2022-09-05T18:00:00.000Z' }),
              tokenGate: some({ mint: tokenGateMint, amount: 1 }),
              solPayment: some({
                lamports: sol(2),
              }),
            },
          },
          {
            // Third group for the public.
            label: 'PUBLIC',
            guards: {
              startDate: some({ date: '2022-09-05T20:00:00.000Z' }),
              gatekeeper: some({ gatekeeperNetwork, expireOnUse: false }),
              solPayment: some({
                lamports: sol(3),
              }),
            },
          },
        ],
      })
    )
    .sendAndConfirm(umi);

  // Then a new gumball guard account was created with the expected data.
  const gumballGuard = findGumballGuardPda(umi, { base: base.publicKey });
  const gumballGuardAccount = await fetchGumballGuard(umi, gumballGuard);
  t.like(gumballGuardAccount, <GumballGuard>{
    publicKey: publicKey(gumballGuard),
    guards: {
      ...emptyDefaultGuardSetArgs,
      botTax: some({ lamports: sol(0.01), lastInstruction: false }),
      endDate: some({ date: dateTime('2022-09-06T16:00:00.000Z') }),
    },
    groups: [
      {
        label: 'VIP',
        guards: {
          ...emptyDefaultGuardSetArgs,
          startDate: some({ date: dateTime('2022-09-05T16:00:00.000Z') }),
          allowList: some({ merkleRoot }),
          solPayment: some({
            lamports: sol(1),
          }),
        },
      },
      {
        label: 'WLIST',
        guards: {
          ...emptyDefaultGuardSetArgs,
          startDate: some({ date: dateTime('2022-09-05T18:00:00.000Z') }),
          tokenGate: some({ mint: tokenGateMint, amount: 1n }),
          solPayment: some({
            lamports: sol(2),
          }),
        },
      },
      {
        label: 'PUBLIC',
        guards: {
          ...emptyDefaultGuardSetArgs,
          startDate: some({ date: dateTime('2022-09-05T20:00:00.000Z') }),
          gatekeeper: some({ gatekeeperNetwork, expireOnUse: false }),
          solPayment: some({
            lamports: sol(3),
          }),
        },
      },
    ] as GuardGroup<GuardSet>[],
  });
});

test('it fails to create a group with a label that is too long', async (t) => {
  // Given a base address.
  const umi = await createUmi();
  const base = generateSigner(umi);

  // When we try to create a new Gumball Guard with a group label that is too long.
  const createInstruction = () =>
    createGumballGuard(umi, {
      base,
      guards: {},
      groups: [{ label: 'IAMALABELTHATISTOOLONG', guards: {} }],
    });

  // Then we expect a program error.
  t.throws(createInstruction, {
    message: /The provided group label \[IAMALABELTHATISTOOLONG\] is too long/,
  });
});

test('it can create a gumball guard with an explicit authority', async (t) => {
  // Given a base address and an explicit authority.
  const umi = await createUmi();
  const base = generateSigner(umi);
  const authority = generateSigner(umi).publicKey;

  // When we create a new Gumball Guard using that authority.
  await transactionBuilder()
    .add(createGumballGuard(umi, { base, authority }))
    .sendAndConfirm(umi);

  // Then we expect the Gumball Guard's authority to be the given authority.
  const gumballGuard = findGumballGuardPda(umi, { base: base.publicKey });
  const gumballGuardAccount = await fetchGumballGuard(umi, gumballGuard);
  t.like(gumballGuardAccount, <GumballGuard>{
    publicKey: publicKey(gumballGuard),
    base: publicKey(base),
    authority: publicKey(authority),
  });
});

test('it can create a gumball guard with an explicit payer', async (t) => {
  // Given a base address and an explicit payer with SOLs.
  const umi = await createUmi();
  const base = generateSigner(umi);
  const payer = await generateSignerWithSol(umi);
  const payerBalance = await umi.rpc.getBalance(payer.publicKey);

  // When we create a new Gumball Guard using that authority.
  const builder = transactionBuilder().add(
    createGumballGuard(umi, { base, payer })
  );
  await builder.sendAndConfirm(umi);

  // Then the Gumball Guard was created successfully.
  const [gumballGuard] = findGumballGuardPda(umi, { base: base.publicKey });
  t.true(await umi.rpc.accountExists(gumballGuard));

  // And the payer paid for the rent.
  const newPayerBalance = await umi.rpc.getBalance(payer.publicKey);
  const expectedRent = await builder.getRentCreatedOnChain(umi);
  t.deepEqual(newPayerBalance, subtractAmounts(payerBalance, expectedRent));
});
