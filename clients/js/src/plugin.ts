import { mplTokenMetadata } from '@metaplex-foundation/mpl-token-metadata';
import { publicKey, UmiPlugin } from '@metaplex-foundation/umi';
import {
  addressGateGuardManifest,
  allowListGuardManifest,
  botTaxGuardManifest,
  defaultCandyGuardNames,
  endDateGuardManifest,
  freezeSolPaymentGuardManifest,
  freezeTokenPaymentGuardManifest,
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
  tokenBurnGuardManifest,
  tokenGateGuardManifest,
  tokenPaymentGuardManifest,
} from './defaultGuards';
import {
  createMplCandyGuardProgram,
  createMplCandyMachineCoreProgram,
} from './generated';
import {
  CandyGuardProgram,
  DefaultGuardRepository,
  GuardRepository,
} from './guards';

export const mplCandyMachine = (): UmiPlugin => ({
  install(umi) {
    umi.use(mplTokenMetadata());

    // Programs.
    umi.programs.add(createMplCandyMachineCoreProgram(), false);
    umi.programs.add(
      {
        ...createMplCandyGuardProgram(),
        availableGuards: defaultCandyGuardNames,
      } as CandyGuardProgram,
      false
    );
    umi.programs.add(
      {
        name: 'civicGateway',
        publicKey: publicKey('gatem74V238djXdzWnJf94Wo1DcnuGkfijbf3AuBhfs'),
        getErrorFromCode: () => null,
        getErrorFromName: () => null,
        isOnCluster: () => true,
      },
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
      endDateGuardManifest,
      allowListGuardManifest,
      mintLimitGuardManifest,
      nftPaymentGuardManifest,
      redeemedAmountGuardManifest,
      addressGateGuardManifest,
      nftGateGuardManifest,
      nftBurnGuardManifest,
      tokenBurnGuardManifest,
      freezeSolPaymentGuardManifest,
      freezeTokenPaymentGuardManifest,
      programGateGuardManifest
    );
  },
});

declare module '@metaplex-foundation/umi' {
  interface Umi {
    guards: GuardRepository;
  }
}
