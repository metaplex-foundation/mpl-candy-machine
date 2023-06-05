import test from 'tape';
import { CandyGuardData, GuardSet } from '../../src';

export * from './amman';
export * from './lut';
export * from './txs-init';
export * from './log';

export function newCandyGuardData(): CandyGuardData {
  return {
    default: newGuardSet(),
    groups: null,
  };
}

export function newGuardSet(): GuardSet {
  return {
    botTax: null,
    startDate: null,
    solPayment: null,
    tokenPayment: null,
    thirdPartySigner: null,
    tokenGate: null,
    gatekeeper: null,
    endDate: null,
    allowList: null,
    mintLimit: null,
    nftPayment: null,
    redeemedAmount: null,
    addressGate: null,
    nftGate: null,
    nftBurn: null,
    tokenBurn: null,
    freezeSolPayment: null,
    freezeTokenPayment: null,
    programGate: null,
    allocation: null,
    token2022Payment: null,
  };
}

export function killStuckProcess() {
  test.onFinish(() => process.exit(0));
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
