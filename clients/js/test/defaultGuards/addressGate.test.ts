import { setComputeUnitLimit } from '@metaplex-foundation/mpl-toolbox';
import {
  generateSigner,
  sol,
  some,
  transactionBuilder,
} from '@metaplex-foundation/umi';
import test from 'ava';
import { draw, TokenStandard } from '../../src';
import {
  assertBotTax,
  assertItemBought,
  create,
  createNft,
  createUmi,
} from '../_setup';

test('it allows minting from a specific address only', async (t) => {
  // Given a loaded Gumball Machine with an addressGate guard.
  const umi = await createUmi();
  const allowedAddress = generateSigner(umi);
  const { publicKey: gumballMachine } = await create(umi, {
    items: [
      {
        id: (await createNft(umi)).publicKey,
        tokenStandard: TokenStandard.NonFungible,
      },
    ],
    startSale: true,
    guards: {
      addressGate: some({ address: allowedAddress.publicKey }),
    },
  });

  // When the allowed address mints from it.

  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      draw(umi, {
        gumballMachine,
        buyer: allowedAddress,
      })
    )
    .sendAndConfirm(umi);

  // Then minting was successful.
  await assertItemBought(t, umi, {
    gumballMachine,
    buyer: allowedAddress.publicKey,
  });
});

test('it forbids minting from anyone else', async (t) => {
  // Given a gumball machine with an addressGate guard.
  const umi = await createUmi();

  const { publicKey: gumballMachine } = await create(umi, {
    items: [
      {
        id: (await createNft(umi)).publicKey,
        tokenStandard: TokenStandard.NonFungible,
      },
    ],
    startSale: true,
    guards: {
      addressGate: some({ address: generateSigner(umi).publicKey }),
    },
  });

  // When another wallet tries to mint from it.
  const unauthorizedMinter = generateSigner(umi);
  const promise = transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      draw(umi, {
        gumballMachine,
        buyer: unauthorizedMinter,
      })
    )
    .sendAndConfirm(umi);

  // Then we expect a program error.
  await t.throwsAsync(promise, { message: /AddressNotAuthorized/ });
});

test('it charges a bot tax when trying to mint using the wrong address', async (t) => {
  // Given a gumball machine with an addressGate guard and a bot tax.
  const umi = await createUmi();

  const { publicKey: gumballMachine } = await create(umi, {
    items: [
      {
        id: (await createNft(umi)).publicKey,
        tokenStandard: TokenStandard.NonFungible,
      },
    ],
    startSale: true,
    guards: {
      botTax: some({ lamports: sol(0.01), lastInstruction: true }),
      addressGate: some({ address: generateSigner(umi).publicKey }),
    },
  });

  // When another wallet tries to mint from it.

  const unauthorizedMinter = generateSigner(umi);
  const { signature } = await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      draw(umi, {
        gumballMachine,
        buyer: unauthorizedMinter,
      })
    )
    .sendAndConfirm(umi);

  // Then we expect a silent bot tax error.
  await assertBotTax(t, umi, signature, /AddressNotAuthorized/);
});
