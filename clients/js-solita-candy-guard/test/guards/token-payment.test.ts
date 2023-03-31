import test from 'tape';
import { amman, InitTransactions, killStuckProcess, newCandyGuardData } from '../setup';
import { createMint, getOrCreateAssociatedTokenAccount, mintTo } from '@solana/spl-token';

const API = new InitTransactions();

killStuckProcess();

test('Token Payment', async (t) => {
  // creates a token mint to act as a payment token
  const {
    fstTxHandler: authorityHandler,
    authorityPair: authority,
    connection: authorityConnection,
  } = await API.authority();

  const tokenMint = await createMint(authorityConnection, authority, authority.publicKey, null, 0);

  const destination = await getOrCreateAssociatedTokenAccount(
    authorityConnection,
    authority,
    tokenMint,
    authority.publicKey,
  );

  const data = newCandyGuardData();
  data.default.tokenPayment = {
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

  let minterATA = await getOrCreateAssociatedTokenAccount(
    minterConnection,
    minter,
    tokenMint,
    minter.publicKey,
  );

  await mintTo(
    authorityConnection,
    authority,
    tokenMint,
    minterATA.address,
    authority,
    // airdrop 10 tokens
    10,
  );

  // updates the ATA account
  minterATA = await getOrCreateAssociatedTokenAccount(
    minterConnection,
    minter,
    tokenMint,
    minter.publicKey,
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
        pubkey: minterATA.address,
        isSigner: false,
        isWritable: true,
      },
      {
        pubkey: destination.address,
        isSigner: false,
        isWritable: true,
      },
    ],
  );
  await minterMintTx.assertSuccess(t);

  const updatedMinterATA = await getOrCreateAssociatedTokenAccount(
    minterConnection,
    minter,
    tokenMint,
    minter.publicKey,
  );

  t.true(updatedMinterATA.amount < minterATA.amount, 'amount after mint must be lower');
});

test('Token Payment (not enought tokens)', async (t) => {
  // creates a token mint to act as a payment token
  const {
    fstTxHandler: authorityHandler,
    authorityPair: authority,
    connection: authorityConnection,
  } = await API.authority();

  const tokenMint = await createMint(authorityConnection, authority, authority.publicKey, null, 0);

  const destination = await getOrCreateAssociatedTokenAccount(
    authorityConnection,
    authority,
    tokenMint,
    authority.publicKey,
  );

  const data = newCandyGuardData();
  data.default.tokenPayment = {
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

  const minterATA = await getOrCreateAssociatedTokenAccount(
    minterConnection,
    minter,
    tokenMint,
    minter.publicKey,
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
        pubkey: minterATA.address,
        isSigner: false,
        isWritable: true,
      },
      {
        pubkey: destination.address,
        isSigner: false,
        isWritable: true,
      },
    ],
  );
  await minterMintTx.assertError(t, /Not enough tokens on the account/i);
});
