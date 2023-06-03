import test from 'tape';
import { amman, InitTransactions, killStuckProcess, newCandyGuardData } from '../setup';
import { createMint, getOrCreateAssociatedTokenAccount, mintTo } from '@solana/spl-token';
import { PublicKey } from '@solana/web3.js';

const SPL_TOKEN_2022 = new PublicKey('TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb');
const API = new InitTransactions();

killStuckProcess();

test('Token-2022 Payment', async (t) => {
  // creates a token mint to act as a payment token
  const {
    fstTxHandler: authorityHandler,
    authorityPair: authority,
    connection: authorityConnection,
  } = await API.authority();

  // SPL Token 2022 mint account
  const tokenMint = await createMint(
    authorityConnection,
    authority,
    authority.publicKey,
    null,
    0, // decimals
    undefined,
    undefined,
    SPL_TOKEN_2022,
  );
  // destination ATA
  const destination = await getOrCreateAssociatedTokenAccount(
    authorityConnection,
    authority,
    tokenMint,
    authority.publicKey,
    undefined,
    undefined,
    undefined,
    SPL_TOKEN_2022,
  );

  const data = newCandyGuardData();
  data.default.token2022Payment = {
    amount: 5,
    mint: tokenMint,
    destinationAta: destination.address,
  };

  const { candyGuard, candyMachine } = await API.deploy(
    t,
    data,
    authority,
    authorityHandler,
    authorityConnection,
  );

  // mint (as a minter) - no tokens

  const {
    fstTxHandler: minterHandler,
    minterPair: minter,
    connection: minterConnection,
  } = await API.minter();

  // minter ATA
  let minterAta = await getOrCreateAssociatedTokenAccount(
    minterConnection,
    minter,
    tokenMint,
    minter.publicKey,
    undefined,
    undefined,
    undefined,
    SPL_TOKEN_2022,
  );

  await mintTo(
    authorityConnection,
    authority,
    tokenMint,
    minterAta.address,
    authority,
    10, // amount
    undefined,
    undefined,
    SPL_TOKEN_2022,
  );

  // caches the ATA account
  minterAta = await getOrCreateAssociatedTokenAccount(
    minterConnection,
    minter,
    tokenMint,
    minter.publicKey,
    undefined,
    undefined,
    undefined,
    SPL_TOKEN_2022,
  );

  const [, mintForMinter] = await amman.genLabeledKeypair('Mint Account (minter)');

  const { tx: minterMintTx } = await API.mint(
    t,
    candyGuard,
    candyMachine,
    minter,
    mintForMinter,
    minterHandler,
    minterConnection,
    [
      {
        pubkey: minterAta.address,
        isSigner: false,
        isWritable: true,
      },
      {
        pubkey: destination.address,
        isSigner: false,
        isWritable: true,
      },
      {
        pubkey: tokenMint,
        isSigner: false,
        isWritable: false,
      },
      {
        pubkey: SPL_TOKEN_2022,
        isSigner: false,
        isWritable: false,
      },
    ],
  );
  await minterMintTx.assertSuccess(t);

  const updatedMinterATA = await getOrCreateAssociatedTokenAccount(
    minterConnection,
    minter,
    tokenMint,
    minter.publicKey,
    undefined,
    undefined,
    undefined,
    SPL_TOKEN_2022,
  );

  t.true(updatedMinterATA.amount < minterAta.amount, 'amount after mint must be lower');
});
