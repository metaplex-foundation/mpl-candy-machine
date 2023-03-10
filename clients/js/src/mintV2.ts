import {
  mergeBytes,
  none,
  Option,
  publicKey,
  WrappedInstruction,
} from '@metaplex-foundation/umi';
import { DefaultGuardSetMintArgs } from './defaultGuards';
import {
  mintV2 as baseMintV2,
  MintV2InstructionAccounts,
} from './generated/instructions/mintV2';
import {
  CandyGuardProgram,
  GuardRepository,
  GuardSetMintArgs,
  MintContext,
  parseGuardRemainingAccounts,
  parseMintArgs,
} from './guards';
import { findCandyGuardPda } from './hooked';

export { MintV2InstructionAccounts };

export type MintV2InstructionData<MA extends GuardSetMintArgs> = {
  discriminator: Array<number>;
  mintArgs: MA;
  group: Option<string>;
};

export type MintV2InstructionDataArgs<MA extends GuardSetMintArgs> = {
  mintArgs?: Partial<MA>;
  group?: Option<string>;
};

export function mintV2<MA extends GuardSetMintArgs = DefaultGuardSetMintArgs>(
  context: Parameters<typeof baseMintV2>[0] & {
    guards: GuardRepository;
  },
  input: MintV2InstructionAccounts &
    MintV2InstructionDataArgs<
      MA extends undefined ? DefaultGuardSetMintArgs : MA
    >
): WrappedInstruction {
  const { mintArgs = {}, group = none(), ...rest } = input;
  const program = context.programs.get<CandyGuardProgram>('mplCandyGuard');
  const mintContext: MintContext = {
    minter: input.minter ?? context.identity,
    payer: input.payer ?? context.payer,
    mint: publicKey(input.nftMint),
    candyMachine: input.candyMachine,
    candyGuard:
      input.candyGuard ??
      findCandyGuardPda(context, { base: input.candyMachine }),
  };
  const { data, remainingAccounts } = parseMintArgs<
    MA extends undefined ? DefaultGuardSetMintArgs : MA
  >(context, program, mintContext, mintArgs);
  const prefix = context.serializer.u32().serialize(data.length);
  const ix = baseMintV2(context, {
    ...rest,
    mintArgs: mergeBytes([prefix, data]),
    group,
  });

  const [keys, signers] = parseGuardRemainingAccounts(remainingAccounts);
  ix.instruction.keys.push(...keys);
  ix.signers.push(...signers);

  return ix;
}
