import { none, Option } from '@metaplex-foundation/umi';
import {
  AddressGate,
  AddressGateArgs,
  BotTax,
  BotTaxArgs,
  EndDate,
  EndDateArgs,
  SolPayment,
  SolPaymentArgs,
  StartDate,
  StartDateArgs,
  TokenPayment,
  TokenPaymentArgs,
} from '../generated';
import {
  GuardSetData,
  GuardSetDataArgs,
  GuardSetMintArgs,
  GuardSetRouteArgs,
} from './core';
import { SolPaymentMintArgs } from './solPayment';
import { TokenPaymentMintArgs } from './tokenPayment';

/**
 * The arguments for all default Candy Machine guards.
 */
export type DefaultGuardSetDataArgs = GuardSetDataArgs & {
  botTax: Option<BotTaxArgs>;
  solPayment: Option<SolPaymentArgs>;
  tokenPayment: Option<TokenPaymentArgs>;
  startDate: Option<StartDateArgs>;
  // thirdPartySigner: Option<ThirdPartySignerGuardSettings>;
  // tokenGate: Option<TokenGateGuardSettings>;
  // gatekeeper: Option<GatekeeperGuardSettings>;
  endDate: Option<EndDateArgs>;
  // allowList: Option<AllowListGuardSettings>;
  // mintLimit: Option<MintLimitGuardSettings>;
  // nftPayment: Option<NftPaymentGuardSettings>;
  // redeemedAmount: Option<RedeemedAmountGuardSettings>;
  addressGate: Option<AddressGateArgs>;
  // nftGate: Option<NftGateGuardSettings>;
  // nftBurn: Option<NftBurnGuardSettings>;
  // tokenBurn: Option<TokenBurnGuardSettings>;
  // freezeSolPayment: Option<FreezeSolPaymentGuardSettings>;
  // freezeTokenPayment: Option<FreezeTokenPaymentGuardSettings>;
  // programGate: Option<ProgramGateGuardSettings>;
};

/**
 * The data for all default Candy Machine guards.
 */
export type DefaultGuardSetData = GuardSetData & {
  botTax: Option<BotTax>;
  solPayment: Option<SolPayment>;
  tokenPayment: Option<TokenPayment>;
  startDate: Option<StartDate>;
  // thirdPartySigner: Option<ThirdPartySignerGuardSettings>;
  // tokenGate: Option<TokenGateGuardSettings>;
  // gatekeeper: Option<GatekeeperGuardSettings>;
  endDate: Option<EndDate>;
  // allowList: Option<AllowListGuardSettings>;
  // mintLimit: Option<MintLimitGuardSettings>;
  // nftPayment: Option<NftPaymentGuardSettings>;
  // redeemedAmount: Option<RedeemedAmountGuardSettings>;
  addressGate: Option<AddressGate>;
  // nftGate: Option<NftGateGuardSettings>;
  // nftBurn: Option<NftBurnGuardSettings>;
  // tokenBurn: Option<TokenBurnGuardSettings>;
  // freezeSolPayment: Option<FreezeSolPaymentGuardSettings>;
  // freezeTokenPayment: Option<FreezeTokenPaymentGuardSettings>;
  // programGate: Option<ProgramGateGuardSettings>;
};

/**
 * The mint arguments for all default Candy Machine guards.
 */
export type DefaultGuardSetMintArgs = GuardSetMintArgs & {
  // botTax: no mint settings
  solPayment: Option<SolPaymentMintArgs>;
  tokenPayment: Option<TokenPaymentMintArgs>;
  // startDate: no mint settings
  // thirdPartySigner: Option<ThirdPartySignerGuardMintSettings>;
  // tokenGate: no mint settings
  // gatekeeper: Option<GatekeeperGuardMintSettings>;
  // endDate: no mint settings
  // allowList: no mint settings
  // mintLimit: no mint settings
  // nftPayment: Option<NftPaymentGuardMintSettings>;
  // redeemedAmount: no mint settings
  // addressGate: no mint settings
  // nftGate: Option<NftGateGuardMintSettings>;
  // nftBurn: Option<NftBurnGuardMintSettings>;
  // tokenBurn: no mint settings
  // freezeSolPayment: no mint settings
  // freezeTokenPayment: no mint settings
  // programGate: no mint settings
};

/**
 * The route arguments for all default Candy Machine guards.
 */
export type DefaultGuardSetRouteArgs = GuardSetRouteArgs & {
  // botTax: no route settings
  // solPayment: no route settings
  // tokenPayment: no route settings
  // startDate: no route settings
  // thirdPartySigner: no route settings
  // tokenGate: no route settings
  // gatekeeper: no route settings
  // endDate: no route settings
  // allowList: AllowListGuardRouteSettings;
  // mintLimit: no route settings
  // nftPayment: no route settings
  // redeemedAmount: no route settings
  // addressGate: no route settings
  // nftGate: no route settings
  // nftBurn: no route settings
  // tokenBurn: no route settings
  // freezeSolPayment: FreezeSolPaymentGuardRouteSettings;
  // freezeTokenPayment: FreezeTokenPaymentGuardRouteSettings;
  // programGate: no route settings
};

/** @internal */
export const defaultCandyGuardNames: string[] = [
  'botTax',
  'solPayment',
  'tokenPayment',
  'startDate',
  // 'thirdPartySigner',
  // 'tokenGate',
  // 'gatekeeper',
  'endDate',
  // 'allowList',
  // 'mintLimit',
  // 'nftPayment',
  // 'redeemedAmount',
  'addressGate',
  // 'nftGate',
  // 'nftBurn',
  // 'tokenBurn',
  // 'freezeSolPayment',
  // 'freezeTokenPayment',
  // 'programGate',
];

/** @internal */
export const emptyDefaultCandyGuardSettings: DefaultGuardSetDataArgs =
  defaultCandyGuardNames.reduce((acc, name) => {
    acc[name] = none();
    return acc;
  }, {} as DefaultGuardSetDataArgs);
