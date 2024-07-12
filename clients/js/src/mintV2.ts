import { TokenStandard } from '@metaplex-foundation/mpl-token-metadata';
import {
  none,
  Option,
  OptionOrNullable,
  publicKey,
  TransactionBuilder,
  transactionBuilder,
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
  group?: OptionOrNullable<string>;
  /** @defaultValue `TokenStandard.NonFungible`. */
  tokenStandard?: TokenStandard;
};

export function mintV2<MA extends GuardSetMintArgs = DefaultGuardSetMintArgs>(
  context: Parameters<typeof baseMintV2>[0] & {
    guards: GuardRepository;
  },
  input: MintV2InstructionAccounts &
    MintV2InstructionDataArgs<
      MA extends undefined ? DefaultGuardSetMintArgs : MA
    >
): TransactionBuilder {
  const { mintArgs = {}, group = none(), ...rest } = input;

  // Parsing mint data.
  const program = context.programs.get<CandyGuardProgram>('mplCandyGuard');
  const candyMachine = publicKey(input.candyMachine, false);
  const mintContext: MintContext = {
    buyer: input.buyer ?? context.identity,
    payer: input.payer ?? context.payer,
    candyMachine,
    candyGuard: publicKey(
      input.candyGuard ?? findCandyGuardPda(context, { base: candyMachine }),
      false
    ),
  };
  const { data, remainingAccounts } = parseMintArgs<
    MA extends undefined ? DefaultGuardSetMintArgs : MA
  >(context, program, mintContext, mintArgs);

  const ix = baseMintV2(context, {
    ...rest,
    mintArgs: data,
    group,
  }).items[0];

  const [keys, signers] = parseGuardRemainingAccounts(remainingAccounts);
  ix.instruction.keys.push(...keys);
  ix.signers.push(...signers);
  ix.bytesCreatedOnChain = 0;

  return transactionBuilder([ix]);
}
