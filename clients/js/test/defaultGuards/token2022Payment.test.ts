import {
  fetchToken,
  setComputeUnitLimit,
} from '@metaplex-foundation/mpl-essentials';
import {
  base58PublicKey,
  generateSigner,
  publicKey,
  some,
  transactionBuilder,
} from '@metaplex-foundation/umi';
import test from 'ava';
import { mintV2 } from '../../src';
import {
  assertSuccessfulMint,
  createCollectionNft,
  createUmi,
  createV2,
} from '../_setup';
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
} from '@solana/spl-token';
import { Connection, LAMPORTS_PER_SOL, Signer } from '@solana/web3.js';
import { PublicKey } from '@solana/web3.js';

const SPL_TOKEN_2022 = new PublicKey(
  'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'
);

test('it transfers Token2022 tokens from the payer to the destination', async (t) => {
  const umi = await createUmi();
  const connection = new Connection(umi.rpc.getEndpoint(), 'confirmed');

  // Given a mint account such that:
  // - The destination treasury has 100 tokens.
  // - The payer has 12 tokens.
  const destination = generateSigner(umi);
  const signature = await connection.requestAirdrop(
    new PublicKey(base58PublicKey(destination.publicKey)),
    10 * LAMPORTS_PER_SOL
  );
  await connection.confirmTransaction(signature);

  const destinationPayer = <Signer>{
    publicKey: new PublicKey(base58PublicKey(destination.publicKey)),
    secretKey: destination.secretKey,
  };
  // SPL Token 2022 mint account
  const tokenMint = await createMint(
    connection,
    destinationPayer,
    destinationPayer.publicKey,
    null,
    0, // decimals
    undefined,
    undefined,
    SPL_TOKEN_2022
  );
  // destination ATA
  const destinationAta = await getOrCreateAssociatedTokenAccount(
    connection,
    destinationPayer,
    tokenMint,
    destinationPayer.publicKey,
    undefined,
    undefined,
    undefined,
    SPL_TOKEN_2022
  );

  await mintTo(
    connection,
    destinationPayer,
    tokenMint,
    destinationAta.address,
    destinationPayer.publicKey,
    100, // amount
    undefined,
    undefined,
    SPL_TOKEN_2022
  );
  // minter ATA
  const minterAta = await getOrCreateAssociatedTokenAccount(
    connection,
    destinationPayer,
    tokenMint,
    new PublicKey(base58PublicKey(umi.identity.publicKey)),
    undefined,
    undefined,
    undefined,
    SPL_TOKEN_2022
  );

  await mintTo(
    connection,
    destinationPayer,
    tokenMint,
    minterAta.address,
    destinationPayer.publicKey,
    12, // amount
    undefined,
    undefined,
    SPL_TOKEN_2022
  );

  // And a loaded Candy Machine with a token2022Payment guard that requires 5 tokens.
  const collectionMint = (await createCollectionNft(umi)).publicKey;
  const { publicKey: candyMachine } = await createV2(umi, {
    collectionMint,
    configLines: [{ name: 'Degen #1', uri: 'https://example.com/degen/1' }],
    guards: {
      token2022Payment: some({
        mint: publicKey(tokenMint.toBase58()),
        destinationAta: publicKey(destinationAta.address.toBase58()),
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
          token2022Payment: some({
            mint: publicKey(tokenMint.toBase58()),
            destinationAta: publicKey(destinationAta.address.toBase58()),
          }),
        },
      })
    )
    .sendAndConfirm(umi);

  // Then minting was successful.
  await assertSuccessfulMint(t, umi, { mint, owner: umi.identity });

  // And the treasury token received 5 tokens.
  const destinationTokenAccount = await fetchToken(
    umi,
    publicKey(destinationAta.address.toBase58())
  );
  t.is(destinationTokenAccount.amount, 105n);

  // And the payer lost 5 tokens.
  const payerTokenAccount = await fetchToken(
    umi,
    publicKey(minterAta.address.toBase58())
  );
  t.is(payerTokenAccount.amount, 7n);
});
