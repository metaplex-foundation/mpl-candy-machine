import { createLut } from '@metaplex-foundation/mpl-essentials';
import {
  findCollectionAuthorityRecordPda,
  findMasterEditionPda,
  findMetadataDelegateRecordPda,
  findMetadataPda,
  MetadataDelegateRole,
} from '@metaplex-foundation/mpl-token-metadata';
import {
  AddressLookupTableInput,
  Context,
  publicKey,
  PublicKey,
  Signer,
  TransactionBuilder,
  uniquePublicKeys,
} from '@metaplex-foundation/umi';
import { AccountVersion, fetchCandyMachine } from './generated';
import { findCandyMachineAuthorityPda } from './hooked';

export const createLutForCandyMachine = async (
  context: Pick<
    Context,
    'rpc' | 'serializer' | 'eddsa' | 'programs' | 'identity' | 'payer'
  >,
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
  context: Pick<
    Context,
    'rpc' | 'serializer' | 'eddsa' | 'programs' | 'identity'
  >,
  candyMachine: PublicKey,
  collectionUpdateAuthority?: PublicKey
): Promise<PublicKey[]> => {
  const candyMachineAccount = await fetchCandyMachine(context, candyMachine);
  const { mintAuthority, collectionMint } = candyMachineAccount;
  collectionUpdateAuthority ??= context.identity.publicKey;
  const collectionAuthorityPda = findCandyMachineAuthorityPda(context, {
    candyMachine,
  });
  const delegateRecordV1 = findCollectionAuthorityRecordPda(context, {
    mint: collectionMint,
    collectionAuthority: collectionAuthorityPda,
  });
  const delegateRecordV2 = findMetadataDelegateRecordPda(context, {
    mint: collectionMint,
    delegateRole: MetadataDelegateRole.Collection,
    updateAuthority: collectionUpdateAuthority,
    delegate: collectionAuthorityPda,
  });

  return uniquePublicKeys([
    candyMachine,
    mintAuthority,
    collectionMint,
    findMetadataPda(context, { mint: collectionMint }),
    findMasterEditionPda(context, { mint: collectionMint }),
    collectionUpdateAuthority ?? context.identity.publicKey,
    findCandyMachineAuthorityPda(context, { candyMachine }),
    candyMachineAccount.version === AccountVersion.V1
      ? delegateRecordV1
      : delegateRecordV2,
    publicKey('Sysvar1nstructions1111111111111111111111111'),
    publicKey('SysvarS1otHashes111111111111111111111111111'),
  ]);
};
