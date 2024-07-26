import {
  fetchToken,
  findAssociatedTokenPda,
  setComputeUnitLimit,
} from '@metaplex-foundation/mpl-toolbox';
import {
  generateSigner,
  publicKey,
  sol,
  some,
  transactionBuilder,
} from '@metaplex-foundation/umi';
import { generateSignerWithSol } from '@metaplex-foundation/umi-bundle-tests';
import test from 'ava';
import {
  deleteCandyMachine,
  draw,
  findCandyMachineAuthorityPda,
  settleNftSale,
  TokenStandard,
} from '../src';
import {
  assertItemBought,
  create,
  createMintWithHolders,
  createNft,
  createUmi,
} from './_setup';

test('it can delete an empty candy machine', async (t) => {
  // Given an existing candy machine.
  const umi = await createUmi();
  const candyMachine = await create(umi);

  // When we delete it.
  await transactionBuilder()
    .add(deleteCandyMachine(umi, { candyMachine: candyMachine.publicKey }))
    .sendAndConfirm(umi);

  // Then the candy machine account no longer exists.
  t.false(await umi.rpc.accountExists(candyMachine.publicKey));
});

test('it can delete a settled candy machine with payment token', async (t) => {
  // Given an existing candy machine.
  const umi = await createUmi();
  const buyerUmi = await createUmi();
  const buyer = buyerUmi.identity;
  const candyMachineSigner = generateSigner(umi);
  const candyMachine = candyMachineSigner.publicKey;
  const authorityPda = findCandyMachineAuthorityPda(umi, { candyMachine })[0];
  const [tokenMint] = await createMintWithHolders(umi, {
    holders: [
      { owner: buyer, amount: 12 },
      { owner: authorityPda, amount: 0 },
    ],
  });
  const authorityPdaPaymentAccount = findAssociatedTokenPda(umi, {
    mint: tokenMint.publicKey,
    owner: authorityPda,
  })[0];

  const nft = await createNft(umi);

  await create(umi, {
    candyMachine: candyMachineSigner,
    settings: {
      paymentMint: tokenMint.publicKey,
      itemPrice: 1,
    },
    items: [
      {
        id: nft.publicKey,
        tokenStandard: TokenStandard.NonFungible,
      },
    ],
    startSale: true,
    guards: {
      tokenPayment: { amount: 1, mint: tokenMint.publicKey },
    },
  });

  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      draw(buyerUmi, {
        candyMachine,
        mintArgs: {
          tokenPayment: some({ mint: tokenMint.publicKey }),
        },
      })
    )
    .sendAndConfirm(buyerUmi);

  // Then minting was successful.
  await assertItemBought(t, umi, { candyMachine, buyer: publicKey(buyer) });

  // Then the payment token account account no longer exists.
  t.true(await umi.rpc.accountExists(authorityPdaPaymentAccount));
  console.log(await fetchToken(umi, authorityPdaPaymentAccount));

  const payer = await generateSignerWithSol(umi, sol(10));
  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      settleNftSale(umi, {
        payer,
        index: 0,
        candyMachine,
        buyer: buyer.publicKey,
        seller: umi.identity.publicKey,
        mint: nft.publicKey,
        paymentMint: tokenMint.publicKey,
        authorityPdaPaymentAccount,
        authorityPaymentAccount: findAssociatedTokenPda(umi, {
          mint: tokenMint.publicKey,
          owner: umi.identity.publicKey,
        })[0],
        sellerPaymentAccount: findAssociatedTokenPda(umi, {
          mint: tokenMint.publicKey,
          owner: umi.identity.publicKey,
        })[0],
      })
    )
    .addRemainingAccounts([
      {
        pubkey: umi.identity.publicKey,
        isSigner: false,
        isWritable: false,
      },
      {
        pubkey: findAssociatedTokenPda(umi, {
          mint: tokenMint.publicKey,
          owner: umi.identity.publicKey,
        })[0],
        isSigner: false,
        isWritable: true,
      },
    ])
    .sendAndConfirm(umi);

  // When we delete it.
  await transactionBuilder()
    .add(deleteCandyMachine(umi, { candyMachine }))
    .sendAndConfirm(umi);

  // Then the candy machine account no longer exists.
  t.false(await umi.rpc.accountExists(candyMachine));

  // Then the payment token account account no longer exists.
  t.false(await umi.rpc.accountExists(authorityPdaPaymentAccount));
});

test('it cannot delete a candy machine that has not been fully settled', async (t) => {
  // Given an existing candy machine.
  const umi = await createUmi();
  const candyMachine = await create(umi, {
    items: [
      {
        id: (await createNft(umi)).publicKey,
        tokenStandard: TokenStandard.NonFungible,
      },
    ],
  });

  // When we delete it.
  const promise = transactionBuilder()
    .add(deleteCandyMachine(umi, { candyMachine: candyMachine.publicKey }))
    .sendAndConfirm(umi);

  // Then the transaction fails.
  await t.throwsAsync(promise, { message: /NotAllSettled/ });
});
