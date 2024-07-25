/* eslint-disable no-await-in-loop */
import { setComputeUnitLimit } from '@metaplex-foundation/mpl-toolbox';
import {
  generateSigner,
  isEqualToAmount,
  sol,
  some,
  transactionBuilder,
} from '@metaplex-foundation/umi';
import { generateSignerWithSol } from '@metaplex-foundation/umi-bundle-tests';
import test from 'ava';
import { CandyMachine, draw, fetchCandyMachine, TokenStandard } from '../src';
import { settleNftSale } from '../src/generated/instructions/settleNftSale';
import { create, createNft, createUmi } from './_setup';

test('it can settle an nft sale', async (t) => {
  // Given a candy machine with some guards.
  const umi = await createUmi();
  const nft = await createNft(umi);

  const candyMachineSigner = generateSigner(umi);
  const candyMachine = candyMachineSigner.publicKey;

  await create(umi, {
    candyMachine: candyMachineSigner,
    items: [
      {
        id: nft.publicKey,
        tokenStandard: TokenStandard.NonFungible,
      },
    ],
    startSale: true,
    guards: {
      botTax: { lamports: sol(0.01), lastInstruction: true },
      solPayment: { lamports: sol(1) },
    },
  });

  // When we mint from the candy guard.
  const buyerUmi = await createUmi();
  const buyer = buyerUmi.identity;
  const payer = await generateSignerWithSol(umi, sol(10));
  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      draw(umi, {
        candyMachine,
        payer,
        buyer,
        mintArgs: {
          solPayment: some(true),
        },
      })
    )
    .sendAndConfirm(umi);

  await transactionBuilder()
    .add(setComputeUnitLimit(buyerUmi, { units: 600_000 }))
    .add(
      settleNftSale(buyerUmi, {
        index: 0,
        candyMachine,
        authority: umi.identity.publicKey,
        seller: umi.identity.publicKey,
        mint: nft.publicKey,
      })
    )
    .addRemainingAccounts([
      {
        pubkey: umi.identity.publicKey,
        isSigner: false,
        isWritable: true,
      },
    ])
    .sendAndConfirm(buyerUmi);

  const payerBalance = await umi.rpc.getBalance(payer.publicKey);
  t.true(isEqualToAmount(payerBalance, sol(9), sol(0.1)));

  // And the candy machine was updated.
  const candyMachineAccount = await fetchCandyMachine(umi, candyMachine);
  t.like(candyMachineAccount, <CandyMachine>{
    itemsRedeemed: 1n,
    itemsSettled: 1n,
  });
});
