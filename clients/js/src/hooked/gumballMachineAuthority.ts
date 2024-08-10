import { Context, Pda, PublicKey } from '@metaplex-foundation/umi';
import { publicKey, string } from '@metaplex-foundation/umi/serializers';

export function findGumballMachineAuthorityPda(
  context: Pick<Context, 'eddsa' | 'programs'>,
  seeds: {
    /** The Gumball Machine address */
    gumballMachine: PublicKey;
  }
): Pda {
  const programId = context.programs.get('mallowGumball').publicKey;
  return context.eddsa.findPda(programId, [
    string({ size: 'variable' }).serialize('gumball_machine'),
    publicKey().serialize(seeds.gumballMachine),
  ]);
}
