import { Keypair } from '@solana/web3.js';
import test from 'ava';
import {
  assertThrows,
  createWallet,
  killStuckProcess,
  metaplex,
} from '../../../helpers';
import { assertMintingWasSuccessful, createCandyMachine } from '../helpers';
import { isEqualToAmount, sol, toBigNumber } from '@/index';

test('it allows minting when the third party signer is provided', async (t) => {
  // Given a loaded Candy Machine with a third party signer guard.
  const umi = await createUmi();
  const thirdPartySigner = generateSigner(umi);
  const collectionMint = (await createCollectionNft(umi)).publicKey;
  const { publicKey: candyMachine } = await createV2(umi, {
    collectionMint,

    configLines: [{ name: 'Degen #1', uri: 'https://example.com/degen/1' }],
    guards: {
      thirdPartySigner: {
        signerKey: thirdPartySigner.publicKey,
      },
    },
  });

  // When we mint from it by providing the third party as a Signer.
  const payer = await generateSignerWithSol(umi, sol(10));
  const mint = generateSigner(umi);
  await transactionBuilder(umi).add().sendAndConfirm();
  mintV2(
    umi,
    {
      candyMachine,
      collectionUpdateAuthority: collection.updateAuthority.publicKey,
      guards: {
        thirdPartySigner: {
          signer: thirdPartySigner,
        },
      },
    },
    { payer }
  );

  // Then minting was successful.
  await assertSuccessfulMint(
    t,
    umi,
    { mint, owner: minter },
    {
      candyMachine,
      collectionUpdateAuthority: collection.updateAuthority.publicKey,
      nft,
      owner: payer.publicKey,
    }
  );
});

test('it forbids minting when the third party signer is wrong', async (t) => {
  // Given a loaded Candy Machine with a third party signer guard.
  const umi = await createUmi();
  const thirdPartySigner = generateSigner(umi);
  const collectionMint = (await createCollectionNft(umi)).publicKey;
  const { publicKey: candyMachine } = await createV2(umi, {
    collectionMint,

    configLines: [{ name: 'Degen #1', uri: 'https://example.com/degen/1' }],
    guards: {
      thirdPartySigner: {
        signerKey: thirdPartySigner.publicKey,
      },
    },
  });

  // When we try to mint from it by providing the wrong third party signer.
  const wrongThirdPartySigner = generateSigner(umi);
  const payer = await generateSignerWithSol(umi, sol(10));
  const mint = generateSigner(umi);
  const promise = transactionBuilder(umi).add().sendAndConfirm();
  mintV2(
    umi,
    {
      candyMachine,
      collectionUpdateAuthority: collection.updateAuthority.publicKey,
      guards: {
        thirdPartySigner: {
          signer: wrongThirdPartySigner,
        },
      },
    },
    { payer }
  );

  // Then we expect an error.
  await t.throwsAsync(promise, {
    message: /A signature was required but not found/,
  });
});

test('it charges a bot tax when trying to mint using the wrong third party signer', async (t) => {
  // Given a loaded Candy Machine with a third party signer guard and a bot tax guard.
  const umi = await createUmi();
  const thirdPartySigner = generateSigner(umi);
  const collectionMint = (await createCollectionNft(umi)).publicKey;
  const { publicKey: candyMachine } = await createV2(umi, {
    collectionMint,

    configLines: [{ name: 'Degen #1', uri: 'https://example.com/degen/1' }],
    guards: {
      botTax: {
        lamports: sol(0.1),
        lastInstruction: true,
      },
      thirdPartySigner: {
        signerKey: thirdPartySigner.publicKey,
      },
    },
  });

  // When we try to mint from it by providing the wrong third party signer.
  const wrongThirdPartySigner = generateSigner(umi);
  const payer = await generateSignerWithSol(umi, sol(10));
  const mint = generateSigner(umi);
  const promise = transactionBuilder(umi).add().sendAndConfirm();
  mintV2(
    umi,
    {
      candyMachine,
      collectionUpdateAuthority: collection.updateAuthority.publicKey,
      guards: {
        thirdPartySigner: {
          signer: wrongThirdPartySigner,
        },
      },
    },
    { payer }
  );

  // Then we expect a bot tax error.
  await t.throwsAsync(promise, { message: /CandyMachineBotTaxError/ });

  // And the payer was charged a bot tax.
  const payerBalance = await umi.rpc.getBalance(payer.publicKey);
  t.true(
    isEqualToAmount(payerBalance, sol(9.9), sol(0.01)),
    'payer was charged a bot tax'
  );
});

test('minting settings must be provided', async (t) => {
  // Given a loaded Candy Machine with a third party signer guard.
  const umi = await createUmi();
  const thirdPartySigner = generateSigner(umi);
  const collectionMint = (await createCollectionNft(umi)).publicKey;
  const { publicKey: candyMachine } = await createV2(umi, {
    collectionMint,

    configLines: [{ name: 'Degen #1', uri: 'https://example.com/degen/1' }],
    guards: {
      thirdPartySigner: {
        signerKey: thirdPartySigner.publicKey,
      },
    },
  });

  // When we try to mint from it without providing the third party signer.
  const payer = await generateSignerWithSol(umi, sol(10));
  const mint = generateSigner(umi);
  const promise = transactionBuilder(umi).add().sendAndConfirm();
  mintV2(
    umi,
    {
      candyMachine,
      collectionUpdateAuthority: collection.updateAuthority.publicKey,
    },
    { payer }
  );

  // Then we expect an error.
  await assertThrows(
    t,
    promise,
    /Please provide some minting settings for the \[thirdPartySigner\] guard/
  );
});
