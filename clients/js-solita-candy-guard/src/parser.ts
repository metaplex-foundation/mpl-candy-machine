import { BN } from 'bn.js';
import * as beet from '@metaplex-foundation/beet';
import { logDebug } from './utils/log';
import {
  addressGateBeet,
  allocationBeet,
  allowListBeet,
  botTaxBeet,
  CandyGuardData,
  endDateBeet,
  freezeSolPaymentBeet,
  freezeTokenPaymentBeet,
  gatekeeperBeet,
  Group,
  GuardSet,
  mintLimitBeet,
  nftBurnBeet,
  nftGateBeet,
  nftPaymentBeet,
  programGateBeet,
  redeemedAmountBeet,
  startDateBeet,
  thirdPartySignerBeet,
  token2022PaymentBeet,
  tokenBurnBeet,
  tokenGateBeet,
  solPaymentBeet,
  tokenPaymentBeet,
} from './generated';
import { u32, u64 } from '@metaplex-foundation/beet';

type Guards = {
  /* 01 */ botTaxEnabled: boolean;
  /* 02 */ solPaymentEnabled: boolean;
  /* 03 */ tokenPaymentEnabled: boolean;
  /* 04 */ startDateEnabled: boolean;
  /* 05 */ thirdPartySignerEnabled: boolean;
  /* 06 */ tokenGateEnabled: boolean;
  /* 07 */ gatekeeperEnabled: boolean;
  /* 08 */ endDateEnabled: boolean;
  /* 09 */ allowListEnabled: boolean;
  /* 10 */ mintLimitEnabled: boolean;
  /* 11 */ nftPaymentEnabled: boolean;
  /* 12 */ redeemedAmountEnabled: boolean;
  /* 13 */ addressGateEnabled: boolean;
  /* 14 */ nftGateEnabled: boolean;
  /* 15 */ nftBurnEnabled: boolean;
  /* 16 */ tokenBurnEnabled: boolean;
  /* 17 */ freezeSolPaymentEnabled: boolean;
  /* 18 */ freezeTokenPaymentEnabled: boolean;
  /* 19 */ programGateEnabled: boolean;
  /* 20 */ allocationEnabled: boolean;
  /* 21 */ token2022PaymentEnabled: boolean;
};

const GUARDS_SIZE = {
  /* 01 */ botTax: 9,
  /* 02 */ solPayment: 40,
  /* 03 */ tokenPayment: 72,
  /* 04 */ startDate: 8,
  /* 05 */ thirdPartySigner: 32,
  /* 06 */ tokenGate: 40,
  /* 07 */ gatekeeper: 33,
  /* 08 */ endDate: 8,
  /* 09 */ allowList: 32,
  /* 10 */ mintLimit: 3,
  /* 11 */ nftPayment: 64,
  /* 12 */ redeemedAmount: 8,
  /* 13 */ addressGate: 32,
  /* 14 */ nftGate: 32,
  /* 15 */ nftBurn: 32,
  /* 16 */ tokenBurn: 40,
  /* 17 */ freezeSolPayment: 40,
  /* 18 */ freezeTokenPayment: 72,
  /* 19 */ programGate: 164,
  /* 20 */ allocation: 5,
  /* 21 */ token2022Payment: 72,
};

const GUARDS_NAME = [
  /* 01 */ 'botTax',
  /* 02 */ 'solPayment',
  /* 03 */ 'tokenPayment',
  /* 04 */ 'startDate',
  /* 05 */ 'thirdPartySigner',
  /* 06 */ 'tokenGate',
  /* 07 */ 'gatekeeper',
  /* 08 */ 'endDate',
  /* 09 */ 'allowList',
  /* 10 */ 'mintLimit',
  /* 11 */ 'nftPayment',
  /* 12 */ 'redeemedAmount',
  /* 13 */ 'addressGate',
  /* 14 */ 'nftGate',
  /* 15 */ 'nftBurn',
  /* 16 */ 'tokenBurn',
  /* 17 */ 'freezeSolPayment',
  /* 18 */ 'freezeTokenPayment',
  /* 19 */ 'programGate',
  /* 20 */ 'allocation',
  /* 21 */ 'token2022Payment',
];

const GUARDS_COUNT = GUARDS_NAME.length;
const MAX_LABEL_LENGTH = 6;
const MAX_PROGRAM_COUNT = 5;

/**
 * Returns the guards that are enabled.
 *
 * @param buffer bytes representing the guards data.
 *
 * @returns a `Guards` object.
 */
