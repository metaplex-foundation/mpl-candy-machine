import {
  AccountMeta,
  checkForIsWritableOverride as isWritable,
  Context,
  mapSerializer,
  Serializer,
  Signer,
  WrappedInstruction,
} from '@metaplex-foundation/umi';
import { CreateCandyGuardInstructionAccounts } from './generated/instructions/createCandyGuard';
import {
  CandyGuardProgram,
  GuardRepository,
  GuardSet,
  GuardSetArgs,
} from './guards';
import {
  CandyGuardData,
  CandyGuardDataArgs,
  getCandyGuardDataSerializer,
} from './hooked';

const DISCRIMINATOR = [175, 175, 109, 31, 13, 152, 155, 237];

export { CreateCandyGuardInstructionAccounts };

// Arguments.
export type CreateCandyGuardInstructionData<D extends GuardSet> = {
  discriminator: Array<number>;
} & CandyGuardData<D>;

export type CreateCandyGuardInstructionDataArgs<DA extends GuardSetArgs> =
  CandyGuardDataArgs<DA>;

export function getCreateCandyGuardInstructionDataSerializer<
  DA extends GuardSetArgs,
  D extends DA & GuardSet = DA
>(
  context: Pick<Context, 'serializer' | 'programs'> & {
    guards: GuardRepository;
  },
  program?: CandyGuardProgram
): Serializer<
  CreateCandyGuardInstructionDataArgs<DA>,
  CreateCandyGuardInstructionData<D>
> {
  program ??= context.programs.get<CandyGuardProgram>('mplCandyGuard');
  const s = context.serializer;
  return mapSerializer(
    s.struct<{
      discriminator: number[];
      data: CreateCandyGuardInstructionDataArgs<DA>;
    }>(
      [
        ['discriminator', s.array(s.u8(), { size: 8 })],
        ['data', getCandyGuardDataSerializer<DA, D>(context, program)],
      ],
      { description: 'CreateCandyGuardInstructionData' }
    ),
    (value) => ({ discriminator: DISCRIMINATOR, data: value }),
    ({ discriminator, data }) => ({ discriminator, ...data })
  ) as Serializer<
    CreateCandyGuardInstructionDataArgs<DA>,
    CreateCandyGuardInstructionData<D>
  >;
}

// Instruction.
export function createCandyGuard<DA extends GuardSetArgs>(
  context: Pick<Context, 'serializer' | 'programs' | 'identity' | 'payer'> & {
    guards: GuardRepository;
  },
  input: CreateCandyGuardInstructionAccounts &
    CreateCandyGuardInstructionDataArgs<DA>
): WrappedInstruction {
  const signers: Signer[] = [];
  const keys: AccountMeta[] = [];

  // Program ID.
  const programId = context.programs.getPublicKey(
    'mplCandyGuard',
    'Guard1JwRhJkVH6XZhzoYxeBVQe872VH6QggF4BWmS9g'
  );

  // Resolved accounts.
  const candyGuardAccount = input.candyGuard;
  const baseAccount = input.base;
  const authorityAccount = input.authority ?? context.identity.publicKey;
  const payerAccount = input.payer ?? context.payer;
  const systemProgramAccount = input.systemProgram ?? {
    ...context.programs.getPublicKey(
      'splSystem',
      '11111111111111111111111111111111'
    ),
    isWritable: false,
  };

  // Candy Guard.
  keys.push({
    pubkey: candyGuardAccount,
    isSigner: false,
    isWritable: isWritable(candyGuardAccount, true),
  });

  // Base.
  signers.push(baseAccount);
  keys.push({
    pubkey: baseAccount.publicKey,
    isSigner: true,
    isWritable: isWritable(baseAccount, false),
  });

  // Authority.
  keys.push({
    pubkey: authorityAccount,
    isSigner: false,
    isWritable: isWritable(authorityAccount, false),
  });

  // Payer.
  signers.push(payerAccount);
  keys.push({
    pubkey: payerAccount.publicKey,
    isSigner: true,
    isWritable: isWritable(payerAccount, true),
  });

  // System Program.
  keys.push({
    pubkey: systemProgramAccount,
    isSigner: false,
    isWritable: isWritable(systemProgramAccount, false),
  });

  // Data.
  const data =
    getCreateCandyGuardInstructionDataSerializer<DA>(context).serialize(input);

  // Bytes Created On Chain.
  const bytesCreatedOnChain = 0;

  return {
    instruction: { keys, programId, data },
    signers,
    bytesCreatedOnChain,
  };
}
