import test from 'tape';
import spok from 'spok';
import { newCandyGuardData, newGuardSet, InitTransactions, killStuckProcess } from './setup';
import { CandyGuard } from '../src/generated';
import { DATA_OFFSET, spokSameBignum, spokSamePubkey } from './utils';
import { BN } from 'bn.js';
import { deserialize } from '../src';

const API = new InitTransactions();

killStuckProcess();

test('Update: enable guards', async (t) => {
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
  const balance = accountInfo!.lamports!;

  const updateData = newCandyGuardData();
  updateData.default.botTax = {
    lamports: new BN(100000000),
    lastInstruction: true,
  };
  updateData.default.startDate = {
    date: 1663965742,
  };
  updateData.default.solPayment = {
    lamports: new BN(100000000),
    destination: address,
  };

  const { tx: updateTransaction } = await API.update(
    t,
    address,
    updateData,
    payerPair,
    fstTxHandler,
  );
  // executes the transaction
  await updateTransaction.assertSuccess(t);
  // retrieves the created candy machine
  const candyGuard = await CandyGuard.fromAccountAddress(connection, address);

  spok(t, candyGuard, {
    authority: spokSamePubkey(payerPair.publicKey),
  });

  accountInfo = await connection.getAccountInfo(payerPair.publicKey);
  const updatedBalance = accountInfo!.lamports!;

  t.true(updatedBalance < balance, 'balance after update must be lower');
});

test('Update: disable guards', async (t) => {
  const { fstTxHandler, payerPair, connection } = await API.payer();

  // default guardSet
  const data = newCandyGuardData();
  data.default.botTax = {
    lamports: new BN(100000000),
    lastInstruction: true,
  };
  data.default.solPayment = {
    lamports: new BN(100000000),
    destination: payerPair.publicKey,
  };
  data.groups = [];

  // VIP
  const vipGroup = newGuardSet();
  vipGroup.startDate = {
    date: 1662394820,
  };
  vipGroup.solPayment = {
    lamports: new BN(500),
    destination: payerPair.publicKey,
  };
  data.groups?.push({
    label: 'VIP',
    guards: vipGroup,
  });

  // OGs
  const ogGroup = newGuardSet();
  ogGroup.solPayment = {
    lamports: new BN(1000),
    destination: payerPair.publicKey,
  };
  data.groups?.push({
    label: 'OGs',
    guards: ogGroup,
  });

  const { tx: transaction, candyGuard: address } = await API.initialize(
    t,
    data,
    payerPair,
    fstTxHandler,
  );
  // executes the transaction
  await transaction.assertSuccess(t);

  // parse the guards configuration
  let accountInfo = await connection.getAccountInfo(address);
  const candyGuardData = deserialize(accountInfo!.data.subarray(DATA_OFFSET)!);

  t.true(candyGuardData.groups?.length === 2, 'expected 2 groups');

  const group1 = candyGuardData.groups!.at(0)!;
  // group 1
  spok(t, group1.label, 'VIP');
  spok(t, group1.guards.startDate?.date, spokSameBignum(1662394820));
  spok(t, group1.guards.solPayment?.lamports, spokSameBignum(500));

  const group2 = candyGuardData.groups!.at(1)!;
  // group 2
  spok(t, group2.label, 'OGs');
  spok(t, group2.guards.solPayment?.lamports, spokSameBignum(1000));

  accountInfo = await connection.getAccountInfo(payerPair.publicKey);
  const balance = accountInfo!.lamports!;

  const updateData = newCandyGuardData();

  const { tx: updateTransaction } = await API.update(
    t,
    address,
    updateData,
    payerPair,
    fstTxHandler,
  );
  // executes the transaction
  await updateTransaction.assertSuccess(t);
  // retrieves the created candy machine
  const candyGuard = await CandyGuard.fromAccountAddress(connection, address);

  spok(t, candyGuard, {
    authority: spokSamePubkey(payerPair.publicKey),
  });

  accountInfo = await connection.getAccountInfo(payerPair.publicKey);
  const updatedBalance = accountInfo!.lamports!;

  t.true(updatedBalance > balance, 'balance after update must be greater');
});

test('Update: duplicated groups', async (t) => {
  const { fstTxHandler, payerPair } = await API.payer();

  // default guardSet
  const data = newCandyGuardData();
  const { tx: transaction, candyGuard: address } = await API.initialize(
    t,
    data,
    payerPair,
    fstTxHandler,
  );
  // executes the transaction
  await transaction.assertSuccess(t);

  const updateData = newCandyGuardData();

  updateData.default.botTax = {
    lamports: new BN(100000000),
    lastInstruction: true,
  };
  updateData.default.solPayment = {
    lamports: new BN(100000000),
    destination: payerPair.publicKey,
  };
  updateData.groups = [];

  // VIP
  const vipGroup1 = newGuardSet();
  vipGroup1.startDate = {
    date: 1662394820,
  };
  vipGroup1.solPayment = {
    lamports: new BN(500),
    destination: payerPair.publicKey,
  };
  updateData.groups?.push({
    label: 'VIP',
    guards: vipGroup1,
  });

  // OGs
  const vipGroup2 = newGuardSet();
  vipGroup2.solPayment = {
    lamports: new BN(1000),
    destination: payerPair.publicKey,
  };
  updateData.groups?.push({
    label: 'VIP',
    guards: vipGroup2,
  });

  const { tx: updateTransaction } = await API.update(
    t,
    address,
    updateData,
    payerPair,
    fstTxHandler,
  );
  // executes the transaction
  await updateTransaction.assertError(t, /Duplicated group label/i);
});

test('Update: disable all', async (t) => {
  const { fstTxHandler, payerPair, connection } = await API.payer();

  // default guardSet
  const data = newCandyGuardData();
  const { tx: transaction, candyGuard: address } = await API.initialize(
    t,
    data,
    payerPair,
    fstTxHandler,
  );
  // executes the transaction
  await transaction.assertSuccess(t);

  // default guardSet
  const updated = newCandyGuardData();

  updated.default.botTax = {
    lamports: new BN(100000000),
    lastInstruction: true,
  };
  updated.groups = [];

  // group1
  const group1 = newGuardSet();
  group1.startDate = {
    date: 1662394820,
  };
  group1.mintLimit = {
    id: 0,
    limit: 5,
  };
  updated.groups?.push({
    label: 'group1',
    guards: group1,
  });

  // group2
  const group2 = newGuardSet();
  group2.programGate = {
    additional: [],
  };
  updated.groups?.push({
    label: 'group2',
    guards: group2,
  });

  const { tx: updateTransaction } = await API.update(t, address, updated, payerPair, fstTxHandler);
  // executes the transaction
  await updateTransaction.assertSuccess(t);

  // disable all guards

  const disabled = newCandyGuardData();

  const { tx: disableTransaction } = await API.update(
    t,
    address,
    disabled,
    payerPair,
    fstTxHandler,
  );
  // executes the transaction
  await disableTransaction.assertSuccess(t, [/Withdrawing/i]);

  // parse the guards configuration
  const accountInfo = await connection.getAccountInfo(address);
  const candyGuardData = deserialize(accountInfo!.data.subarray(DATA_OFFSET));

  spok(t, candyGuardData, disabled);
});
