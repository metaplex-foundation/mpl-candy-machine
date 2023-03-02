import { mplTokenMetadata } from '@metaplex-foundation/mpl-token-metadata';
import { UmiPlugin } from '@metaplex-foundation/umi';
import {
  getMplCandyGuardProgram,
  getMplCandyMachineCoreProgram,
} from './generated';

export const mplCandyMachine = (): UmiPlugin => ({
  install(umi) {
    umi.use(mplTokenMetadata());
    umi.programs.add(getMplCandyMachineCoreProgram(), false);
    umi.programs.add(getMplCandyGuardProgram(), false);
  },
});
