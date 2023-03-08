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
  emptyDefaultGuardSetArgs,
  fetchCandyGuard,
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
  await transactionBuilder(umi)
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
    .sendAndConfirm();

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
