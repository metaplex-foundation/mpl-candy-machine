import { setComputeUnitLimit } from '@metaplex-foundation/mpl-toolbox';
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
  fetchMintCounter,
  findGumballGuardPda,
  findMintCounterPda,
  TokenStandard,
} from '../../src';
import {
  assertBotTax,
  assertItemBought,
  create,
  createNft,
  createUmi,
} from '../_setup';

test('it allows minting when the mint limit is not reached', async (t) => {
  // Given a loaded Gumball Machine with a mint limit of 5.
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
      mintLimit: some({ id: 1, limit: 5 }),
    },
  });

  // When we mint from it.

  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      draw(umi, {
        gumballMachine,

        mintArgs: { mintLimit: some({ id: 1 }) },
      })
    )
    .sendAndConfirm(umi);

  // Then minting was successful.
  await assertItemBought(t, umi, { gumballMachine });

  // And the mint limit PDA was incremented.
  const counterPda = findMintCounterPda(umi, {
    id: 1,
    user: umi.identity.publicKey,
    gumballMachine,
    gumballGuard: findGumballGuardPda(umi, { base: gumballMachine })[0],
  });
  const counterAccount = await fetchMintCounter(umi, counterPda);
  t.is(counterAccount.count, 1);
});

test('it allows minting even when the payer is different from the buyer', async (t) => {
  // Given a loaded Gumball Machine with a mint limit of 5.
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
      mintLimit: some({ id: 1, limit: 5 }),
    },
  });

  // When we mint from it using a separate buyer.
  const buyer = generateSigner(umi);

  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      draw(umi, {
        gumballMachine,

        buyer,

        mintArgs: { mintLimit: some({ id: 1 }) },
      })
    )
    .sendAndConfirm(umi);

  // Then minting was successful.
  await assertItemBought(t, umi, { gumballMachine, buyer: publicKey(buyer) });

  // And the mint limit PDA was incremented for that buyer.
  const counterPda = findMintCounterPda(umi, {
    id: 1,
    user: buyer.publicKey,
    gumballMachine,
    gumballGuard: findGumballGuardPda(umi, { base: gumballMachine })[0],
  });
  const counterAccount = await fetchMintCounter(umi, counterPda);
  t.is(counterAccount.count, 1);
});

test('it forbids minting when the mint limit is reached', async (t) => {
  // Given a loaded Gumball Machine with a mint limit of 1.
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
      mintLimit: some({ id: 42, limit: 1 }),
    },
  });

  // And the identity already minted their NFT.

  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      draw(umi, {
        gumballMachine,

        mintArgs: { mintLimit: some({ id: 42 }) },
      })
    )
    .sendAndConfirm(umi);

  // When that same identity tries to mint from the same Gumball Machine again.
  const promise = transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      draw(umi, {
        gumballMachine,
        mintArgs: { mintLimit: some({ id: 42 }) },
      })
    )
    .sendAndConfirm(umi);

  // Then we expect an error.
  await t.throwsAsync(promise, { message: /AllowedMintLimitReached/ });
});

test('the mint limit is local to each wallet', async (t) => {
  // Given a loaded Gumball Machine with a mint limit of 1.
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
      mintLimit: some({ id: 42, limit: 1 }),
    },
  });

  // And buyer A already minted their NFT.
  const buyerA = generateSigner(umi);

  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      draw(umi, {
        gumballMachine,

        buyer: buyerA,

        mintArgs: { mintLimit: some({ id: 42 }) },
      })
    )
    .sendAndConfirm(umi);
  await assertItemBought(t, umi, { gumballMachine, buyer: publicKey(buyerA) });

  // When buyer B mints from the same Gumball Machine.
  const buyerB = generateSigner(umi);

  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      draw(umi, {
        gumballMachine,

        buyer: buyerB,

        mintArgs: { mintLimit: some({ id: 42 }) },
      })
    )
    .sendAndConfirm(umi);

  // Then minting was successful as the limit is per wallet.
  await assertItemBought(t, umi, { gumballMachine, buyer: publicKey(buyerB) });
});

test('it charges a bot tax when trying to mint after the limit', async (t) => {
  // Given a loaded Gumball Machine with a mint limit of 1 and a bot tax guard.
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
      mintLimit: some({ id: 42, limit: 1 }),
    },
  });

  // And the identity already minted their NFT.

  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      draw(umi, {
        gumballMachine,

        mintArgs: { mintLimit: some({ id: 42 }) },
      })
    )
    .sendAndConfirm(umi);

  // When the identity tries to mint from the same Gumball Machine again.

  const { signature } = await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      draw(umi, {
        gumballMachine,

        mintArgs: { mintLimit: some({ id: 42 }) },
      })
    )
    .sendAndConfirm(umi);

  // Then we expect a bot tax error.
  await assertBotTax(t, umi, signature, /AllowedMintLimitReached/);
});