function guardsFromData(buffer: Buffer): Guards {
  const enabled = new BN(beet.u64.read(buffer, 0)).toNumber();

  const guards: boolean[] = [];
  for (let i = 0; i < GUARDS_COUNT; i++) {
    guards.push(!!((1 << i) & enabled));
  }

  const [
    botTaxEnabled,
    solPaymentEnabled,
    tokenPaymentEnabled,
    startDateEnabled,
    thirdPartySignerEnabled,
    tokenGateEnabled,
    gatekeeperEnabled,
    endDateEnabled,
    allowListEnabled,
    mintLimitEnabled,
    nftPaymentEnabled,
    redeemedAmountEnabled,
    addressGateEnabled,
    nftGateEnabled,
    nftBurnEnabled,
    tokenBurnEnabled,
    freezeSolPaymentEnabled,
    freezeTokenPaymentEnabled,
    programGateEnabled,
    allocationEnabled,
    token2022PaymentEnabled,
  ] = guards;

  return {
    botTaxEnabled,
    solPaymentEnabled,
    tokenPaymentEnabled,
    startDateEnabled,
    thirdPartySignerEnabled,
    tokenGateEnabled,
    gatekeeperEnabled,
    endDateEnabled,
    allowListEnabled,
    mintLimitEnabled,
    nftPaymentEnabled,
    redeemedAmountEnabled,
    addressGateEnabled,
    nftGateEnabled,
    nftBurnEnabled,
    tokenBurnEnabled,
    freezeSolPaymentEnabled,
    freezeTokenPaymentEnabled,
    programGateEnabled,
    allocationEnabled,
    token2022PaymentEnabled,
  };
}

/**
 * Returns a `CandyGuardData` object from a data buffer.
 *
 * @param buffer bytes representing the Candy Guard data.
 *
 * @returns a `CandyGuardData` object from a data buffer.
 */
export function deserialize(buffer: Buffer): CandyGuardData {
  // parses the default guard set
  const { guardSet: defaultSet, offset } = deserializeGuardSet(buffer);
  // retrieves the number of groups
  const groupsCount = new BN(beet.u32.read(buffer, offset)).toNumber();
  const groups: Group[] = [];

  let cursor = beet.u32.byteSize + offset;
  for (let i = 0; i < groupsCount; i++) {
    // parses each individual group
    const label = buffer.subarray(cursor, cursor + MAX_LABEL_LENGTH).toString();
    cursor += MAX_LABEL_LENGTH;
    const { guardSet: guards, offset } = deserializeGuardSet(buffer.subarray(cursor));
    groups.push({ label, guards });
    cursor += offset;
  }

  return {
    default: defaultSet,
    groups: groups.length === 0 ? null : groups,
  };
}

/**
 * Serializes the Cnady Guard data to a byte buffer.
 *
 * @param data the Candy Guard data to be serialized.
 *
 * @returns byte buffer.
 */
export function serialize(data: CandyGuardData): Buffer {
  const buffer = Buffer.alloc(size(data));
  // serializes the default guard set
  let offset = serializeGuardSet(buffer, 0, data.default);

  // write the number of groups
  const groupsCount = data.groups ? data.groups.length : 0;
  u32.write(buffer, offset, groupsCount);
  offset += u32.byteSize;

  for (let i = 0; i < groupsCount; i++) {
    // serializes each individual group
    const group = data.groups!.at(i);
    // label
    if (group!.label.length > MAX_LABEL_LENGTH) {
      throw `Exceeded maximum label length: ${group!.label.length} > ${MAX_LABEL_LENGTH}`;
    }
    buffer.write(group!.label, offset, MAX_LABEL_LENGTH, 'utf8');
    offset += MAX_LABEL_LENGTH;
    // guards
    offset = serializeGuardSet(buffer, offset, group!.guards);
  }

  return buffer;
}

/**
 * Returns the number of bytes needed to serialize the specified
 * `CandyGuardData` object.
 *
 * @param data the `CandyGuardData` object.
 *
 * @returns the number of bytes needed to serialize the specified
 * `CandyGuardData` object.
 */
function size(data: CandyGuardData): number {
  let size = guardSetSize(data.default);
  size += u32.byteSize;

  if (data.groups) {
    for (let i = 0; i < data.groups.length; i++) {
      size += MAX_LABEL_LENGTH;
      size += guardSetSize(data.groups.at(i)!.guards);
    }
  }

  return size;
}

