import {
  fetchToken,
  setComputeUnitLimit,
} from '@metaplex-foundation/mpl-toolbox';
import {
  generateSigner,
  publicKey,
  signerIdentity,
  some,
  transactionBuilder,
} from '@metaplex-foundation/umi';
import test from 'ava';
import { mintV2 } from '../../src';
import {
  assertSuccessfulMint,
  createCollectionNft,
  createMintWithHolders,
  createUmi,
  createV2,
} from '../_setup';

test('it transfers Token2022 tokens from the payer to the destination', async (t) => {
  // Given a Umi instance using the SPL Token 2022 program.
  const umi = await createUmi();
  const umiWithToken2022 = (await createUmi()).use(
    signerIdentity(umi.identity)
  );
  umiWithToken2022.programs.add({
    ...umi.programs.get('splToken'),
    publicKey: publicKey('TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'),
  });

  // And a mint account such that:
  // - The destination treasury has 100 tokens.
  // - The payer has 12 tokens.
  const destination = generateSigner(umi).publicKey;
  const [tokenMint, destinationAta, identityAta] = await createMintWithHolders(
    umiWithToken2022,
    {
      holders: [
        { owner: destination, amount: 100 },
        { owner: umi.identity, amount: 12 },
      ],
    }
  );

  // And a loaded Candy Machine with a token2022Payment guard that requires 5 tokens.
  const collectionMint = (await createCollectionNft(umi)).publicKey;
  const { publicKey: candyMachine } = await createV2(umi, {
    collectionMint,
    configLines: [{ name: 'Degen #1', uri: 'https://example.com/degen/1' }],
    guards: {
      token2022Payment: some({
        mint: tokenMint.publicKey,
        destinationAta,
        amount: 5,
      }),
    },
  });

  // When we mint from it.
  const mint = generateSigner(umi);
  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      mintV2(umi, {
        candyMachine,
        nftMint: mint,
        collectionMint,
        collectionUpdateAuthority: umi.identity.publicKey,
        mintArgs: {
          token2022Payment: some({ mint: tokenMint.publicKey, destinationAta }),
        },
      })
    )
    .sendAndConfirm(umi);

  // Then minting was successful.
  await assertSuccessfulMint(t, umi, { mint, owner: umi.identity });

  // And the treasury token received 5 tokens.
  const destinationTokenAccount = await fetchToken(umi, destinationAta);
  t.is(destinationTokenAccount.amount, 105n);

  // And the payer lost 5 tokens.
  const payerTokenAccount = await fetchToken(umi, identityAta);
  t.is(payerTokenAccount.amount, 7n);
});
