/**
 * This code was AUTOGENERATED using the kinobi library.
 * Please DO NOT EDIT THIS FILE, instead use visitors
 * to add features, then rerun kinobi to update it.
 *
 * @see https://github.com/metaplex-foundation/kinobi
 */

import {
  findMasterEditionPda,
  findMetadataDelegateRecordPda,
  findMetadataPda,
  MetadataDelegateRole,
} from '@metaplex-foundation/mpl-token-metadata';
import {
  AccountMeta,
  checkForIsWritableOverride as isWritable,
  Context,
  mapSerializer,
  PublicKey,
  publicKey,
  Serializer,
  Signer,
  TransactionBuilder,
  transactionBuilder,
} from '@metaplex-foundation/umi';
import { findCandyMachineAuthorityPda } from '../../hooked';

// Accounts.
export type SetCollectionV2InstructionAccounts = {
  candyMachine: PublicKey;
  authority?: Signer;
  authorityPda?: PublicKey;
  payer?: Signer;
  collectionUpdateAuthority: PublicKey;
  collectionMint: PublicKey;
  collectionMetadata?: PublicKey;
  collectionDelegateRecord?: PublicKey;
  newCollectionUpdateAuthority: Signer;
  newCollectionMint: PublicKey;
  newCollectionMetadata?: PublicKey;
  newCollectionMasterEdition?: PublicKey;
  newCollectionDelegateRecord?: PublicKey;
  tokenMetadataProgram?: PublicKey;
  systemProgram?: PublicKey;
  sysvarInstructions?: PublicKey;
  authorizationRulesProgram?: PublicKey;
  authorizationRules?: PublicKey;
};

// Arguments.
export type SetCollectionV2InstructionData = { discriminator: Array<number> };

export type SetCollectionV2InstructionDataArgs = {};

export function getSetCollectionV2InstructionDataSerializer(
  context: Pick<Context, 'serializer'>
): Serializer<
  SetCollectionV2InstructionDataArgs,
  SetCollectionV2InstructionData
> {
  const s = context.serializer;
  return mapSerializer<
    SetCollectionV2InstructionDataArgs,
    SetCollectionV2InstructionData,
    SetCollectionV2InstructionData
  >(
    s.struct<SetCollectionV2InstructionData>(
      [['discriminator', s.array(s.u8(), { size: 8 })]],
      { description: 'SetCollectionV2InstructionData' }
    ),
    (value) =>
      ({
        ...value,
        discriminator: [229, 35, 61, 91, 15, 14, 99, 160],
      } as SetCollectionV2InstructionData)
  ) as Serializer<
    SetCollectionV2InstructionDataArgs,
    SetCollectionV2InstructionData
  >;
}

