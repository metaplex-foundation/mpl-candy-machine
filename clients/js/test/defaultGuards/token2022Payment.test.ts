import {
  fetchToken,
  setComputeUnitLimit,
} from '@metaplex-foundation/mpl-toolbox';
import {
  generateSigner,
  some,
  transactionBuilder,
} from '@metaplex-foundation/umi';
import test from 'ava';
import { draw, fetchGumballMachine, TokenStandard } from '../../src';
import {
  assertItemBought,
  create,
  createMintWithHolders,
  createNft,
  createUmi,
} from '../_setup';

test('it transfers Token2022 tokens from the payer to the destination', async (t) => {
  // Given a Umi instance using the SPL Token 2022 program.
  const umi = await createUmi();
  const programsWithToken22 = umi.programs.clone();
  programsWithToken22.bind('splToken', 'splToken2022');

  // And a mint account such that:
  // - The destination treasury has 100 tokens.
  // - The payer has 12 tokens.
  const destination = generateSigner(umi).publicKey;
  const [tokenMint, destinationAta, identityAta] = await createMintWithHolders(
    { ...umi, programs: programsWithToken22 },
    {
      holders: [
        { owner: destination, amount: 100 },
        { owner: umi.identity, amount: 12 },
      ],
    }
  );

  // And a loaded Gumball Machine with a token2022Payment guard that requires 5 tokens.

  const { publicKey: gumballMachine } = await create(umi, {
    items: [
      {
        id: (await createNft(umi)).publicKey,
        tokenStandard: TokenStandard.NonFungible,
      },
    ],
    startSale: true,
    settings: {
      paymentMint: tokenMint.publicKey,
    },
    guards: {
      token2022Payment: some({
        mint: tokenMint.publicKey,
        destinationAta,
        amount: 5,
      }),
    },
  });

  // When we mint from it.

  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      draw(umi, {
        gumballMachine,
        mintArgs: {
          token2022Payment: some({ mint: tokenMint.publicKey, destinationAta }),
        },
      })
    )
    .sendAndConfirm(umi);

  // Then minting was successful.
  await assertItemBought(t, umi, { gumballMachine });

  // And the treasury token received 5 tokens.
  const destinationTokenAccount = await fetchToken(umi, destinationAta);
  t.is(destinationTokenAccount.amount, 105n);

  // And the payer lost 5 tokens.
  const payerTokenAccount = await fetchToken(umi, identityAta);
  t.is(payerTokenAccount.amount, 7n);

  // Total revenue is incremented
  const gumballMachineAccount = await fetchGumballMachine(umi, gumballMachine);
  t.is(gumballMachineAccount.totalRevenue, 5n, 'total revenue is incremented');
});
