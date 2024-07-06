import { getMplTokenMetadataProgramId } from '@metaplex-foundation/mpl-token-metadata';
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
  fetchCandyMachine,
  getMplCandyMachineCoreProgramId,
} from './generated';
import { findCandyGuardPda } from './hooked';

export const createLutForCandyMachine = async (
  context: Pick<Context, 'rpc' | 'eddsa' | 'programs' | 'identity' | 'payer'>,
  recentSlot: number,
  candyMachine: PublicKey,
  lutAuthority?: Signer,
  candyMachineAuthority?: PublicKey
): Promise<[TransactionBuilder, AddressLookupTableInput]> => {
  const addresses = await getLutAddressesForCandyMachine(
    context,
    candyMachine,
    candyMachineAuthority
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
  candyMachineAuthority?: PublicKey
): Promise<PublicKey[]> => {
  const candyMachineAccount = await fetchCandyMachine(context, candyMachine);
  const { mintAuthority } = candyMachineAccount;
  candyMachineAuthority ??= context.identity.publicKey;

  return uniquePublicKeys([
    candyMachine,
    findCandyGuardPda(context, { base: candyMachine })[0],
    context.identity.publicKey,
    mintAuthority,
    getSysvar('instructions'),
    getSysvar('slotHashes'),
    getSplTokenProgramId(context),
    getSplAssociatedTokenProgramId(context),
    getMplTokenMetadataProgramId(context),
    getMplCandyMachineCoreProgramId(context),
  ]);
};