// Instruction.
export function setCollectionV2(
  context: Pick<
    Context,
    'serializer' | 'programs' | 'eddsa' | 'identity' | 'payer'
  >,
  input: SetCollectionV2InstructionAccounts
): TransactionBuilder {
  const signers: Signer[] = [];
  const keys: AccountMeta[] = [];

  // Program ID.
  const programId = context.programs.getPublicKey(
    'mplCandyMachineCore',
    'CndyV3LdqHUfDLmE5naZjVN8rBZz4tqhdefbAnjHG3JR'
  );

  // Resolved accounts.
  const candyMachineAccount = input.candyMachine;
  const authorityAccount = input.authority ?? context.identity;
  const authorityPdaAccount =
    input.authorityPda ??
    findCandyMachineAuthorityPda(context, {
      candyMachine: publicKey(candyMachineAccount),
    });
  const payerAccount = input.payer ?? context.payer;
  const collectionUpdateAuthorityAccount = input.collectionUpdateAuthority;
  const collectionMintAccount = input.collectionMint;
  const collectionMetadataAccount =
    input.collectionMetadata ??
    findMetadataPda(context, { mint: publicKey(collectionMintAccount) });
  const collectionDelegateRecordAccount =
    input.collectionDelegateRecord ??
    findMetadataDelegateRecordPda(context, {
      mint: publicKey(collectionMintAccount),
      delegateRole: MetadataDelegateRole.Collection,
      updateAuthority: publicKey(collectionUpdateAuthorityAccount),
      delegate: publicKey(authorityPdaAccount),
    });
  const newCollectionUpdateAuthorityAccount =
    input.newCollectionUpdateAuthority;
  const newCollectionMintAccount = input.newCollectionMint;
  const newCollectionMetadataAccount =
    input.newCollectionMetadata ??
    findMetadataPda(context, { mint: publicKey(newCollectionMintAccount) });
  const newCollectionMasterEditionAccount =
    input.newCollectionMasterEdition ??
    findMasterEditionPda(context, {
      mint: publicKey(newCollectionMintAccount),
    });
  const newCollectionDelegateRecordAccount =
    input.newCollectionDelegateRecord ??
    findMetadataDelegateRecordPda(context, {
      mint: publicKey(newCollectionMintAccount),
      delegateRole: MetadataDelegateRole.Collection,
      updateAuthority: publicKey(newCollectionUpdateAuthorityAccount),
      delegate: publicKey(authorityPdaAccount),
    });
  const tokenMetadataProgramAccount = input.tokenMetadataProgram ?? {
    ...context.programs.getPublicKey(
      'mplTokenMetadata',
      'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s'
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
  const sysvarInstructionsAccount =
    input.sysvarInstructions ??
    publicKey('Sysvar1nstructions1111111111111111111111111');
  const authorizationRulesProgramAccount = input.authorizationRulesProgram ?? {
    ...programId,
    isWritable: false,
  };
  const authorizationRulesAccount = input.authorizationRules ?? {
    ...programId,
    isWritable: false,
  };

  // Candy Machine.
  keys.push({
    pubkey: candyMachineAccount,
    isSigner: false,
    isWritable: isWritable(candyMachineAccount, true),
  });

  // Authority.
  signers.push(authorityAccount);
  keys.push({
    pubkey: authorityAccount.publicKey,
    isSigner: true,
    isWritable: isWritable(authorityAccount, false),
  });

  // Authority Pda.
  keys.push({
    pubkey: authorityPdaAccount,
    isSigner: false,
    isWritable: isWritable(authorityPdaAccount, false),
  });

  // Payer.
  signers.push(payerAccount);
  keys.push({
    pubkey: payerAccount.publicKey,
    isSigner: true,
    isWritable: isWritable(payerAccount, true),
  });

  // Collection Update Authority.
  keys.push({
    pubkey: collectionUpdateAuthorityAccount,
    isSigner: false,
    isWritable: isWritable(collectionUpdateAuthorityAccount, false),
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
    isWritable: isWritable(collectionMetadataAccount, false),
  });

  // Collection Delegate Record.
  keys.push({
    pubkey: collectionDelegateRecordAccount,
    isSigner: false,
    isWritable: isWritable(collectionDelegateRecordAccount, true),
  });

  // New Collection Update Authority.
  signers.push(newCollectionUpdateAuthorityAccount);
  keys.push({
    pubkey: newCollectionUpdateAuthorityAccount.publicKey,
    isSigner: true,
    isWritable: isWritable(newCollectionUpdateAuthorityAccount, false),
  });

  // New Collection Mint.
  keys.push({
    pubkey: newCollectionMintAccount,
    isSigner: false,
    isWritable: isWritable(newCollectionMintAccount, false),
  });

  // New Collection Metadata.
  keys.push({
    pubkey: newCollectionMetadataAccount,
    isSigner: false,
    isWritable: isWritable(newCollectionMetadataAccount, false),
  });

  // New Collection Master Edition.
  keys.push({
    pubkey: newCollectionMasterEditionAccount,
    isSigner: false,
    isWritable: isWritable(newCollectionMasterEditionAccount, false),
  });

  // New Collection Delegate Record.
  keys.push({
    pubkey: newCollectionDelegateRecordAccount,
    isSigner: false,
    isWritable: isWritable(newCollectionDelegateRecordAccount, true),
  });

  // Token Metadata Program.
  keys.push({
    pubkey: tokenMetadataProgramAccount,
    isSigner: false,
    isWritable: isWritable(tokenMetadataProgramAccount, false),
  });

  // System Program.
  keys.push({
    pubkey: systemProgramAccount,
    isSigner: false,
    isWritable: isWritable(systemProgramAccount, false),
  });

  // Sysvar Instructions.
  keys.push({
    pubkey: sysvarInstructionsAccount,
    isSigner: false,
    isWritable: isWritable(sysvarInstructionsAccount, false),
  });

  // Authorization Rules Program.
  keys.push({
    pubkey: authorizationRulesProgramAccount,
    isSigner: false,
    isWritable: isWritable(authorizationRulesProgramAccount, false),
  });

  // Authorization Rules.
  keys.push({
    pubkey: authorizationRulesAccount,
    isSigner: false,
    isWritable: isWritable(authorizationRulesAccount, false),
  });

  // Data.
  const data = getSetCollectionV2InstructionDataSerializer(context).serialize(
    {}
  );

  // Bytes Created On Chain.
  const bytesCreatedOnChain = 0;

  return transactionBuilder([
    { instruction: { keys, programId, data }, signers, bytesCreatedOnChain },
  ]);
}
