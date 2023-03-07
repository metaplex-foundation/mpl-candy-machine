import { none, Option } from '@metaplex-foundation/umi';
import {
  AddressGate,
  AddressGateArgs,
  BotTax,
  BotTaxArgs,
  EndDate,
  EndDateArgs,
  Gatekeeper,
  GatekeeperArgs,
  SolPayment,
  SolPaymentArgs,
  StartDate,
  StartDateArgs,
  ThirdPartySigner,
  ThirdPartySignerArgs,
  TokenGate,
  TokenGateArgs,
  TokenPayment,
  TokenPaymentArgs,
} from '../generated';
import {
  GuardSet,
  GuardSetArgs,
  GuardSetMintArgs,
  GuardSetRouteArgs,
} from '../guards/guardSet';
import { GatekeeperMintArgs } from './gatekeeper';
import { SolPaymentMintArgs } from './solPayment';
import { ThirdPartySignerMintArgs } from './thirdPartySigner';
import { TokenGateMintArgs } from './tokenGate';
import { TokenPaymentMintArgs } from './tokenPayment';

/**
 * The arguments for all default Candy Machine guards.
 */
export type DefaultGuardSetDataArgs = GuardSetArgs & {
  botTax: Option<BotTaxArgs>;
  solPayment: Option<SolPaymentArgs>;
  tokenPayment: Option<TokenPaymentArgs>;
  startDate: Option<StartDateArgs>;
  thirdPartySigner: Option<ThirdPartySignerArgs>;
  tokenGate: Option<TokenGateArgs>;
  gatekeeper: Option<GatekeeperArgs>;
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
export type DefaultGuardSetData = GuardSet & {
  botTax: Option<BotTax>;
  solPayment: Option<SolPayment>;
  tokenPayment: Option<TokenPayment>;
  startDate: Option<StartDate>;
  thirdPartySigner: Option<ThirdPartySigner>;
  tokenGate: Option<TokenGate>;
  gatekeeper: Option<Gatekeeper>;
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
  thirdPartySigner: Option<ThirdPartySignerMintArgs>;
  tokenGate: Option<TokenGateMintArgs>;
  gatekeeper: Option<GatekeeperMintArgs>;
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
  //* allowList: AllowListGuardRouteSettings;
  // mintLimit: no route settings
  // nftPayment: no route settings
  // redeemedAmount: no route settings
  // addressGate: no route settings
  // nftGate: no route settings
  // nftBurn: no route settings
  // tokenBurn: no route settings
  //* freezeSolPayment: FreezeSolPaymentGuardRouteSettings;
  //* freezeTokenPayment: FreezeTokenPaymentGuardRouteSettings;
  // programGate: no route settings
};

/** @internal */
export const defaultCandyGuardNames: string[] = [
  'botTax',
  'solPayment',
  'tokenPayment',
  'startDate',
  'thirdPartySigner',
  'tokenGate',
  'gatekeeper',
  'endDate',
  // 'allowList',
  // 'mintLimit',
  // 'nftPayment',
  // 'redeemedAmount',
  // 'addressGate',
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
