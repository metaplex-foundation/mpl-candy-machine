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
  Signer,
  WrappedInstruction,
  checkForIsWritableOverride as isWritable,
} from '@metaplex-foundation/umi';

// Accounts.
export type CreateIdempotentAssociatedTokenInstructionAccounts = {
  payer?: Signer;
  ata: PublicKey;
  owner: PublicKey;
  mint: PublicKey;
  systemProgram?: PublicKey;
  tokenProgram?: PublicKey;
};

// Instruction.
export function createIdempotentAssociatedToken(
  context: Pick<Context, 'serializer' | 'programs' | 'payer'>,
  input: CreateIdempotentAssociatedTokenInstructionAccounts
): WrappedInstruction {
  const signers: Signer[] = [];
  const keys: AccountMeta[] = [];

  // Program ID.
  const programId: PublicKey =
    context.programs.get('splAssociatedToken').publicKey;

  // Resolved accounts.
  const payerAccount = input.payer ?? context.payer;
  const ataAccount = input.ata;
  const ownerAccount = input.owner;
  const mintAccount = input.mint;
  const systemProgramAccount = input.systemProgram ?? {
    ...context.programs.get('splSystem').publicKey,
    isWritable: false,
  };
  const tokenProgramAccount = input.tokenProgram ?? {
    ...context.programs.get('splToken').publicKey,
    isWritable: false,
  };

  // Payer.
  signers.push(payerAccount);
  keys.push({
    pubkey: payerAccount.publicKey,
    isSigner: true,
    isWritable: isWritable(payerAccount, true),
  });

  // Ata.
  keys.push({
    pubkey: ataAccount,
    isSigner: false,
    isWritable: isWritable(ataAccount, true),
  });

  // Owner.
  keys.push({
    pubkey: ownerAccount,
    isSigner: false,
    isWritable: isWritable(ownerAccount, false),
  });

  // Mint.
  keys.push({
    pubkey: mintAccount,
    isSigner: false,
    isWritable: isWritable(mintAccount, false),
  });

  // System Program.
  keys.push({
    pubkey: systemProgramAccount,
    isSigner: false,
    isWritable: isWritable(systemProgramAccount, false),
  });

  // Token Program.
  keys.push({
    pubkey: tokenProgramAccount,
    isSigner: false,
    isWritable: isWritable(tokenProgramAccount, false),
  });

  // Data.
  const data = new Uint8Array();

  // Bytes Created On Chain.
  const bytesCreatedOnChain = 0;

  return {
    instruction: { keys, programId, data },
    signers,
    bytesCreatedOnChain,
  };
}