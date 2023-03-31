import test from 'tape';
import { newCandyGuardData, InitTransactions, killStuckProcess, amman } from './setup';
import { CandyMachineHelper } from './utils';
import { Transaction } from '@solana/web3.js';
import {
  createRouteInstruction,
  RouteInstructionAccounts,
  RouteInstructionArgs,
} from '../src/generated/instructions/route';
import { GuardType } from '../src/generated/types/GuardType';

killStuckProcess();

test('route (non-existing instruction)', async (t) => {
  const API = new InitTransactions();
  const HELPER = new CandyMachineHelper();
  const { fstTxHandler, payerPair, connection } = await API.payer();

  // candy machine

  const [, candyMachine] = await amman.genLabeledKeypair('Candy Machine Account');

  const items = 10;

  const candyMachineData = {
    itemsAvailable: items,
    symbol: 'CORE',
    sellerFeeBasisPoints: 500,
    maxSupply: 0,
    isMutable: true,
    creators: [
      {
        address: payerPair.publicKey,
        verified: false,
        percentageShare: 100,
      },
    ],
    configLineSettings: {
      prefixName: 'TEST ',
      nameLength: 10,
      prefixUri: 'https://arweave.net/',
      uriLength: 50,
      isSequential: false,
    },
    hiddenSettings: null,
  };

  const { tx: createTxCM } = await HELPER.initialize(
    t,
    payerPair,
    candyMachine,
    candyMachineData,
    fstTxHandler,
    connection,
  );

  await createTxCM.assertNone();

  // candy guard

  const data = newCandyGuardData();

  const { tx: transaction, candyGuard: address } = await API.initialize(
    t,
    data,
    payerPair,
    fstTxHandler,
  );

  await transaction.assertSuccess(t);

  // wrap

  const { tx: wrapTx } = await API.wrap(
    t,
    address,
    candyMachine.publicKey,
    payerPair,
    fstTxHandler,
  );

  await wrapTx.assertSuccess(t, [/SetMintAuthority/i]);

  // route instruction

  const accounts: RouteInstructionAccounts = {
    candyGuard: address,
    candyMachine: candyMachine.publicKey,
    payer: payerPair.publicKey,
  };

  const args: RouteInstructionArgs = {
    args: {
      guard: GuardType.AddressGate,
      data: new Uint8Array(),
    },
    label: null,
  };

  const tx = new Transaction().add(createRouteInstruction(accounts, args));
  const h = fstTxHandler.sendAndConfirmTransaction(tx, [payerPair], 'tx: Route');

  await h.assertError(t, /No instruction was found/i);
});
