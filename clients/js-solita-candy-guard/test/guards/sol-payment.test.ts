import test from 'tape';
import { amman, InitTransactions, killStuckProcess, newCandyGuardData } from '../setup';

const API = new InitTransactions();

killStuckProcess();

test('Sol Payment', async (t) => {
  const { fstTxHandler: authorityHandler, authorityPair, connection } = await API.authority();

  const data = newCandyGuardData();
  data.default.solPayment = {
    lamports: 1000000000,
    destination: authorityPair.publicKey,
  };

  const { candyGuard, candyMachine } = await API.deploy(
    t,
    data,
    authorityPair,
    authorityHandler,
    connection,
  );

  const {
    fstTxHandler: minterHandler,
    minterPair,
    connection: minterConnection,
  } = await API.minter();

  const [, mintForMinter] = await amman.genLabeledKeypair('Mint Account (minter)');
  const { tx: minterMintTx } = await API.mint(
    t,
    candyGuard,
    candyMachine,
    minterPair,
    mintForMinter,
    minterHandler,
    minterConnection,
    [
      {
        pubkey: authorityPair.publicKey,
        isSigner: false,
        isWritable: true,
      },
    ],
  );

  await minterMintTx.assertSuccess(t);
});

test('Sol Payment: insufficient funds', async (t) => {
  const { fstTxHandler: authorityHandler, authorityPair, connection } = await API.authority();

  const data = newCandyGuardData();
  data.default.solPayment = {
    lamports: 10000000000,
    destination: authorityPair.publicKey,
  };

  const { candyGuard, candyMachine } = await API.deploy(
    t,
    data,
    authorityPair,
    authorityHandler,
    connection,
  );

  const {
    fstTxHandler: minterHandler,
    minterPair,
    connection: minterConnection,
  } = await API.minter();

  const [, mintForMinter] = await amman.genLabeledKeypair('Mint Account (minter)');
  const { tx: minterMintTx } = await API.mint(
    t,
    candyGuard,
    candyMachine,
    minterPair,
    mintForMinter,
    minterHandler,
    minterConnection,
    [
      {
        pubkey: authorityPair.publicKey,
        isSigner: false,
        isWritable: true,
      },
    ],
  );

  await minterMintTx.assertError(t, /Not enough SOL/i);
});
