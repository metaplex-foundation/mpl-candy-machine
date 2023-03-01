import { mplEssentials } from '@metaplex-foundation/mpl-essentials';
import { UmiPlugin } from '@metaplex-foundation/umi';
import {
  getMplCandyGuardProgram,
  getMplCandyMachineCoreProgram,
} from './generated';

export const mplCandyMachine = (): UmiPlugin => ({
  install(umi) {
    umi.use(mplEssentials());
    umi.programs.add(getMplCandyMachineCoreProgram(), false);
    umi.programs.add(getMplCandyGuardProgram(), false);
  },
});
