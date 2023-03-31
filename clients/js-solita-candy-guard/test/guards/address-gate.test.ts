import test from 'tape';
import { amman, InitTransactions, killStuckProcess, newCandyGuardData } from '../setup';

const API = new InitTransactions();

killStuckProcess();

test('address gate', async (t) => {
  const { fstTxHandler, payerPair, connection } = await API.payer();

  const data = newCandyGuardData();
  data.default.addressGate = {
    address: payerPair.publicKey,
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

  // trying to mint as another minter

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

  await minterMintTx.assertError(t, /Address not authorized/i);
});
