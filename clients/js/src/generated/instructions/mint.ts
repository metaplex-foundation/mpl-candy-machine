/**
 * This code was AUTOGENERATED using the kinobi library.
 * Please DO NOT EDIT THIS FILE, instead use visitors
 * to add features, then rerun kinobi to update it.
 *
 * @see https://github.com/metaplex-foundation/kinobi
 */

import {
  findCollectionAuthorityRecordPda,
  findMasterEditionPda,
  findMetadataPda,
} from '@metaplex-foundation/mpl-token-metadata';
import {
  AccountMeta,
  Context,
  Option,
  PublicKey,
  Serializer,
  Signer,
  WrappedInstruction,
  checkForIsWritableOverride as isWritable,
  mapSerializer,
  publicKey,
} from '@metaplex-foundation/umi';
import { findCandyGuardPda, findCandyMachineAuthorityPda } from '../../hooked';

// Accounts.
export type MintInstructionAccounts = {
  candyGuard?: PublicKey;
  candyMachineProgram?: PublicKey;
  candyMachine: PublicKey;
  candyMachineAuthorityPda?: PublicKey;
  payer?: Signer;
  nftMetadata?: PublicKey;
  nftMint: PublicKey;
  nftMintAuthority?: Signer;
  nftMasterEdition?: PublicKey;
  collectionAuthorityRecord?: PublicKey;
  collectionMint: PublicKey;
  collectionMetadata?: PublicKey;
  collectionMasterEdition?: PublicKey;
  collectionUpdateAuthority: PublicKey;
  tokenMetadataProgram?: PublicKey;
  tokenProgram?: PublicKey;
  systemProgram?: PublicKey;
  recentSlothashes?: PublicKey;
  instructionSysvarAccount?: PublicKey;
};

// Arguments.
export type MintInstructionData = {
  discriminator: Array<number>;
  mintArgs: Uint8Array;
  label: Option<string>;
};

export type MintInstructionDataArgs = {
  mintArgs: Uint8Array;
  label: Option<string>;
};

export function getMintInstructionDataSerializer(
  context: Pick<Context, 'serializer'>
): Serializer<MintInstructionDataArgs, MintInstructionData> {
  const s = context.serializer;
  return mapSerializer<
    MintInstructionDataArgs,
    MintInstructionData,
    MintInstructionData
  >(
    s.struct<MintInstructionData>(
      [
        ['discriminator', s.array(s.u8(), { size: 8 })],
        ['mintArgs', s.bytes()],
        ['label', s.option(s.string())],
      ],
      { description: 'MintInstructionData' }
    ),
    (value) =>
      ({
        ...value,
        discriminator: [51, 57, 225, 47, 182, 146, 137, 166],
      } as MintInstructionData)
  ) as Serializer<MintInstructionDataArgs, MintInstructionData>;
}

