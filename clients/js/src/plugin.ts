import { mplTokenMetadata } from '@metaplex-foundation/mpl-token-metadata';
import { UmiPlugin } from '@metaplex-foundation/umi';
import {
  getMplCandyGuardProgram,
  getMplCandyMachineCoreProgram,
} from './generated';
import {
  CandyGuardProgram,
  defaultCandyGuardNames,
  DefaultGuardRepository,
  endDateGuardManifest,
  gatekeeperGuardManifest,
  GuardRepository,
  solPaymentGuardManifest,
  startDateGuardManifest,
  thirdPartySignerGuardManifest,
  tokenGateGuardManifest,
  tokenPaymentGuardManifest,
} from './guards';
import { botTaxGuardManifest } from './guards/botTax';

export const mplCandyMachine = (): UmiPlugin => ({
  install(umi) {
    umi.use(mplTokenMetadata());

    // Programs.
    umi.programs.add(getMplCandyMachineCoreProgram(), false);
    umi.programs.add(
      {
        ...getMplCandyGuardProgram(),
        availableGuards: defaultCandyGuardNames,
      } as CandyGuardProgram,
      false
    );

    // Default Guards.
    umi.guards = new DefaultGuardRepository(umi);
    umi.guards.add(
      botTaxGuardManifest,
      solPaymentGuardManifest,
      tokenPaymentGuardManifest,
      startDateGuardManifest,
      thirdPartySignerGuardManifest,
      tokenGateGuardManifest,
      gatekeeperGuardManifest,
      endDateGuardManifest
    );
  },
});

declare module '@metaplex-foundation/umi' {
  interface Umi {
    guards: GuardRepository;
  }
}
