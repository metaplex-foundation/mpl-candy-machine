import {
  ClusterFilter,
  Context,
  Program,
  PublicKey,
  publicKey,
} from '@metaplex-foundation/umi';

export const CIVIC_GATEWAY_PROGRAM_ID = publicKey(
  'gatem74V238djXdzWnJf94Wo1DcnuGkfijbf3AuBhfs'
);

export function createCivicGatewayProgram(): Program {
  return {
    name: 'civicGateway',
    publicKey: CIVIC_GATEWAY_PROGRAM_ID,
    getErrorFromCode: () => null,
    getErrorFromName: () => null,
    isOnCluster: () => true,
  };
}

export function getCivicGatewayProgram<T extends Program = Program>(
  context: Pick<Context, 'programs'>,
  clusterFilter?: ClusterFilter
): T {
  return context.programs.get<T>('civicGateway', clusterFilter);
}

export function getCivicGatewayProgramId(
  context: Pick<Context, 'programs'>,
  clusterFilter?: ClusterFilter
): PublicKey {
  return context.programs.getPublicKey(
    'civicGateway',
    CIVIC_GATEWAY_PROGRAM_ID,
    clusterFilter
  );
}
