/**
 * This code was AUTOGENERATED using the kinobi library.
 * Please DO NOT EDIT THIS FILE, instead use visitors
 * to add features, then rerun kinobi to update it.
 *
 * @see https://github.com/metaplex-foundation/kinobi
 */

import { findAssociatedTokenPda } from '@metaplex-foundation/mpl-essentials';
import {
  MetadataDelegateRole,
  findMasterEditionPda,
  findMetadataDelegateRecordPda,
  findMetadataPda,
} from '@metaplex-foundation/mpl-token-metadata';
import {
  AccountMeta,
  Context,
  Option,
  PublicKey,
  Serializer,
  Signer,
  TransactionBuilder,
  checkForIsWritableOverride as isWritable,
  isSigner,
  mapSerializer,
  publicKey,
  transactionBuilder,
} from '@metaplex-foundation/umi';
import { findCandyGuardPda, findCandyMachineAuthorityPda } from '../../hooked';

// Accounts.
export type MintV2InstructionAccounts = {
  candyGuard?: PublicKey;
  candyMachineProgram?: PublicKey;
  candyMachine: PublicKey;
  candyMachineAuthorityPda?: PublicKey;
  payer?: Signer;
  minter?: Signer;
  nftMint: PublicKey | Signer;
  nftMintAuthority?: Signer;
  nftMetadata?: PublicKey;
  nftMasterEdition?: PublicKey;
  token?: PublicKey;
  tokenRecord?: PublicKey;
  collectionDelegateRecord?: PublicKey;
  collectionMint: PublicKey;
  collectionMetadata?: PublicKey;
  collectionMasterEdition?: PublicKey;
  collectionUpdateAuthority: PublicKey;
  tokenMetadataProgram?: PublicKey;
  splTokenProgram?: PublicKey;
  splAtaProgram?: PublicKey;
  systemProgram?: PublicKey;
  sysvarInstructions?: PublicKey;
  recentSlothashes?: PublicKey;
  authorizationRulesProgram?: PublicKey;
  authorizationRules?: PublicKey;
};

// Arguments.
export type MintV2InstructionData = {
  discriminator: Array<number>;
  mintArgs: Uint8Array;
  group: Option<string>;
};

export type MintV2InstructionDataArgs = {
  mintArgs: Uint8Array;
  group: Option<string>;
};

export function getMintV2InstructionDataSerializer(
  context: Pick<Context, 'serializer'>
): Serializer<MintV2InstructionDataArgs, MintV2InstructionData> {
  const s = context.serializer;
  return mapSerializer<
    MintV2InstructionDataArgs,
    MintV2InstructionData,
    MintV2InstructionData
  >(
    s.struct<MintV2InstructionData>(
      [
        ['discriminator', s.array(s.u8(), { size: 8 })],
        ['mintArgs', s.bytes()],
        ['group', s.option(s.string())],
      ],
      { description: 'MintV2InstructionData' }
    ),
    (value) =>
      ({
        ...value,
        discriminator: [120, 121, 23, 146, 173, 110, 199, 205],
      } as MintV2InstructionData)
  ) as Serializer<MintV2InstructionDataArgs, MintV2InstructionData>;
}