/**
 * Returns the number of bytes needed to serialize the specified
 * `GuardSet` object.
 *
 * @param data the `GuardSet` object.
 *
 * @returns the number of bytes needed to serialize the specified
 * `GuardSet` object.
 */
function guardSetSize(guardSet: GuardSet): number {
  type ObjectKey = keyof typeof guardSet;
  const guards: number[] = [];
  for (let i = 0; i < GUARDS_COUNT; i++) {
    const index = GUARDS_NAME[i] as ObjectKey;
    if (guardSet[index]) {
      guards.push(GUARDS_SIZE[index]);
    }
  }

  // features flag + guards data
  return (
    u64.byteSize + guards.reduce((previousValue, currentValue) => previousValue + currentValue, 0)
  );
}

/**
 * Returns a `GuardSet` object from the byte buffer.
 *
 * @param buffer the byte buffer to read from.
 *
 * @returns an object with a `GuardSet` object from the byte buffer and
 * the number of bytes (offset) consumed.
 */
function deserializeGuardSet(buffer: Buffer): { guardSet: GuardSet; offset: number } {
  const guards = guardsFromData(buffer);
  const {
    botTaxEnabled,
    startDateEnabled,
    solPaymentEnabled,
    tokenPaymentEnabled,
    thirdPartySignerEnabled,
    tokenGateEnabled,
    gatekeeperEnabled,
    endDateEnabled,
    allowListEnabled,
    mintLimitEnabled,
    nftPaymentEnabled,
    redeemedAmountEnabled,
    addressGateEnabled,
    nftGateEnabled,
    nftBurnEnabled,
    tokenBurnEnabled,
    freezeSolPaymentEnabled,
    freezeTokenPaymentEnabled,
    programGateEnabled,
    allocationEnabled,
    token2022PaymentEnabled,
  } = guards;
  logDebug('Guards: %O', guards);

  // data offset for deserialization (skip u64 features flag)
  let cursor = beet.u64.byteSize;
  // eslint-disable-next-line  @typescript-eslint/no-explicit-any
  const data: Record<string, any> = {};

  if (botTaxEnabled) {
    const [botTax] = botTaxBeet.deserialize(buffer, cursor);
    data.botTax = botTax;
    cursor += GUARDS_SIZE.botTax;
  }

  if (solPaymentEnabled) {
    const [solPayment] = solPaymentBeet.deserialize(buffer, cursor);
    data.solPayment = solPayment;
    cursor += GUARDS_SIZE.solPayment;
  }

  if (tokenPaymentEnabled) {
    const [tokenPayment] = tokenPaymentBeet.deserialize(buffer, cursor);
    data.tokenPayment = tokenPayment;
    cursor += GUARDS_SIZE.tokenPayment;
  }

  if (startDateEnabled) {
    const [startDate] = startDateBeet.deserialize(buffer, cursor);
    data.startDate = startDate;
    cursor += GUARDS_SIZE.startDate;
  }

  if (thirdPartySignerEnabled) {
    const [thirdPartySigner] = thirdPartySignerBeet.deserialize(buffer, cursor);
    data.thirdPartySigner = thirdPartySigner;
    cursor += GUARDS_SIZE.thirdPartySigner;
  }

  if (tokenGateEnabled) {
    const [tokenGate] = tokenGateBeet.deserialize(buffer, cursor);
    data.tokenGate = tokenGate;
    cursor += GUARDS_SIZE.tokenGate;
  }

  if (gatekeeperEnabled) {
    const [gatekeeper] = gatekeeperBeet.deserialize(buffer, cursor);
    data.gatekeeper = gatekeeper;
    cursor += GUARDS_SIZE.gatekeeper;
  }

  if (endDateEnabled) {
    const [endDate] = endDateBeet.deserialize(buffer, cursor);
    data.endDate = endDate;
    cursor += GUARDS_SIZE.endDate;
  }

  if (allowListEnabled) {
    const [allowList] = allowListBeet.deserialize(buffer, cursor);
    data.allowList = allowList;
    cursor += GUARDS_SIZE.allowList;
  }

  if (mintLimitEnabled) {
    const [mintLimit] = mintLimitBeet.deserialize(buffer, cursor);
    data.mintLimit = mintLimit;
    cursor += GUARDS_SIZE.mintLimit;
  }

  if (nftPaymentEnabled) {
    const [nftPayment] = nftPaymentBeet.deserialize(buffer, cursor);
    data.nftPayment = nftPayment;
    cursor += GUARDS_SIZE.nftPayment;
  }

  if (redeemedAmountEnabled) {
    const [redeemedAmount] = redeemedAmountBeet.deserialize(buffer, cursor);
    data.redeemedAmount = redeemedAmount;
    cursor += GUARDS_SIZE.redeemedAmount;
  }

  if (addressGateEnabled) {
    const [addressGate] = addressGateBeet.deserialize(buffer, cursor);
    data.addressGate = addressGate;
    cursor += GUARDS_SIZE.addressGate;
  }

  if (nftGateEnabled) {
    const [nftGate] = nftGateBeet.deserialize(buffer, cursor);
    data.nftGate = nftGate;
    cursor += GUARDS_SIZE.nftGate;
  }

  if (nftBurnEnabled) {
    const [nftBurn] = nftBurnBeet.deserialize(buffer, cursor);
    data.nftBurn = nftBurn;
    cursor += GUARDS_SIZE.nftBurn;
  }

  if (tokenBurnEnabled) {
    const [tokenBurn] = tokenBurnBeet.deserialize(buffer, cursor);
    data.tokenBurn = tokenBurn;
    cursor += GUARDS_SIZE.tokenBurn;
  }

  if (freezeSolPaymentEnabled) {
    const [freezeSolPayment] = freezeSolPaymentBeet.deserialize(buffer, cursor);
    data.freezeSolPayment = freezeSolPayment;
    cursor += GUARDS_SIZE.freezeSolPayment;
  }

  if (freezeTokenPaymentEnabled) {
    const [freezeTokenPayment] = freezeTokenPaymentBeet.deserialize(buffer, cursor);
    data.freezeTokenPayment = freezeTokenPayment;
    cursor += GUARDS_SIZE.freezeTokenPayment;
  }

  if (programGateEnabled) {
    const [programGate] = programGateBeet.deserialize(buffer, cursor);
    data.programGate = programGate;
    cursor += GUARDS_SIZE.programGate;
  }

  if (allocationEnabled) {
    const [allocation] = allocationBeet.deserialize(buffer, cursor);
    data.allocation = allocation;
    cursor += GUARDS_SIZE.allocation;
  }

  if (token2022PaymentEnabled) {
    const [token2022Payment] = token2022PaymentBeet.deserialize(buffer, cursor);
    data.token2022Payment = token2022Payment;
    cursor += GUARDS_SIZE.token2022Payment;
  }

  return {
    guardSet: {
      botTax: data.botTax ?? null,
      solPayment: data.solPayment ?? null,
      tokenPayment: data.tokenPayment ?? null,
      startDate: data.startDate ?? null,
      thirdPartySigner: data.thirdPartySigner ?? null,
      tokenGate: data.tokenGate ?? null,
      gatekeeper: data.gateKeeper ?? null,
      endDate: data.endDate ?? null,
      allowList: data.allowList ?? null,
      mintLimit: data.mintLimit ?? null,
      nftPayment: data.nftPayment ?? null,
      redeemedAmount: data.redeemedAmount ?? null,
      addressGate: data.addressGate ?? null,
      nftGate: data.nftGate ?? null,
      nftBurn: data.nftBurn ?? null,
      tokenBurn: data.tokenBurn ?? null,
      freezeSolPayment: data.freezeSolPayment ?? null,
      freezeTokenPayment: data.freezeTokenPayment ?? null,
      programGate: data.programGate ?? null,
      allocation: data.allocation ?? null,
      token2022Payment: data.token2022Payment ?? null,
    },
    offset: cursor,
  };
}

