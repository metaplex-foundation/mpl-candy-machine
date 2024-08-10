import { getMplTokenMetadataProgramId } from '@metaplex-foundation/mpl-token-metadata';
import {
  createLut,
  getSplAssociatedTokenProgramId,
  getSplTokenProgramId,
  getSysvar,
} from '@metaplex-foundation/mpl-toolbox';
import {
  AddressLookupTableInput,
  Context,
  PublicKey,
  Signer,
  TransactionBuilder,
  uniquePublicKeys,
} from '@metaplex-foundation/umi';
import { fetchGumballMachine, getMallowGumballProgramId } from './generated';
import { findGumballGuardPda } from './hooked';

export const createLutForGumballMachine = async (
  context: Pick<Context, 'rpc' | 'eddsa' | 'programs' | 'identity' | 'payer'>,
  recentSlot: number,
  gumballMachine: PublicKey,
  lutAuthority?: Signer,
  gumballMachineAuthority?: PublicKey
): Promise<[TransactionBuilder, AddressLookupTableInput]> => {
  const addresses = await getLutAddressesForGumballMachine(
    context,
    gumballMachine,
    gumballMachineAuthority
  );

  return createLut(context, {
    recentSlot,
    addresses,
    authority: lutAuthority,
  });
};

export const getLutAddressesForGumballMachine = async (
  context: Pick<Context, 'rpc' | 'eddsa' | 'programs' | 'identity'>,
  gumballMachine: PublicKey,
  gumballMachineAuthority?: PublicKey
): Promise<PublicKey[]> => {
  const gumballMachineAccount = await fetchGumballMachine(
    context,
    gumballMachine
  );
  const { mintAuthority } = gumballMachineAccount;
  gumballMachineAuthority ??= context.identity.publicKey;

  return uniquePublicKeys([
    gumballMachine,
    findGumballGuardPda(context, { base: gumballMachine })[0],
    context.identity.publicKey,
    mintAuthority,
    getSysvar('instructions'),
    getSysvar('slotHashes'),
    getSplTokenProgramId(context),
    getSplAssociatedTokenProgramId(context),
    getMplTokenMetadataProgramId(context),
    getMallowGumballProgramId(context),
  ]);
};