// Instruction.
export function mintV2(
  context: Pick<
    Context,
    'serializer' | 'programs' | 'eddsa' | 'identity' | 'payer'
  >,
  input: MintV2InstructionAccounts & MintV2InstructionDataArgs
): TransactionBuilder {
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
  const minterAccount = input.minter ?? context.identity;
  const nftMintAccount = input.nftMint;
  const nftMintAuthorityAccount = input.nftMintAuthority ?? context.identity;
  const nftMetadataAccount =
    input.nftMetadata ??
    findMetadataPda(context, { mint: publicKey(nftMintAccount) });
  const nftMasterEditionAccount =
    input.nftMasterEdition ??
    findMasterEditionPda(context, { mint: publicKey(nftMintAccount) });
  const tokenAccount =
    input.token ??
    findAssociatedTokenPda(context, {
      mint: publicKey(nftMintAccount),
      owner: publicKey(minterAccount),
    });
  const tokenRecordAccount = input.tokenRecord ?? {
    ...programId,
    isWritable: false,
  };
  const collectionMintAccount = input.collectionMint;
  const collectionUpdateAuthorityAccount = input.collectionUpdateAuthority;
  const collectionDelegateRecordAccount =
    input.collectionDelegateRecord ??
    findMetadataDelegateRecordPda(context, {
      mint: publicKey(collectionMintAccount),
      delegateRole: MetadataDelegateRole.Collection,
      updateAuthority: publicKey(collectionUpdateAuthorityAccount),
      delegate: publicKey(candyMachineAuthorityPdaAccount),
    });
  const collectionMetadataAccount =
    input.collectionMetadata ??
    findMetadataPda(context, { mint: publicKey(collectionMintAccount) });
  const collectionMasterEditionAccount =
    input.collectionMasterEdition ??
    findMasterEditionPda(context, { mint: publicKey(collectionMintAccount) });
  const tokenMetadataProgramAccount = input.tokenMetadataProgram ?? {
    ...context.programs.getPublicKey(
      'mplTokenMetadata',
      'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s'
    ),
    isWritable: false,
  };
  const splTokenProgramAccount = input.splTokenProgram ?? {
    ...context.programs.getPublicKey(
      'splToken',
      'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'
    ),
    isWritable: false,
  };
  const splAtaProgramAccount = input.splAtaProgram ?? {
    ...context.programs.getPublicKey(
      'splAssociatedToken',
      'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL'
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
  const recentSlothashesAccount =
    input.recentSlothashes ??
    publicKey('SysvarS1otHashes111111111111111111111111111');
  const authorizationRulesProgramAccount = input.authorizationRulesProgram ?? {
    ...programId,
    isWritable: false,
  };
  const authorizationRulesAccount = input.authorizationRules ?? {
    ...programId,
    isWritable: false,
  };

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

  // Minter.
  signers.push(minterAccount);
  keys.push({
    pubkey: minterAccount.publicKey,
    isSigner: true,
    isWritable: isWritable(minterAccount, false),
  });

  // Nft Mint.
  if (isSigner(nftMintAccount)) {
    signers.push(nftMintAccount);
  }
  keys.push({
    pubkey: publicKey(nftMintAccount),
    isSigner: isSigner(nftMintAccount),
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

  // Token.
  keys.push({
    pubkey: tokenAccount,
    isSigner: false,
    isWritable: isWritable(tokenAccount, true),
  });

  // Token Record.
  keys.push({
    pubkey: tokenRecordAccount,
    isSigner: false,
    isWritable: isWritable(tokenRecordAccount, true),
  });

  // Collection Delegate Record.
  keys.push({
    pubkey: collectionDelegateRecordAccount,
    isSigner: false,
    isWritable: isWritable(collectionDelegateRecordAccount, false),
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

  // Spl Token Program.
  keys.push({
    pubkey: splTokenProgramAccount,
    isSigner: false,
    isWritable: isWritable(splTokenProgramAccount, false),
  });

  // Spl Ata Program.
  keys.push({
    pubkey: splAtaProgramAccount,
    isSigner: false,
    isWritable: isWritable(splAtaProgramAccount, false),
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

  // Recent Slothashes.
  keys.push({
    pubkey: recentSlothashesAccount,
    isSigner: false,
    isWritable: isWritable(recentSlothashesAccount, false),
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
  const data = getMintV2InstructionDataSerializer(context).serialize(input);

  // Bytes Created On Chain.
  const bytesCreatedOnChain = 0;

  return transactionBuilder([
    { instruction: { keys, programId, data }, signers, bytesCreatedOnChain },
  ]);
}