/**
 * Serializes a `GuardSet` object to the specified buffer.
 *
 * @param buffer the byte buffer to write to.
 * @param offset the byte offset.
 * @param guardSet the `GuardSet` object.
 *
 * @returns the byte offset at the end of the serialization.
 */
function serializeGuardSet(buffer: Buffer, offset: number, guardSet: GuardSet): number {
  // saves the initial position to write the features flag
  const start = offset;
  // skip the bytes for the feature flag
  offset += u64.byteSize;

  let features = 0;
  let index = 0;

  if (guardSet.botTax) {
    botTaxBeet.write(buffer, offset, guardSet.botTax);
    offset += GUARDS_SIZE.botTax;
    features |= 1 << index;
  }
  index++;

  if (guardSet.solPayment) {
    solPaymentBeet.write(buffer, offset, guardSet.solPayment);
    offset += GUARDS_SIZE.solPayment;
    features |= 1 << index;
  }
  index++;

  if (guardSet.tokenPayment) {
    tokenPaymentBeet.write(buffer, offset, guardSet.tokenPayment);
    offset += GUARDS_SIZE.tokenPayment;
    features |= 1 << index;
  }
  index++;

  if (guardSet.startDate) {
    startDateBeet.write(buffer, offset, guardSet.startDate);
    offset += GUARDS_SIZE.startDate;
    features |= 1 << index;
  }
  index++;

  if (guardSet.thirdPartySigner) {
    thirdPartySignerBeet.write(buffer, offset, guardSet.thirdPartySigner);
    offset += GUARDS_SIZE.thirdPartySigner;
    features |= 1 << index;
  }
  index++;

  if (guardSet.tokenGate) {
    tokenGateBeet.write(buffer, offset, guardSet.tokenGate);
    offset += GUARDS_SIZE.tokenGate;
    features |= 1 << index;
  }
  index++;

  if (guardSet.gatekeeper) {
    gatekeeperBeet.write(buffer, offset, guardSet.gatekeeper);
    offset += GUARDS_SIZE.gatekeeper;
    features |= 1 << index;
  }
  index++;

  if (guardSet.endDate) {
    endDateBeet.write(buffer, offset, guardSet.endDate);
    offset += GUARDS_SIZE.endDate;
    features |= 1 << index;
  }
  index++;

  if (guardSet.allowList) {
    allowListBeet.write(buffer, offset, guardSet.allowList);
    offset += GUARDS_SIZE.allowList;
    features |= 1 << index;
  }
  index++;

  if (guardSet.mintLimit) {
    mintLimitBeet.write(buffer, offset, guardSet.mintLimit);
    offset += GUARDS_SIZE.mintLimit;
    features |= 1 << index;
  }
  index++;

  if (guardSet.nftPayment) {
    nftPaymentBeet.write(buffer, offset, guardSet.nftPayment);
    offset += GUARDS_SIZE.nftPayment;
    features |= 1 << index;
  }
  index++;

  if (guardSet.redeemedAmount) {
    redeemedAmountBeet.write(buffer, offset, guardSet.redeemedAmount);
    offset += GUARDS_SIZE.redeemedAmount;
    features |= 1 << index;
  }
  index++;

  if (guardSet.addressGate) {
    addressGateBeet.write(buffer, offset, guardSet.addressGate);
    offset += GUARDS_SIZE.addressGate;
    features |= 1 << index;
  }
  index++;

  if (guardSet.nftGate) {
    nftGateBeet.write(buffer, offset, guardSet.nftGate);
    offset += GUARDS_SIZE.nftGate;
    features |= 1 << index;
  }
  index++;

  if (guardSet.nftBurn) {
    nftBurnBeet.write(buffer, offset, guardSet.nftBurn);
    offset += GUARDS_SIZE.nftBurn;
    features |= 1 << index;
  }
  index++;

  if (guardSet.tokenBurn) {
    tokenBurnBeet.write(buffer, offset, guardSet.tokenBurn);
    offset += GUARDS_SIZE.tokenBurn;
    features |= 1 << index;
  }
  index++;

  if (guardSet.freezeSolPayment) {
    freezeSolPaymentBeet.write(buffer, offset, guardSet.freezeSolPayment);
    offset += GUARDS_SIZE.freezeSolPayment;
    features |= 1 << index;
  }
  index++;

  if (guardSet.freezeTokenPayment) {
    freezeTokenPaymentBeet.write(buffer, offset, guardSet.freezeTokenPayment);
    offset += GUARDS_SIZE.freezeTokenPayment;
    features |= 1 << index;
  }
  index++;

  if (guardSet.programGate) {
    if (
      guardSet.programGate.additional &&
      guardSet.programGate.additional.length > MAX_PROGRAM_COUNT
    ) {
      throw `Exceeded maximum number of programs on additional list:\
        ${guardSet.programGate.additional.length} > ${MAX_PROGRAM_COUNT}`;
    }

    const [data] = programGateBeet.serialize(guardSet.programGate, GUARDS_SIZE.programGate);
    data.copy(buffer, offset);
    offset += GUARDS_SIZE.programGate;
    features |= 1 << index;
  }
  index++;

  if (guardSet.allocation) {
    allocationBeet.write(buffer, offset, guardSet.allocation);
    offset += GUARDS_SIZE.allocation;
    features |= 1 << index;
  }
  index++;

  if (guardSet.token2022Payment) {
    token2022PaymentBeet.write(buffer, offset, guardSet.token2022Payment);
    offset += GUARDS_SIZE.token2022Payment;
    features |= 1 << index;
  }
  index++;

  u64.write(buffer, start, features);

  return offset;
}
