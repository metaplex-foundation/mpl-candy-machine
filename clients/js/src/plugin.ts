import { UmiPlugin } from '@metaplex-foundation/umi';
import {
  getMplSystemExtrasProgram,
  getMplTokenExtrasProgram,
  getSplAddressLookupTableProgram,
  getSplAssociatedTokenProgram,
  getSplMemoProgram,
  getSplSystemProgram,
  getSplTokenProgram,
} from './generated';

export const mplEssentials = (): UmiPlugin => ({
  install(umi) {
    umi.programs.add(getSplSystemProgram(), false);
    umi.programs.add(getSplMemoProgram(), false);
    umi.programs.add(getSplTokenProgram(), false);
    umi.programs.add(getSplAssociatedTokenProgram(), false);
    umi.programs.add(getSplAddressLookupTableProgram(), false);
    umi.programs.add(getMplSystemExtrasProgram(), false);
    umi.programs.add(getMplTokenExtrasProgram(), false);
  },
});
