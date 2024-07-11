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
  createCollectionNft,
  createUmi,
  createV2,
  getNewConfigLine,
} from '../_setup';

test('it allows minting when the third party signer is provided', async (t) => {
  // Given a loaded Candy Machine with a third party signer guard.
  const umi = await createUmi();
  const thirdPartySigner = generateSigner(umi);

  const { publicKey: candyMachine } = await createV2(umi, {
    configLines: [await getNewConfigLine(umi)],
    guards: {
      thirdPartySigner: some({ signerKey: thirdPartySigner.publicKey }),
    },
  });

  // When we mint from it by providing the third party as a Signer.

  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      mintV2(umi, {
        candyMachine,

        mintArgs: {
          thirdPartySigner: some({ signer: thirdPartySigner }),
        },
      })
    )
    .sendAndConfirm(umi);

  // Then minting was successful.
  await assertItemBought(t, umi, { candyMachine });
});

test('it forbids minting when the third party signer is wrong', async (t) => {
  // Given a loaded Candy Machine with a third party signer guard.
  const umi = await createUmi();
  const thirdPartySigner = generateSigner(umi);

  const { publicKey: candyMachine } = await createV2(umi, {
    configLines: [await getNewConfigLine(umi)],
    guards: {
      thirdPartySigner: some({ signerKey: thirdPartySigner.publicKey }),
    },
  });

  // When we try to mint from it by providing the wrong third party signer.
  const wrongThirdPartySigner = generateSigner(umi);

  const promise = transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      mintV2(umi, {
        candyMachine,

        mintArgs: {
          thirdPartySigner: some({ signer: wrongThirdPartySigner }),
        },
      })
    )
    .sendAndConfirm(umi);

  // Then we expect an error.
  await t.throwsAsync(promise, { message: /MissingRequiredSignature/ });
});

test('it charges a bot tax when trying to mint using the wrong third party signer', async (t) => {
  // Given a loaded Candy Machine with a third party signer guard and a bot tax guard.
  const umi = await createUmi();
  const thirdPartySigner = generateSigner(umi);

  const { publicKey: candyMachine } = await createV2(umi, {
    configLines: [await getNewConfigLine(umi)],
    guards: {
      botTax: some({ lamports: sol(0.1), lastInstruction: true }),
      thirdPartySigner: some({ signerKey: thirdPartySigner.publicKey }),
    },
  });

  // When we try to mint from it by providing the wrong third party signer.
  const wrongThirdPartySigner = generateSigner(umi);

  const { signature } = await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      mintV2(umi, {
        candyMachine,

        mintArgs: {
          thirdPartySigner: some({ signer: wrongThirdPartySigner }),
        },
      })
    )
    .sendAndConfirm(umi);

  // Then we expect a silent bot tax error.
  await assertBotTax(t, umi, signature, /MissingRequiredSignature/);
});
