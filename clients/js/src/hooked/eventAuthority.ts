import { Context, Pda } from '@metaplex-foundation/umi';
import { string } from '@metaplex-foundation/umi/serializers';

export function findEventAuthorityPda(
  context: Pick<Context, 'eddsa' | 'programs'>
): Pda {
  const programId = context.programs.getPublicKey(
    'mallowGumball',
    'MGUMqztv7MHgoHBYWbvMyL3E3NJ4UHfTwgLJUQAbKGa'
  );
  return context.eddsa.findPda(programId, [
    string({ size: 'variable' }).serialize('__event_authority'),
  ]);
}
