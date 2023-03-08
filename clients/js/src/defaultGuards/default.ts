import { none, Option } from '@metaplex-foundation/umi';
import {
  AddressGate,
  AddressGateArgs,
  AllowList,
  AllowListArgs,
  BotTax,
  BotTaxArgs,
  EndDate,
  EndDateArgs,
  FreezeSolPayment,
  FreezeSolPaymentArgs,
  FreezeTokenPayment,
  FreezeTokenPaymentArgs,
  Gatekeeper,
  GatekeeperArgs,
  MintLimit,
  MintLimitArgs,
  NftBurn,
  NftBurnArgs,
  NftGate,
  NftGateArgs,
  NftPayment,
  NftPaymentArgs,
  RedeemedAmount,
  RedeemedAmountArgs,
  SolPayment,
  SolPaymentArgs,
  StartDate,
  StartDateArgs,
  ThirdPartySigner,
  ThirdPartySignerArgs,
  TokenBurn,
  TokenBurnArgs,
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
import { AllowListMintArgs, AllowListRouteArgs } from './allowList';
import {
  FreezeSolPaymentMintArgs,
  FreezeSolPaymentRouteArgs,
} from './freezeSolPayment';
import {
  FreezeTokenPaymentMintArgs,
  FreezeTokenPaymentRouteArgs,
} from './freezeTokenPayment';
import { GatekeeperMintArgs } from './gatekeeper';
import { MintLimitMintArgs } from './mintLimit';
import { NftBurnMintArgs } from './nftBurn';
import { NftGateMintArgs } from './nftGate';
import { NftPaymentMintArgs } from './nftPayment';
import { SolPaymentMintArgs } from './solPayment';
import { ThirdPartySignerMintArgs } from './thirdPartySigner';
import { TokenBurnMintArgs } from './tokenBurn';
import { TokenGateMintArgs } from './tokenGate';
import { TokenPaymentMintArgs } from './tokenPayment';

/**
 * The arguments for all default Candy Machine guards.
 */
export type DefaultGuardSetArgs = GuardSetArgs & {
  botTax: Option<BotTaxArgs>;
  solPayment: Option<SolPaymentArgs>;
  tokenPayment: Option<TokenPaymentArgs>;
  startDate: Option<StartDateArgs>;
  thirdPartySigner: Option<ThirdPartySignerArgs>;
  tokenGate: Option<TokenGateArgs>;
  gatekeeper: Option<GatekeeperArgs>;
  endDate: Option<EndDateArgs>;
  allowList: Option<AllowListArgs>;
  mintLimit: Option<MintLimitArgs>;
  nftPayment: Option<NftPaymentArgs>;
  redeemedAmount: Option<RedeemedAmountArgs>;
  addressGate: Option<AddressGateArgs>;
  nftGate: Option<NftGateArgs>;
  nftBurn: Option<NftBurnArgs>;
  tokenBurn: Option<TokenBurnArgs>;
  freezeSolPayment: Option<FreezeSolPaymentArgs>;
  freezeTokenPayment: Option<FreezeTokenPaymentArgs>;
  // programGate: Option<ProgramGateGuardSettings>;
};

/**
 * The data for all default Candy Machine guards.
 */
export type DefaultGuardSet = GuardSet & {
  botTax: Option<BotTax>;
  solPayment: Option<SolPayment>;
  tokenPayment: Option<TokenPayment>;
  startDate: Option<StartDate>;
  thirdPartySigner: Option<ThirdPartySigner>;
  tokenGate: Option<TokenGate>;
  gatekeeper: Option<Gatekeeper>;
  endDate: Option<EndDate>;
  allowList: Option<AllowList>;
  mintLimit: Option<MintLimit>;
  nftPayment: Option<NftPayment>;
  redeemedAmount: Option<RedeemedAmount>;
  addressGate: Option<AddressGate>;
  nftGate: Option<NftGate>;
  nftBurn: Option<NftBurn>;
  tokenBurn: Option<TokenBurn>;
  freezeSolPayment: Option<FreezeSolPayment>;
  freezeTokenPayment: Option<FreezeTokenPayment>;
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
  allowList: Option<AllowListMintArgs>;
  mintLimit: Option<MintLimitMintArgs>;
  nftPayment: Option<NftPaymentMintArgs>;
  // redeemedAmount: no mint settings
  // addressGate: no mint settings
  nftGate: Option<NftGateMintArgs>;
  nftBurn: Option<NftBurnMintArgs>;
  tokenBurn: Option<TokenBurnMintArgs>;
  freezeSolPayment: Option<FreezeSolPaymentMintArgs>;
  freezeTokenPayment: Option<FreezeTokenPaymentMintArgs>;
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
  allowList: AllowListRouteArgs;
  // mintLimit: no route settings
  // nftPayment: no route settings
  // redeemedAmount: no route settings
  // addressGate: no route settings
  // nftGate: no route settings
  // nftBurn: no route settings
  // tokenBurn: no route settings
  freezeSolPayment: FreezeSolPaymentRouteArgs;
  freezeTokenPayment: FreezeTokenPaymentRouteArgs;
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
  'allowList',
  'mintLimit',
  'nftPayment',
  'redeemedAmount',
  'addressGate',
  'nftGate',
  'nftBurn',
  'tokenBurn',
  'freezeSolPayment',
  'freezeTokenPayment',
  // 'programGate',
];

/** @internal */
export const emptyDefaultGuardSetArgs: DefaultGuardSetArgs =
  defaultCandyGuardNames.reduce((acc, name) => {
    acc[name] = none();
    return acc;
  }, {} as DefaultGuardSetArgs);
