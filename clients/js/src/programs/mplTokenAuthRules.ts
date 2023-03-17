import {
  ClusterFilter,
  Context,
  Program,
  PublicKey,
  publicKey,
} from '@metaplex-foundation/umi';

export const MPL_TOKEN_AUTH_RULES_PROGRAM_ID = publicKey(
  'auth9SigNpDKz4sJJ1DfCTuZrZNSAgh9sFD3rboVmgg'
);

export function createMplTokenAuthRulesProgram(): Program {
  return {
    name: 'mplTokenAuthRules',
    publicKey: MPL_TOKEN_AUTH_RULES_PROGRAM_ID,
    getErrorFromCode: () => null,
    getErrorFromName: () => null,
    isOnCluster: () => true,
  };
}

export function getMplTokenAuthRulesProgram<T extends Program = Program>(
  context: Pick<Context, 'programs'>,
  clusterFilter?: ClusterFilter
): T {
  return context.programs.get<T>('mplTokenAuthRules', clusterFilter);
}

export function getMplTokenAuthRulesProgramId(
  context: Pick<Context, 'programs'>,
  clusterFilter?: ClusterFilter
): PublicKey {
  return context.programs.getPublicKey(
    'mplTokenAuthRules',
    MPL_TOKEN_AUTH_RULES_PROGRAM_ID,
    clusterFilter
  );
}
