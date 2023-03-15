import {
  dateTime,
  generateSigner,
  sol,
  some,
  transactionBuilder,
} from '@metaplex-foundation/umi';
import test from 'ava';
import {
  CandyGuard,
  CandyGuardDataArgs,
  DefaultGuardSet,
  DefaultGuardSetArgs,
  emptyDefaultGuardSetArgs,
  fetchCandyGuard,
  GuardGroup,
  updateCandyGuard,
} from '../src';
import { createCandyGuard, createUmi } from './_setup';

test('it can update the guards of a candy guard', async (t) => {
  // Given an existing candy guard.
  const umi = await createUmi();
  const treasuryA = generateSigner(umi).publicKey;
  const candyGuard = await createCandyGuard(umi, {
    guards: {
      botTax: some({ lamports: sol(0.01), lastInstruction: true }),
    },
    groups: [
      {
        label: 'OLD1',
        guards: {
          startDate: some({ date: '2022-09-13T10:00:00.000Z' }),
          solPayment: some({ lamports: sol(2), destination: treasuryA }),
        },
      },
      {
        label: 'OLD2',
        guards: {
          startDate: some({ date: '2022-09-13T12:00:00.000Z' }),
          solPayment: some({ lamports: sol(4), destination: treasuryA }),
        },
      },
    ],
  });

  // When we update all its guards — defaults and groups.
  const treasuryB = generateSigner(umi).publicKey;
  await transactionBuilder()
    .add(
      updateCandyGuard(umi, {
        candyGuard,
        guards: {
          botTax: some({ lamports: sol(0.02), lastInstruction: false }),
        },
        groups: [
          {
            label: 'NEW1',
            guards: {
              startDate: some({ date: '2022-09-15T10:00:00.000Z' }),
              solPayment: some({ lamports: sol(1), destination: treasuryB }),
              endDate: some({ date: '2022-09-15T12:00:00.000Z' }),
            },
          },
          {
            label: 'NEW2',
            guards: {
              startDate: some({ date: '2022-09-15T12:00:00.000Z' }),
              solPayment: some({ lamports: sol(3), destination: treasuryB }),
            },
          },
        ],
      })
    )
    .sendAndConfirm(umi);

  // Then all guards were updated as expected.
  const candyGuardAccount = await fetchCandyGuard(umi, candyGuard);
  t.like(candyGuardAccount, <CandyGuard>{
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
          solPayment: some({ lamports: sol(1), destination: treasuryB }),
          endDate: some({ date: dateTime('2022-09-15T12:00:00.000Z') }),
        },
      },
      {
        label: 'NEW2',
        guards: {
          ...emptyDefaultGuardSetArgs,
          startDate: some({ date: dateTime('2022-09-15T12:00:00.000Z') }),
          solPayment: some({ lamports: sol(3), destination: treasuryB }),
        },
      },
    ],
  });
});

test('it can remove all guards from a candy guard', async (t) => {
  // Given an existing candy guard with defaults guards and groups.
  const umi = await createUmi();
  const destination = generateSigner(umi).publicKey;
  const candyGuard = await createCandyGuard(umi, {
    guards: {
      botTax: some({ lamports: sol(0.01), lastInstruction: true }),
    },
    groups: [
      {
        label: 'OLD1',
        guards: {
          startDate: some({ date: '2022-09-13T10:00:00.000Z' }),
          solPayment: some({ lamports: sol(2), destination }),
        },
      },
      {
        label: 'OLD2',
        guards: {
          startDate: some({ date: '2022-09-13T12:00:00.000Z' }),
          solPayment: some({ lamports: sol(4), destination }),
        },
      },
    ],
  });

  // When we update it so that it has no guards.
  await transactionBuilder()
    .add(updateCandyGuard(umi, { candyGuard, guards: {}, groups: [] }))
    .sendAndConfirm(umi);

  // Then all guards were removed as expected.
  const candyGuardAccount = await fetchCandyGuard(umi, candyGuard);
  t.like(candyGuardAccount, <CandyGuard>{
    guards: emptyDefaultGuardSetArgs,
    groups: [] as GuardGroup<DefaultGuardSet>[],
  });
});

test('it can update a single guard by passing the current data', async (t) => {
  // Given an existing candy guard with defaults guards and groups.
  const umi = await createUmi();
  const destination = generateSigner(umi).publicKey;
  const candyGuard = await createCandyGuard(umi, {
    guards: {
      botTax: some({ lamports: sol(0.01), lastInstruction: true }),
    },
    groups: [
      {
        label: 'GROUP1',
        guards: {
          startDate: some({ date: '2022-09-13T10:00:00.000Z' }),
          solPayment: some({ lamports: sol(2), destination }),
        },
      },
      {
        label: 'GROUP2',
        guards: {
          startDate: some({ date: '2022-09-13T12:00:00.000Z' }),
          solPayment: some({ lamports: sol(4), destination }),
        },
      },
    ],
  });

  // And we have access to the data of that candy guard.
  const { guards, groups } = (await fetchCandyGuard(
    umi,
    candyGuard
  )) as CandyGuardDataArgs<DefaultGuardSetArgs>;

  // When we update one guard from one group and pass in the rest of the data.
  groups[1].guards.startDate = some({ date: '2022-09-13T14:00:00.000Z' });
  await transactionBuilder()
    .add(updateCandyGuard(umi, { candyGuard, guards, groups }))
    .sendAndConfirm(umi);

  // Then only that guard was updated.
  const candyGuardAccount = await fetchCandyGuard(umi, candyGuard);
  t.like(candyGuardAccount, <CandyGuard>{
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
          solPayment: some({ lamports: sol(2), destination }),
        },
      },
      {
        label: 'GROUP2',
        guards: {
          ...emptyDefaultGuardSetArgs,
          startDate: some({ date: dateTime('2022-09-13T14:00:00.000Z') }), // <-- This was updated.
          solPayment: some({ lamports: sol(4), destination }),
        },
      },
    ],
  });
});
