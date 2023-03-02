import { Context, Pda, PublicKey } from '@metaplex-foundation/umi';

export function findCandyMachineAuthorityPda(
  context: Pick<Context, 'serializer' | 'eddsa' | 'programs'>,
  seeds: {
    /** The Candy Machine address */
    candyMachine: PublicKey;
  }
): Pda {
  const s = context.serializer;
  const programId = context.programs.get('mplCandyMachineCore').publicKey;
  return context.eddsa.findPda(programId, [
    s.string({ size: 'variable' }).serialize('candy_machine'),
    s.publicKey().serialize(seeds.candyMachine),
  ]);
}
