import test from 'tape';
import { amman, InitTransactions, killStuckProcess, newCandyGuardData } from '../setup';
import { PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import {
  createRouteInstruction,
  GuardType,
  PROGRAM_ID,
  RouteInstructionAccounts,
  RouteInstructionArgs,
} from '../../src/generated';
import { multiple } from '../utils';

const API = new InitTransactions();

killStuckProcess();

test('Allocation', async (t) => {
  // deploys a candy guard with a mint limit

  const { fstTxHandler, payerPair, connection } = await API.payer();

  const data = newCandyGuardData();
  data.default.allocation = {
    id: 0,
    size: 4,
  };

  const { candyGuard, candyMachine } = await API.deploy(
    t,
    data,
    payerPair,
    fstTxHandler,
    connection,
  );

  // route instruction to enable freeze

  const allocationAccounts: RouteInstructionAccounts = {
    candyGuard: candyGuard,
    candyMachine: candyMachine,
    payer: payerPair.publicKey,
  };

  const allocationArgs: RouteInstructionArgs = {
    args: {
      guard: GuardType.Allocation,
      data: new Uint8Array(),
    },
    label: null,
  };

  const [allocationPda] = await PublicKey.findProgramAddress(
    [
      Buffer.from('allocation'),
      new Uint8Array([0]),
      candyGuard.toBuffer(),
      candyMachine.toBuffer(),
    ],
    PROGRAM_ID,
  );

  const allocationRouteIx = createRouteInstruction(allocationAccounts, allocationArgs);
  allocationRouteIx.keys.push(
    ...[
      {
        pubkey: allocationPda,
        isSigner: false,
        isWritable: true,
      },
      {
        pubkey: payerPair.publicKey,
        isSigner: true,
        isWritable: false,
      },
      {
        pubkey: SystemProgram.programId,
        isSigner: false,
        isWritable: false,
      },
    ],
  );

  const allocationTx = new Transaction().add(allocationRouteIx);

  const allocationHandler = fstTxHandler.sendAndConfirmTransaction(
    allocationTx,
    [payerPair],
    'tx: Route (Initialize)',
  );

  await allocationHandler.assertSuccess(t);

  // mint (as a minter)

  const {
    fstTxHandler: minterHandler,
    minterPair: minterKeypair,
    connection: minterConnection,
  } = await API.minter();

  // overral limit is 4, this should succeed

  await multiple(t, 4, candyGuard, candyMachine, minterKeypair, minterHandler, minterConnection, [
    {
      pubkey: allocationPda,
      isSigner: false,
      isWritable: true,
    },
  ]);

  // this should fail

  const [, mintForPayer] = await amman.genLabeledKeypair('Mint Account (payer)');
  const { tx: payerMintTx } = await API.mint(
    t,
    candyGuard,
    candyMachine,
    payerPair,
    mintForPayer,
    fstTxHandler,
    connection,
    [
      {
        pubkey: allocationPda,
        isSigner: false,
        isWritable: true,
      },
    ],
  );

  await payerMintTx.assertError(t, /Allocation limit was reached/i);
});

test('Allocation: not initialized', async (t) => {
  // deploys a candy guard with a mint limit

  const { fstTxHandler, payerPair, connection } = await API.payer();

  const data = newCandyGuardData();
  data.default.allocation = {
    id: 0,
    size: 4,
  };

  const { candyGuard, candyMachine } = await API.deploy(
    t,
    data,
    payerPair,
    fstTxHandler,
    connection,
  );

  const [allocationPda] = await PublicKey.findProgramAddress(
    [
      Buffer.from('allocation'),
      new Uint8Array([0]),
      candyGuard.toBuffer(),
      candyMachine.toBuffer(),
    ],
    PROGRAM_ID,
  );

  // this should fail (not initialized)

  const [, mintForPayer] = await amman.genLabeledKeypair('Mint Account (payer)');
  const { tx: payerMintTx } = await API.mint(
    t,
    candyGuard,
    candyMachine,
    payerPair,
    mintForPayer,
    fstTxHandler,
    connection,
    [
      {
        pubkey: allocationPda,
        isSigner: false,
        isWritable: true,
      },
    ],
  );

  await payerMintTx.assertError(t, /Allocation PDA not initialized/i);
});

test('Allocation: missing PDA', async (t) => {
  // deploys a candy guard with a mint limit

  const { fstTxHandler, payerPair, connection } = await API.payer();

  const data = newCandyGuardData();
  data.default.allocation = {
    id: 0,
    size: 4,
  };

  const { candyGuard, candyMachine } = await API.deploy(
    t,
    data,
    payerPair,
    fstTxHandler,
    connection,
  );

  // this should fail (missing PDA)

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

  await payerMintTx.assertError(t, /Missing expected remaining account/i);
});