// Instruction.
export function mint(
  context: Pick<
    Context,
    'serializer' | 'programs' | 'eddsa' | 'identity' | 'payer'
  >,
  input: MintInstructionAccounts & MintInstructionDataArgs
): WrappedInstruction {
  const signers: Signer[] = [];
  const keys: AccountMeta[] = [];

  // Program ID.
  const programId = context.programs.getPublicKey(
    'mplCandyGuard',
    'Guard1JwRhJkVH6XZhzoYxeBVQe872VH6QggF4BWmS9g'
  );

  // Resolved accounts.
  const candyMachineAccount = input.candyMachine;
  const candyGuardAccount =
    input.candyGuard ??
    findCandyGuardPda(context, { base: publicKey(candyMachineAccount) });
  const candyMachineProgramAccount = input.candyMachineProgram ?? {
    ...context.programs.getPublicKey(
      'mplCandyMachine',
      'CndyV3LdqHUfDLmE5naZjVN8rBZz4tqhdefbAnjHG3JR'
    ),
    isWritable: false,
  };
  const candyMachineAuthorityPdaAccount =
    input.candyMachineAuthorityPda ??
    findCandyMachineAuthorityPda(context, {
      candyMachine: publicKey(candyMachineAccount),
    });
  const payerAccount = input.payer ?? context.payer;
  const nftMintAccount = input.nftMint;
  const nftMetadataAccount =
    input.nftMetadata ??
    findMetadataPda(context, { mint: publicKey(nftMintAccount) });
  const nftMintAuthorityAccount = input.nftMintAuthority ?? context.identity;
  const nftMasterEditionAccount =
    input.nftMasterEdition ??
    findMasterEditionPda(context, { mint: publicKey(nftMintAccount) });
  const collectionMintAccount = input.collectionMint;
  const collectionAuthorityRecordAccount =
    input.collectionAuthorityRecord ??
    findCollectionAuthorityRecordPda(context, {
      mint: publicKey(collectionMintAccount),
      collectionAuthority: publicKey(candyMachineAuthorityPdaAccount),
    });
  const collectionMetadataAccount =
    input.collectionMetadata ??
    findMetadataPda(context, { mint: publicKey(collectionMintAccount) });
  const collectionMasterEditionAccount =
    input.collectionMasterEdition ??
    findMasterEditionPda(context, { mint: publicKey(collectionMintAccount) });
  const collectionUpdateAuthorityAccount = input.collectionUpdateAuthority;
  const tokenMetadataProgramAccount = input.tokenMetadataProgram ?? {
    ...context.programs.getPublicKey(
      'mplTokenMetadata',
      'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s'
    ),
    isWritable: false,
  };
  const tokenProgramAccount = input.tokenProgram ?? {
    ...context.programs.getPublicKey(
      'splToken',
      'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'
    ),
    isWritable: false,
  };
  const systemProgramAccount = input.systemProgram ?? {
    ...context.programs.getPublicKey(
      'splSystem',
      '11111111111111111111111111111111'
    ),
    isWritable: false,
  };
  const recentSlothashesAccount =
    input.recentSlothashes ??
    publicKey('SysvarS1otHashes111111111111111111111111111');
  const instructionSysvarAccountAccount =
    input.instructionSysvarAccount ??
    publicKey('Sysvar1nstructions1111111111111111111111111');

  // Candy Guard.
  keys.push({
    pubkey: candyGuardAccount,
    isSigner: false,
    isWritable: isWritable(candyGuardAccount, false),
  });

  // Candy Machine Program.
  keys.push({
    pubkey: candyMachineProgramAccount,
    isSigner: false,
    isWritable: isWritable(candyMachineProgramAccount, false),
  });

  // Candy Machine.
  keys.push({
    pubkey: candyMachineAccount,
    isSigner: false,
    isWritable: isWritable(candyMachineAccount, true),
  });

  // Candy Machine Authority Pda.
  keys.push({
    pubkey: candyMachineAuthorityPdaAccount,
    isSigner: false,
    isWritable: isWritable(candyMachineAuthorityPdaAccount, true),
  });

  // Payer.
  signers.push(payerAccount);
  keys.push({
    pubkey: payerAccount.publicKey,
    isSigner: true,
    isWritable: isWritable(payerAccount, true),
  });

  // Nft Metadata.
  keys.push({
    pubkey: nftMetadataAccount,
    isSigner: false,
    isWritable: isWritable(nftMetadataAccount, true),
  });

  // Nft Mint.
  keys.push({
    pubkey: nftMintAccount,
    isSigner: false,
    isWritable: isWritable(nftMintAccount, true),
  });

  // Nft Mint Authority.
  signers.push(nftMintAuthorityAccount);
  keys.push({
    pubkey: nftMintAuthorityAccount.publicKey,
    isSigner: true,
    isWritable: isWritable(nftMintAuthorityAccount, false),
  });

  // Nft Master Edition.
  keys.push({
    pubkey: nftMasterEditionAccount,
    isSigner: false,
    isWritable: isWritable(nftMasterEditionAccount, true),
  });

  // Collection Authority Record.
  keys.push({
    pubkey: collectionAuthorityRecordAccount,
    isSigner: false,
    isWritable: isWritable(collectionAuthorityRecordAccount, false),
  });

  // Collection Mint.
  keys.push({
    pubkey: collectionMintAccount,
    isSigner: false,
    isWritable: isWritable(collectionMintAccount, false),
  });

  // Collection Metadata.
  keys.push({
    pubkey: collectionMetadataAccount,
    isSigner: false,
    isWritable: isWritable(collectionMetadataAccount, true),
  });

  // Collection Master Edition.
  keys.push({
    pubkey: collectionMasterEditionAccount,
    isSigner: false,
    isWritable: isWritable(collectionMasterEditionAccount, false),
  });

  // Collection Update Authority.
  keys.push({
    pubkey: collectionUpdateAuthorityAccount,
    isSigner: false,
    isWritable: isWritable(collectionUpdateAuthorityAccount, false),
  });

  // Token Metadata Program.
  keys.push({
    pubkey: tokenMetadataProgramAccount,
    isSigner: false,
    isWritable: isWritable(tokenMetadataProgramAccount, false),
  });

  // Token Program.
  keys.push({
    pubkey: tokenProgramAccount,
    isSigner: false,
    isWritable: isWritable(tokenProgramAccount, false),
  });

  // System Program.
  keys.push({
    pubkey: systemProgramAccount,
    isSigner: false,
    isWritable: isWritable(systemProgramAccount, false),
  });

  // Recent Slothashes.
  keys.push({
    pubkey: recentSlothashesAccount,
    isSigner: false,
    isWritable: isWritable(recentSlothashesAccount, false),
  });

  // Instruction Sysvar Account.
  keys.push({
    pubkey: instructionSysvarAccountAccount,
    isSigner: false,
    isWritable: isWritable(instructionSysvarAccountAccount, false),
  });

  // Data.
  const data = getMintInstructionDataSerializer(context).serialize(input);

  // Bytes Created On Chain.
  const bytesCreatedOnChain = 0;

  return {
    instruction: { keys, programId, data },
    signers,
    bytesCreatedOnChain,
  };
}
