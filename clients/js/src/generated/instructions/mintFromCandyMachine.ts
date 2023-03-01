/**
 * This code was AUTOGENERATED using the kinobi library.
 * Please DO NOT EDIT THIS FILE, instead use visitors
 * to add features, then rerun kinobi to update it.
 *
 * @see https://github.com/metaplex-foundation/kinobi
 */

import {
  AccountMeta,
  Context,
  PublicKey,
  Serializer,
  Signer,
  WrappedInstruction,
  checkForIsWritableOverride as isWritable,
  mapSerializer,
} from '@metaplex-foundation/umi';

// Accounts.
export type MintFromCandyMachineInstructionAccounts = {
  candyMachine: PublicKey;
  authorityPda: PublicKey;
  mintAuthority: Signer;
  payer?: Signer;
  nftMint: PublicKey;
  nftMintAuthority: Signer;
  nftMetadata: PublicKey;
  nftMasterEdition: PublicKey;
  collectionAuthorityRecord: PublicKey;
  collectionMint: PublicKey;
  collectionMetadata: PublicKey;
  collectionMasterEdition: PublicKey;
  collectionUpdateAuthority: PublicKey;
  tokenMetadataProgram: PublicKey;
  tokenProgram?: PublicKey;
  systemProgram?: PublicKey;
  recentSlothashes: PublicKey;
};

// Arguments.
export type MintFromCandyMachineInstructionData = {
  discriminator: Array<number>;
};

export type MintFromCandyMachineInstructionDataArgs = {};

export function getMintFromCandyMachineInstructionDataSerializer(
  context: Pick<Context, 'serializer'>
): Serializer<
  MintFromCandyMachineInstructionDataArgs,
  MintFromCandyMachineInstructionData
> {
  const s = context.serializer;
  return mapSerializer<
    MintFromCandyMachineInstructionDataArgs,
    MintFromCandyMachineInstructionData,
    MintFromCandyMachineInstructionData
  >(
    s.struct<MintFromCandyMachineInstructionData>(
      [['discriminator', s.array(s.u8(), { size: 8 })]],
      { description: 'MintFromCandyMachineInstructionData' }
    ),
    (value) =>
      ({
        ...value,
        discriminator: [51, 57, 225, 47, 182, 146, 137, 166],
      } as MintFromCandyMachineInstructionData)
  ) as Serializer<
    MintFromCandyMachineInstructionDataArgs,
    MintFromCandyMachineInstructionData
  >;
}

// Instruction.
export function mintFromCandyMachine(
  context: Pick<Context, 'serializer' | 'programs' | 'payer'>,
  input: MintFromCandyMachineInstructionAccounts
): WrappedInstruction {
  const signers: Signer[] = [];
  const keys: AccountMeta[] = [];

  // Program ID.
  const programId: PublicKey = context.programs.get(
    'mplCandyMachineCore'
  ).publicKey;

  // Resolved accounts.
  const candyMachineAccount = input.candyMachine;
  const authorityPdaAccount = input.authorityPda;
  const mintAuthorityAccount = input.mintAuthority;
  const payerAccount = input.payer ?? context.payer;
  const nftMintAccount = input.nftMint;
  const nftMintAuthorityAccount = input.nftMintAuthority;
  const nftMetadataAccount = input.nftMetadata;
  const nftMasterEditionAccount = input.nftMasterEdition;
  const collectionAuthorityRecordAccount = input.collectionAuthorityRecord;
  const collectionMintAccount = input.collectionMint;
  const collectionMetadataAccount = input.collectionMetadata;
  const collectionMasterEditionAccount = input.collectionMasterEdition;
  const collectionUpdateAuthorityAccount = input.collectionUpdateAuthority;
  const tokenMetadataProgramAccount = input.tokenMetadataProgram;
  const tokenProgramAccount = input.tokenProgram ?? {
    ...context.programs.get('splToken').publicKey,
    isWritable: false,
  };
  const systemProgramAccount = input.systemProgram ?? {
    ...context.programs.get('splSystem').publicKey,
    isWritable: false,
  };
  const recentSlothashesAccount = input.recentSlothashes;

  // Candy Machine.
  keys.push({
    pubkey: candyMachineAccount,
    isSigner: false,
    isWritable: isWritable(candyMachineAccount, true),
  });

  // Authority Pda.
  keys.push({
    pubkey: authorityPdaAccount,
    isSigner: false,
    isWritable: isWritable(authorityPdaAccount, true),
  });

  // Mint Authority.
  signers.push(mintAuthorityAccount);
  keys.push({
    pubkey: mintAuthorityAccount.publicKey,
    isSigner: true,
    isWritable: isWritable(mintAuthorityAccount, false),
  });

  // Payer.
  signers.push(payerAccount);
  keys.push({
    pubkey: payerAccount.publicKey,
    isSigner: true,
    isWritable: isWritable(payerAccount, true),
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

  // Nft Metadata.
  keys.push({
    pubkey: nftMetadataAccount,
    isSigner: false,
    isWritable: isWritable(nftMetadataAccount, true),
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

  // Data.
  const data = getMintFromCandyMachineInstructionDataSerializer(
    context
  ).serialize({});

  // Bytes Created On Chain.
  const bytesCreatedOnChain = 0;

  return {
    instruction: { keys, programId, data },
    signers,
    bytesCreatedOnChain,
  };
}
