import { setComputeUnitLimit } from '@metaplex-foundation/mpl-toolbox';
import {
  generateSigner,
  sol,
  some,
  transactionBuilder,
} from '@metaplex-foundation/umi';
import test from 'ava';
import {
  draw,
  fetchAllocationTracker,
  findAllocationTrackerPda,
  findGumballGuardPda,
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

test('it allows minting when the allocation limit is not reached', async (t) => {
  // Given a loaded Gumball Machine with an allocation limit of 5.
  const umi = await createUmi();

  const { publicKey: gumballMachine } = await create(umi, {
    items: [
      {
        id: (await createNft(umi)).publicKey,
        tokenStandard: TokenStandard.NonFungible,
      },
      {
        id: (await createNft(umi)).publicKey,
        tokenStandard: TokenStandard.NonFungible,
      },
    ],
    startSale: true,
    guards: {
      allocation: some({ id: 1, limit: 5 }),
    },
  });

  // And initialize the allocation PDA.
  await transactionBuilder()
    .add(
      route(umi, {
        gumballMachine,
        guard: 'allocation',
        routeArgs: {
          id: 1,
          gumballGuardAuthority: umi.identity,
        },
      })
    )
    .sendAndConfirm(umi);

  // When we mint from it.

  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      draw(umi, {
        gumballMachine,

        mintArgs: { allocation: some({ id: 1 }) },
      })
    )
    .sendAndConfirm(umi);

  // Then minting was successful.
  await assertItemBought(t, umi, { gumballMachine });

  // And the mint tracker PDA was incremented.
  const trackerPda = findAllocationTrackerPda(umi, {
    id: 1,
    gumballMachine,
    gumballGuard: findGumballGuardPda(umi, { base: gumballMachine })[0],
  });
  const trackerPdaAccount = await fetchAllocationTracker(umi, trackerPda);
  t.is(trackerPdaAccount.count, 1);
});

test('it forbids minting when the allocation limit is reached', async (t) => {
  // Given a loaded Gumball Machine with an allocation limit of 1.
  const umi = await createUmi();

  const { publicKey: gumballMachine } = await create(umi, {
    items: [
      {
        id: (await createNft(umi)).publicKey,
        tokenStandard: TokenStandard.NonFungible,
      },
      {
        id: (await createNft(umi)).publicKey,
        tokenStandard: TokenStandard.NonFungible,
      },
    ],
    startSale: true,
    guards: {
      allocation: some({ id: 1, limit: 1 }),
    },
  });

  // And initialize the allocation PDA.
  await transactionBuilder()
    .add(
      route(umi, {
        gumballMachine,
        guard: 'allocation',
        routeArgs: {
          id: 1,
          gumballGuardAuthority: umi.identity,
        },
      })
    )
    .sendAndConfirm(umi);

  // And we already minted from it.

  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      draw(umi, {
        gumballMachine,

        mintArgs: { allocation: some({ id: 1 }) },
      })
    )
    .sendAndConfirm(umi);

  // When we try to mint again.
  const promise = transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      draw(umi, {
        gumballMachine,

        mintArgs: { allocation: some({ id: 1 }) },
      })
    )
    .sendAndConfirm(umi);

  // Then we expect an error.
  await t.throwsAsync(promise, { message: /Allocation limit was reached/ });
});

test('the allocation limit is local to each id', async (t) => {
  // Given a loaded Gumball Machine with two allocation limits of 1.
  const umi = await createUmi();

  const { publicKey: gumballMachine } = await create(umi, {
    items: [
      {
        id: (await createNft(umi)).publicKey,
        tokenStandard: TokenStandard.NonFungible,
      },
      {
        id: (await createNft(umi)).publicKey,
        tokenStandard: TokenStandard.NonFungible,
      },
    ],
    startSale: true,
    guards: {},
    groups: [
      {
        label: 'GROUPA',
        guards: {
          allocation: some({ id: 1, limit: 1 }),
        },
      },
      {
        label: 'GROUPB',
        guards: {
          allocation: some({ id: 2, limit: 1 }),
        },
      },
    ],
  });

  // And initialize the allocation PDA.
  await transactionBuilder()
    .add(
      route(umi, {
        gumballMachine,
        guard: 'allocation',
        routeArgs: {
          id: 1,
          gumballGuardAuthority: umi.identity,
        },
        group: some('GROUPA'),
      })
    )
    .add(
      route(umi, {
        gumballMachine,
        guard: 'allocation',
        routeArgs: {
          id: 2,
          gumballGuardAuthority: umi.identity,
        },
        group: some('GROUPB'),
      })
    )
    .sendAndConfirm(umi);

  // And buyer A already minted their NFT.
  const buyerA = generateSigner(umi);
  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      draw(umi, {
        gumballMachine,
        buyer: buyerA,
        mintArgs: { allocation: some({ id: 1 }) },
        group: some('GROUPA'),
      })
    )
    .sendAndConfirm(umi);
  await assertItemBought(t, umi, { gumballMachine, buyer: buyerA.publicKey });

  // When buyer B mints from the same Gumball Machine but from a different group.
  const buyerB = generateSigner(umi);
  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      draw(umi, {
        gumballMachine,
        buyer: buyerB,
        mintArgs: { allocation: some({ id: 2 }) },
        group: some('GROUPB'),
      })
    )
    .sendAndConfirm(umi);

  // Then minting was successful as the limit is per id.
  await assertItemBought(t, umi, { gumballMachine, buyer: buyerB.publicKey });
});

test('it charges a bot tax when trying to mint after the limit', async (t) => {
  // Given a loaded Gumball Machine with an allocation limit of 1 and a bot tax guard.
  const umi = await createUmi();

  const { publicKey: gumballMachine } = await create(umi, {
    items: [
      {
        id: (await createNft(umi)).publicKey,
        tokenStandard: TokenStandard.NonFungible,
      },
      {
        id: (await createNft(umi)).publicKey,
        tokenStandard: TokenStandard.NonFungible,
      },
    ],
    startSale: true,
    guards: {
      botTax: some({ lamports: sol(0.1), lastInstruction: true }),
      allocation: some({ id: 1, limit: 1 }),
    },
  });

  // And initialize the allocation PDA.
  await transactionBuilder()
    .add(
      route(umi, {
        gumballMachine,
        guard: 'allocation',
        routeArgs: {
          id: 1,
          gumballGuardAuthority: umi.identity,
        },
      })
    )
    .sendAndConfirm(umi);

  // And the identity already minted their NFT.
  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      draw(umi, {
        gumballMachine,

        mintArgs: { allocation: some({ id: 1 }) },
      })
    )
    .sendAndConfirm(umi);

  // When the identity tries to mint from the same Gumball Machine again.
  const { signature } = await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      draw(umi, {
        gumballMachine,

        mintArgs: { allocation: some({ id: 1 }) },
      })
    )
    .sendAndConfirm(umi);

  // Then we expect a bot tax error.
  await assertBotTax(t, umi, signature, /Allocation limit was reached/);
});
