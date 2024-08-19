import { none, Option, OptionOrNullable } from '@metaplex-foundation/umi';
import {
  AddressGate,
  AddressGateArgs,
  Allocation,
  AllocationArgs,
  AllowList,
  AllowListArgs,
  BotTax,
  BotTaxArgs,
  EndDate,
  EndDateArgs,
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
  ProgramGate,
  ProgramGateArgs,
  RedeemedAmount,
  RedeemedAmountArgs,
  SolPayment,
  SolPaymentArgs,
  StartDate,
  StartDateArgs,
  ThirdPartySigner,
  ThirdPartySignerArgs,
  Token2022Payment,
  Token2022PaymentArgs,
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
import { AllocationMintArgs, AllocationRouteArgs } from './allocation';
import { AllowListMintArgs, AllowListRouteArgs } from './allowList';
import { GatekeeperMintArgs } from './gatekeeper';
import { MintLimitMintArgs } from './mintLimit';
import { NftBurnMintArgs } from './nftBurn';
import { NftGateMintArgs } from './nftGate';
import { NftPaymentMintArgs } from './nftPayment';
import { ThirdPartySignerMintArgs } from './thirdPartySigner';
import { Token2022PaymentMintArgs } from './token2022Payment';
import { TokenBurnMintArgs } from './tokenBurn';
import { TokenGateMintArgs } from './tokenGate';
import { TokenPaymentMintArgs } from './tokenPayment';

/**
 * The arguments for all default Gumball Machine guards.
 */
export type DefaultGuardSetArgs = GuardSetArgs & {
  botTax: OptionOrNullable<BotTaxArgs>;
  solPayment: OptionOrNullable<SolPaymentArgs>;
  tokenPayment: OptionOrNullable<TokenPaymentArgs>;
  startDate: OptionOrNullable<StartDateArgs>;
  thirdPartySigner: OptionOrNullable<ThirdPartySignerArgs>;
  tokenGate: OptionOrNullable<TokenGateArgs>;
  gatekeeper: OptionOrNullable<GatekeeperArgs>;
  endDate: OptionOrNullable<EndDateArgs>;
  allowList: OptionOrNullable<AllowListArgs>;
  mintLimit: OptionOrNullable<MintLimitArgs>;
  nftPayment: OptionOrNullable<NftPaymentArgs>;
  redeemedAmount: OptionOrNullable<RedeemedAmountArgs>;
  addressGate: OptionOrNullable<AddressGateArgs>;
  nftGate: OptionOrNullable<NftGateArgs>;
  nftBurn: OptionOrNullable<NftBurnArgs>;
  tokenBurn: OptionOrNullable<TokenBurnArgs>;
  programGate: OptionOrNullable<ProgramGateArgs>;
  allocation: OptionOrNullable<AllocationArgs>;
  token2022Payment: OptionOrNullable<Token2022PaymentArgs>;
};

/**
 * The data for all default Gumball Machine guards.
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
  programGate: Option<ProgramGate>;
  allocation: Option<Allocation>;
  token2022Payment: Option<Token2022Payment>;
};

/**
 * The mint arguments for all default Gumball Machine guards.
 */
export type DefaultGuardSetMintArgs = GuardSetMintArgs & {
  // botTax: no mint settings
  solPayment: OptionOrNullable<boolean>;
  tokenPayment: OptionOrNullable<TokenPaymentMintArgs>;
  // startDate: no mint settings
  thirdPartySigner: OptionOrNullable<ThirdPartySignerMintArgs>;
  tokenGate: OptionOrNullable<TokenGateMintArgs>;
  gatekeeper: OptionOrNullable<GatekeeperMintArgs>;
  // endDate: no mint settings
  allowList: OptionOrNullable<AllowListMintArgs>;
  mintLimit: OptionOrNullable<MintLimitMintArgs>;
  nftPayment: OptionOrNullable<NftPaymentMintArgs>;
  // redeemedAmount: no mint settings
  // addressGate: no mint settings
  nftGate: OptionOrNullable<NftGateMintArgs>;
  nftBurn: OptionOrNullable<NftBurnMintArgs>;
  tokenBurn: OptionOrNullable<TokenBurnMintArgs>;
  // programGate: no mint settings
  allocation: OptionOrNullable<AllocationMintArgs>;
  token2022Payment: OptionOrNullable<Token2022PaymentMintArgs>;
};

/**
 * The route arguments for all default Gumball Machine guards.
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
  // programGate: no route settings
  allocation: AllocationRouteArgs;
  // token2022Payment: no route settings
};

/** @internal */
export const defaultGumballGuardNames: string[] = [
  'botTax',
  'startDate',
  'solPayment',
  'tokenPayment',
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
  'programGate',
  'allocation',
  'token2022Payment',
];

/** @internal */
export const emptyDefaultGuardSetArgs: DefaultGuardSetArgs =
  defaultGumballGuardNames.reduce((acc, name) => {
    acc[name] = none();
    return acc;
  }, {} as DefaultGuardSetArgs);
