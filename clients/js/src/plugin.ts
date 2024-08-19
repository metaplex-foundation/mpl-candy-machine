import { mplTokenMetadata } from '@metaplex-foundation/mpl-token-metadata';
import { UmiPlugin } from '@metaplex-foundation/umi';
import {
  addressGateGuardManifest,
  allocationGuardManifest,
  allowListGuardManifest,
  botTaxGuardManifest,
  defaultGumballGuardNames,
  endDateGuardManifest,
  gatekeeperGuardManifest,
  mintLimitGuardManifest,
  nftBurnGuardManifest,
  nftGateGuardManifest,
  nftPaymentGuardManifest,
  programGateGuardManifest,
  redeemedAmountGuardManifest,
  solPaymentGuardManifest,
  startDateGuardManifest,
  thirdPartySignerGuardManifest,
  token2022PaymentGuardManifest,
  tokenBurnGuardManifest,
  tokenGateGuardManifest,
  tokenPaymentGuardManifest,
} from './defaultGuards';
import {
  createMallowGumballProgram,
  createMplCandyGuardProgram,
} from './generated';
import {
  CandyGuardProgram,
  DefaultGuardRepository,
  GuardRepository,
} from './guards';
import {
  createCivicGatewayProgram,
  createMplTokenAuthRulesProgram,
} from './programs';

export const mallowGumball = (): UmiPlugin => ({
  install(umi) {
    umi.use(mplTokenMetadata());

    // Programs.
    umi.programs.add(createMallowGumballProgram(), false);
    umi.programs.add(
      {
        ...createMplCandyGuardProgram(),
        availableGuards: defaultGumballGuardNames,
      } as CandyGuardProgram,
      false
    );
    umi.programs.add(createCivicGatewayProgram(), false);
    umi.programs.add(createMplTokenAuthRulesProgram(), false);

    // Default Guards.
    umi.guards = new DefaultGuardRepository();
    umi.guards.add(
      botTaxGuardManifest,
      startDateGuardManifest,
      solPaymentGuardManifest,
      tokenPaymentGuardManifest,
      thirdPartySignerGuardManifest,
      tokenGateGuardManifest,
      gatekeeperGuardManifest,
      endDateGuardManifest,
      allowListGuardManifest,
      mintLimitGuardManifest,
      nftPaymentGuardManifest,
      redeemedAmountGuardManifest,
      addressGateGuardManifest,
      nftGateGuardManifest,
      nftBurnGuardManifest,
      tokenBurnGuardManifest,
      programGateGuardManifest,
      allocationGuardManifest,
      token2022PaymentGuardManifest
    );
  },
});

declare module '@metaplex-foundation/umi' {
  interface Umi {
    guards: GuardRepository;
  }
}
