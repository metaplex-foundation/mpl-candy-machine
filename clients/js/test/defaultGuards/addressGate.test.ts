import { setComputeUnitLimit } from '@metaplex-foundation/mpl-toolbox';
import {
  generateSigner,
  sol,
  some,
  transactionBuilder,
} from '@metaplex-foundation/umi';
import test from 'ava';
import { mintV2 } from '../../src';
import {
  assertBotTax,
  assertItemBought,
  createUmi,
  createV2,
  getNewConfigLine,
} from '../_setup';

test('it allows minting from a specific address only', async (t) => {
  // Given a loaded Candy Machine with an addressGate guard.
  const umi = await createUmi();
  const allowedAddress = generateSigner(umi);
  const { publicKey: candyMachine } = await createV2(umi, {
    configLines: [await getNewConfigLine(umi)],
    guards: {
      addressGate: some({ address: allowedAddress.publicKey }),
    },
  });

  // When the allowed address mints from it.

  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      mintV2(umi, {
        candyMachine,
        buyer: allowedAddress,
      })
    )
    .sendAndConfirm(umi);

  // Then minting was successful.
  await assertItemBought(t, umi, {
    candyMachine,
    buyer: allowedAddress.publicKey,
  });
});

test('it forbids minting from anyone else', async (t) => {
  // Given a candy machine with an addressGate guard.
  const umi = await createUmi();

  const { publicKey: candyMachine } = await createV2(umi, {
    configLines: [await getNewConfigLine(umi)],
    guards: {
      addressGate: some({ address: generateSigner(umi).publicKey }),
    },
  });

  // When another wallet tries to mint from it.
  const unauthorizedMinter = generateSigner(umi);
  const promise = transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      mintV2(umi, {
        candyMachine,
        buyer: unauthorizedMinter,
      })
    )
    .sendAndConfirm(umi);

  // Then we expect a program error.
  await t.throwsAsync(promise, { message: /AddressNotAuthorized/ });
});

test('it charges a bot tax when trying to mint using the wrong address', async (t) => {
  // Given a candy machine with an addressGate guard and a bot tax.
  const umi = await createUmi();

  const { publicKey: candyMachine } = await createV2(umi, {
    configLines: [await getNewConfigLine(umi)],
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
      mintV2(umi, {
        candyMachine,
        buyer: unauthorizedMinter,
      })
    )
    .sendAndConfirm(umi);

  // Then we expect a silent bot tax error.
  await assertBotTax(t, umi, signature, /AddressNotAuthorized/);
});
