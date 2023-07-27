import {
  MetadataDelegateRole,
  findCollectionAuthorityRecordPda,
  findMasterEditionPda,
  findMetadataDelegateRecordPda,
  findMetadataPda,
  getMplTokenMetadataProgramId,
} from '@metaplex-foundation/mpl-token-metadata';
import {
  createLut,
  getSysvar,
  getSplAssociatedTokenProgramId,
  getSplTokenProgramId,
} from '@metaplex-foundation/mpl-toolbox';
import {
  AddressLookupTableInput,
  Context,
  PublicKey,
  Signer,
  TransactionBuilder,
  uniquePublicKeys,
} from '@metaplex-foundation/umi';
import {
  AccountVersion,
  fetchCandyMachine,
  getMplCandyMachineCoreProgramId,
} from './generated';
import { findCandyMachineAuthorityPda } from './hooked';

export const createLutForCandyMachine = async (
  context: Pick<Context, 'rpc' | 'eddsa' | 'programs' | 'identity' | 'payer'>,
  recentSlot: number,
  candyMachine: PublicKey,
  collectionUpdateAuthority?: PublicKey,
  lutAuthority?: Signer
): Promise<[TransactionBuilder, AddressLookupTableInput]> => {
  const addresses = await getLutAddressesForCandyMachine(
    context,
    candyMachine,
    collectionUpdateAuthority
  );

  return createLut(context, {
    recentSlot,
    addresses,
    authority: lutAuthority,
  });
};

export const getLutAddressesForCandyMachine = async (
  context: Pick<Context, 'rpc' | 'eddsa' | 'programs' | 'identity'>,
  candyMachine: PublicKey,
  collectionUpdateAuthority?: PublicKey
): Promise<PublicKey[]> => {
  const candyMachineAccount = await fetchCandyMachine(context, candyMachine);
  const { mintAuthority, collectionMint } = candyMachineAccount;
  collectionUpdateAuthority ??= context.identity.publicKey;
  const [collectionAuthorityPda] = findCandyMachineAuthorityPda(context, {
    candyMachine,
  });
  const [delegateRecordV1] = findCollectionAuthorityRecordPda(context, {
    mint: collectionMint,
    collectionAuthority: collectionAuthorityPda,
  });
  const [delegateRecordV2] = findMetadataDelegateRecordPda(context, {
    mint: collectionMint,
    delegateRole: MetadataDelegateRole.Collection,
    updateAuthority: collectionUpdateAuthority,
    delegate: collectionAuthorityPda,
  });

  return uniquePublicKeys([
    candyMachine,
    mintAuthority,
    collectionMint,
    findMetadataPda(context, { mint: collectionMint })[0],
    findMasterEditionPda(context, { mint: collectionMint })[0],
    collectionUpdateAuthority,
    findCandyMachineAuthorityPda(context, { candyMachine })[0],
    candyMachineAccount.version === AccountVersion.V1
      ? delegateRecordV1
      : delegateRecordV2,
    getSysvar('instructions'),
    getSysvar('slotHashes'),
    getSplTokenProgramId(context),
    getSplAssociatedTokenProgramId(context),
    getMplTokenMetadataProgramId(context),
    getMplCandyMachineCoreProgramId(context),
  ]);
};
