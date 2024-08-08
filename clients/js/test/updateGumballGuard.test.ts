import {
  dateTime,
  sol,
  some,
  transactionBuilder,
} from '@metaplex-foundation/umi';
import test from 'ava';
import {
  DefaultGuardSet,
  DefaultGuardSetArgs,
  emptyDefaultGuardSetArgs,
  fetchGumballGuard,
  findGumballGuardPda,
  GuardGroup,
  GumballGuard,
  GumballGuardDataArgs,
  updateGumballGuard,
} from '../src';
import { create, createUmi } from './_setup';

test('it can update the guards of a gumball guard', async (t) => {
  // Given an existing gumball guard.
  const umi = await createUmi();
  const gumballMachine = (
    await create(umi, {
      guards: {
        botTax: some({ lamports: sol(0.01), lastInstruction: true }),
      },
      groups: [
        {
          label: 'OLD1',
          guards: {
            startDate: some({ date: '2022-09-13T10:00:00.000Z' }),
            solPayment: some({ lamports: sol(2) }),
          },
        },
        {
          label: 'OLD2',
          guards: {
            startDate: some({ date: '2022-09-13T12:00:00.000Z' }),
            solPayment: some({ lamports: sol(4) }),
          },
        },
      ],
    })
  ).publicKey;

  const gumballGuard = findGumballGuardPda(umi, { base: gumballMachine })[0];

  // When we update all its guards — defaults and groups.
  await transactionBuilder()
    .add(
      updateGumballGuard(umi, {
        gumballMachine,
        gumballGuard,
        guards: {
          botTax: some({ lamports: sol(0.02), lastInstruction: false }),
        },
        groups: [
          {
            label: 'NEW1',
            guards: {
              startDate: some({ date: '2022-09-15T10:00:00.000Z' }),
              solPayment: some({ lamports: sol(1) }),
              endDate: some({ date: '2022-09-15T12:00:00.000Z' }),
            },
          },
          {
            label: 'NEW2',
            guards: {
              startDate: some({ date: '2022-09-15T12:00:00.000Z' }),
              solPayment: some({ lamports: sol(3) }),
            },
          },
        ],
      })
    )
    .sendAndConfirm(umi);

  // Then all guards were updated as expected.
  const gumballGuardAccount = await fetchGumballGuard(umi, gumballGuard);
  t.like(gumballGuardAccount, <GumballGuard>{
    guards: {
      ...emptyDefaultGuardSetArgs,
      botTax: some({ lamports: sol(0.02), lastInstruction: false }),
    },
    groups: [
      {
        label: 'NEW1',
        guards: {
          ...emptyDefaultGuardSetArgs,
          startDate: some({ date: dateTime('2022-09-15T10:00:00.000Z') }),
          solPayment: some({ lamports: sol(1) }),
          endDate: some({ date: dateTime('2022-09-15T12:00:00.000Z') }),
        },
      },
      {
        label: 'NEW2',
        guards: {
          ...emptyDefaultGuardSetArgs,
          startDate: some({ date: dateTime('2022-09-15T12:00:00.000Z') }),
          solPayment: some({ lamports: sol(3) }),
        },
      },
    ],
  });
});

test('it can remove all guards from a gumball guard', async (t) => {
  // Given an existing gumball guard with defaults guards and groups.
  const umi = await createUmi();
  const gumballMachine = (
    await create(umi, {
      guards: {
        botTax: some({ lamports: sol(0.01), lastInstruction: true }),
      },
      groups: [
        {
          label: 'OLD1',
          guards: {
            startDate: some({ date: '2022-09-13T10:00:00.000Z' }),
            solPayment: some({ lamports: sol(2) }),
          },
        },
        {
          label: 'OLD2',
          guards: {
            startDate: some({ date: '2022-09-13T12:00:00.000Z' }),
            solPayment: some({ lamports: sol(4) }),
          },
        },
      ],
    })
  ).publicKey;

  const gumballGuard = findGumballGuardPda(umi, { base: gumballMachine })[0];

  // When we update it so that it has no guards.
  await transactionBuilder()
    .add(
      updateGumballGuard(umi, {
        gumballMachine,
        gumballGuard,
        guards: {},
        groups: [],
      })
    )
    .sendAndConfirm(umi);

  // Then all guards were removed as expected.
  const gumballGuardAccount = await fetchGumballGuard(umi, gumballGuard);
  t.like(gumballGuardAccount, <GumballGuard>{
    guards: emptyDefaultGuardSetArgs,
    groups: [] as GuardGroup<DefaultGuardSet>[],
  });
});

test('it can update a single guard by passing the current data', async (t) => {
  // Given an existing gumball guard with defaults guards and groups.
  const umi = await createUmi();
  const gumballMachine = (
    await create(umi, {
      guards: {
        botTax: some({ lamports: sol(0.01), lastInstruction: true }),
      },
      groups: [
        {
          label: 'GROUP1',
          guards: {
            startDate: some({ date: '2022-09-13T10:00:00.000Z' }),
            solPayment: some({ lamports: sol(2) }),
          },
        },
        {
          label: 'GROUP2',
          guards: {
            startDate: some({ date: '2022-09-13T12:00:00.000Z' }),
            solPayment: some({ lamports: sol(4) }),
          },
        },
      ],
    })
  ).publicKey;

  const gumballGuard = findGumballGuardPda(umi, { base: gumballMachine })[0];

  // And we have access to the data of that gumball guard.
  const { guards, groups } = (await fetchGumballGuard(
    umi,
    gumballGuard
  )) as GumballGuardDataArgs<DefaultGuardSetArgs>;

  // When we update one guard from one group and pass in the rest of the data.
  groups[1].guards.startDate = some({ date: '2022-09-13T14:00:00.000Z' });
  await transactionBuilder()
    .add(
      updateGumballGuard(umi, { gumballMachine, gumballGuard, guards, groups })
    )
    .sendAndConfirm(umi);

  // Then only that guard was updated.
  const gumballGuardAccount = await fetchGumballGuard(umi, gumballGuard);
  t.like(gumballGuardAccount, <GumballGuard>{
    guards: {
      ...emptyDefaultGuardSetArgs,
      botTax: some({ lamports: sol(0.01), lastInstruction: true }),
    },
    groups: [
      {
        label: 'GROUP1',
        guards: {
          ...emptyDefaultGuardSetArgs,
          startDate: some({ date: dateTime('2022-09-13T10:00:00.000Z') }),
          solPayment: some({ lamports: sol(2) }),
        },
      },
      {
        label: 'GROUP2',
        guards: {
          ...emptyDefaultGuardSetArgs,
          startDate: some({ date: dateTime('2022-09-13T14:00:00.000Z') }), // <-- This was updated.
          solPayment: some({ lamports: sol(4) }),
        },
      },
    ],
  });
});
