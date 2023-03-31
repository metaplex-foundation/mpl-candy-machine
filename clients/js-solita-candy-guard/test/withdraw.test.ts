import test from 'tape';
import { newCandyGuardData, InitTransactions, killStuckProcess } from './setup';

const API = new InitTransactions();

killStuckProcess();

test('withdraw', async (t) => {
  const { fstTxHandler, payerPair, connection } = await API.payer();

  const data = newCandyGuardData();

  const { tx: transaction, candyGuard: address } = await API.initialize(
    t,
    data,
    payerPair,
    fstTxHandler,
  );
  // executes the transaction
  await transaction.assertSuccess(t);

  let accountInfo = await connection.getAccountInfo(payerPair.publicKey);
  const balance = accountInfo!.lamports;

  const { tx: withdrawTransaction } = await API.withdraw(t, address, payerPair, fstTxHandler);
  await withdrawTransaction.assertSuccess(t);

  accountInfo = await connection.getAccountInfo(payerPair.publicKey);
  const updatedBalance = accountInfo!.lamports;

  t.true(updatedBalance > balance, 'balance after withdraw must be greater');
});
