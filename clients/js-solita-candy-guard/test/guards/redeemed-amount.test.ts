import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import test from 'tape';
import { multiple } from '../utils';
import { amman, InitTransactions, killStuckProcess, newCandyGuardData } from '../setup';

const API = new InitTransactions();

killStuckProcess();

test('redeemed amount', async (t) => {
  const { fstTxHandler, payerPair, connection } = await API.payer();

  const data = newCandyGuardData();
  data.default.redeemedAmount = {
    maximum: 1,
  };

  const { candyGuard, candyMachine } = await API.deploy(
    t,
    data,
    payerPair,
    fstTxHandler,
    connection,
  );

  // mint

  const [, mintForPayer] = await amman.genLabeledKeypair('Mint Account (payer)');
  const { tx: payerMintTx } = await API.mint(
    t,
    candyGuard,
    candyMachine,
    payerPair,
    mintForPayer,
    fstTxHandler,
    connection,
  );

  await payerMintTx.assertSuccess(t);

  // trying to mint another one (should fail)

  const {
    fstTxHandler: minterHandler,
    minterPair: minterKeypair,
    connection: minterConnection,
  } = await API.minter();

  const [, mintForMinter] = await amman.genLabeledKeypair('Mint Account (authority)');
  const { tx: minterMintTx } = await API.mint(
    t,
    candyGuard,
    candyMachine,
    minterKeypair,
    mintForMinter,
    minterHandler,
    minterConnection,
  );

  await minterMintTx.assertError(t, /maximum amount/i);
});

test('redeemed amount: sold out (bot tax)', async (t) => {
  const { fstTxHandler, payerPair, connection } = await API.payer();

  const data = newCandyGuardData();
  data.default.redeemedAmount = {
    maximum: 10,
  };
  data.default.botTax = {
    lamports: LAMPORTS_PER_SOL,
    lastInstruction: false,
  };

  const { candyGuard, candyMachine } = await API.deploy(
    t,
    data,
    payerPair,
    fstTxHandler,
    connection,
  );

  // mint

  const {
    fstTxHandler: minterHandler,
    minterPair: minterKeypair,
    connection: minterConnection,
  } = await API.minter();

  // overral limit is 4, this should succeed

  await multiple(
    t,
    10,
    candyGuard,
    candyMachine,
    minterKeypair,
    minterHandler,
    minterConnection,
    null,
  );

  const [, mintForPayer] = await amman.genLabeledKeypair('Mint Account (payer)');
  const { tx: minterMintTx } = await API.mint(
    t,
    candyGuard,
    candyMachine,
    payerPair,
    mintForPayer,
    fstTxHandler,
    connection,
  );

  await minterMintTx.assertSuccess(t, [/maximum amount/i, /Botting/i]);
});

test('redeemed amount: sold out (transaction fail)', async (t) => {
  const { fstTxHandler, payerPair, connection } = await API.payer();

  const data = newCandyGuardData();
  data.default.botTax = {
    lamports: LAMPORTS_PER_SOL,
    lastInstruction: false,
  };

  const { candyGuard, candyMachine } = await API.deploy(
    t,
    data,
    payerPair,
    fstTxHandler,
    connection,
  );

  // mint

  const {
    fstTxHandler: minterHandler,
    minterPair: minterKeypair,
    connection: minterConnection,
  } = await API.minter();

  // overral limit is 4, this should succeed

  await multiple(
    t,
    10,
    candyGuard,
    candyMachine,
    minterKeypair,
    minterHandler,
    minterConnection,
    null,
  );

  const [, mintForPayer] = await amman.genLabeledKeypair('Mint Account (payer)');
  const { tx: minterMintTx } = await API.mint(
    t,
    candyGuard,
    candyMachine,
    payerPair,
    mintForPayer,
    fstTxHandler,
    connection,
  );

  await minterMintTx.assertError(t);
});
