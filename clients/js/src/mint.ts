import {
  mergeBytes,
  none,
  Option,
  WrappedInstruction,
} from '@metaplex-foundation/umi';
import { DefaultGuardSetMintArgs } from './defaultGuards';
import {
  mint as baseMint,
  MintInstructionAccounts,
} from './generated/instructions/mint';
import {
  CandyGuardProgram,
  GuardRepository,
  GuardSetArgs,
  GuardSetMintArgs,
  MintContext,
  parseGuardRemainingAccounts,
  parseMintArgs,
} from './guards';

export { MintInstructionAccounts };

export type MintInstructionData<MA extends GuardSetMintArgs> = {
  discriminator: Array<number>;
  mintArgs: MA;
  label: Option<string>;
};

export type MintInstructionDataArgs<MA extends GuardSetMintArgs> = {
  mintArgs?: Partial<MA>;
  label?: Option<string>;
};

export function mint<MA extends GuardSetArgs = DefaultGuardSetMintArgs>(
  context: Parameters<typeof baseMint>[0] & {
    guards: GuardRepository;
  },
  input: MintInstructionAccounts &
    MintInstructionDataArgs<MA extends undefined ? DefaultGuardSetMintArgs : MA>
): WrappedInstruction {
  const { mintArgs = {}, label = none(), ...rest } = input;
  const program = context.programs.get<CandyGuardProgram>('mplCandyGuard');
  const mintContext: MintContext = {
    minter: input.payer ?? context.payer,
    payer: input.payer ?? context.payer,
    mint: input.nftMint,
    candyMachine: input.candyMachine,
    candyGuard: input.candyGuard,
  };
  const { data, remainingAccounts } = parseMintArgs<
    MA extends undefined ? DefaultGuardSetMintArgs : MA
  >(context, program, mintContext, mintArgs);
  const prefix = context.serializer.u32().serialize(data.length);
  const ix = baseMint(context, {
    ...rest,
    mintArgs: mergeBytes([prefix, data]),
    label,
  });

  const [keys, signers] = parseGuardRemainingAccounts(remainingAccounts);
  ix.instruction.keys.push(...keys);
  ix.signers.push(...signers);

  return ix;
}
