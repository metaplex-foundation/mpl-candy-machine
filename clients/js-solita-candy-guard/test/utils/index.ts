export * from './asserts';
export * from './constants';
export * from './errors';
export * from './helper';
export * from './minter';

import { CandyMachineData } from '@metaplex-foundation/mpl-candy-machine-core';
import { Keypair, PublicKey } from '@solana/web3.js';
import { BN } from 'bn.js';
import { HIDDEN_SECTION } from './constants';

export async function getCandyGuardPDA(programId: PublicKey, base: Keypair): Promise<PublicKey> {
  return await PublicKey.findProgramAddress(
    [Buffer.from('candy_guard'), base.publicKey.toBuffer()],
    programId,
  ).then((result) => {
    return result[0];
  });
}

export function getCandyMachineSpace(data: CandyMachineData): number {
  if (data.configLineSettings == null) {
    return HIDDEN_SECTION;
  } else {
    const items = new BN(data.itemsAvailable).toNumber();
    return (
      HIDDEN_SECTION +
      4 +
      items * (data.configLineSettings.nameLength + data.configLineSettings.uriLength) +
      (Math.ceil(items / 8) + 1) +
      items * 4 +
      8
    );
  }
}
