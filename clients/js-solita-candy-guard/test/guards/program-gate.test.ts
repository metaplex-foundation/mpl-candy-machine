import { StakeProgram } from '@solana/web3.js';
import test from 'tape';
import { amman, InitTransactions, killStuckProcess, newCandyGuardData } from '../setup';

const API = new InitTransactions();

killStuckProcess();

test('Program Gate', async (t) => {
  const { fstTxHandler: handler, authorityPair: authority, connection } = await API.authority();

  const data = newCandyGuardData();
  data.default.programGate = {
    // will validate against the standard programs only
    additional: [],
  };

  const { candyGuard, candyMachine } = await API.deploy(t, data, authority, handler, connection);

  // mint

  const {
    fstTxHandler: minterHandler,
    minterPair: minter,
    connection: minterConnection,
  } = await API.minter();
  const [, mintForMinter] = await amman.genLabeledKeypair('Mint Account (minter)');
  const { tx: minterMintTx } = await API.mint(
    t,
    candyGuard,
    candyMachine,
    minter,
    mintForMinter,
    minterHandler,
    minterConnection,
  );
  await minterMintTx.assertSuccess(t);
});

test('Program Gate: invalid program', async (t) => {
  const { fstTxHandler: handler, authorityPair: authority, connection } = await API.authority();

  const data = newCandyGuardData();
  data.default.programGate = {
    // will validate against the standard programs only
    additional: [],
  };

  const { candyGuard, candyMachine } = await API.deploy(t, data, authority, handler, connection);

  // mint

  const {
    fstTxHandler: minterHandler,
    minterPair: minter,
    connection: minterConnection,
  } = await API.minter();
  const [, mintForMinter] = await amman.genLabeledKeypair('Mint Account (minter)');
  const { tx: minterMintTx } = await API.mintWithInvalidProgram(
    t,
    candyGuard,
    candyMachine,
    minter,
    mintForMinter,
    minterHandler,
    minterConnection,
  );
  await minterMintTx.assertError(t, /unauthorized program was found/i);
});

test('Program Gate: authorized program', async (t) => {
  const { fstTxHandler: handler, authorityPair: authority, connection } = await API.authority();

  const data = newCandyGuardData();
  data.default.programGate = {
    // authorize Stake program
    additional: [StakeProgram.programId],
  };

  const { candyGuard, candyMachine } = await API.deploy(t, data, authority, handler, connection);

  // mint

  const {
    fstTxHandler: minterHandler,
    minterPair: minter,
    connection: minterConnection,
  } = await API.minter();
  const [, mintForMinter] = await amman.genLabeledKeypair('Mint Account (minter)');
  const { tx: minterMintTx } = await API.mintWithInvalidProgram(
    t,
    candyGuard,
    candyMachine,
    minter,
    mintForMinter,
    minterHandler,
    minterConnection,
  );

  // we will get an error even if we authorize the Stake program since we are not
  // building the instruction correctly, but for the purpose of the test this is not
  // important because we are testing whether the Stake program is "authorized" to be
  // the mint transaction
  minterMintTx.then((x) =>
    x.assertLogs(t, [/Stake11111111111111111111111111111111111111/i, /Invalid account owner/i], {}),
  );
  await minterMintTx.assertError(t);
});
