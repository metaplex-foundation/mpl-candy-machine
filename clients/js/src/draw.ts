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
  draw as baseDraw,
  DrawInstructionAccounts,
} from './generated/instructions/draw';
import {
  CandyGuardProgram,
  GuardRepository,
  GuardSetMintArgs,
  MintContext,
  parseGuardRemainingAccounts,
  parseMintArgs,
} from './guards';
import { findGumballGuardPda } from './hooked';

export { DrawInstructionAccounts };

export type DrawInstructionData<MA extends GuardSetMintArgs> = {
  discriminator: Array<number>;
  mintArgs: MA;
  group: Option<string>;
};

export type DrawInstructionDataArgs<MA extends GuardSetMintArgs> = {
  mintArgs?: Partial<MA>;
  group?: OptionOrNullable<string>;
  /** @defaultValue `TokenStandard.NonFungible`. */
  tokenStandard?: TokenStandard;
};

export function draw<MA extends GuardSetMintArgs = DefaultGuardSetMintArgs>(
  context: Parameters<typeof baseDraw>[0] & {
    guards: GuardRepository;
  },
  input: DrawInstructionAccounts &
    DrawInstructionDataArgs<MA extends undefined ? DefaultGuardSetMintArgs : MA>
): TransactionBuilder {
  const { mintArgs = {}, group = none(), ...rest } = input;

  // Parsing mint data.
  const program = context.programs.get<CandyGuardProgram>('mplCandyGuard');
  const gumballMachine = publicKey(input.gumballMachine, false);
  const mintContext: MintContext = {
    buyer: input.buyer ?? context.identity,
    payer: input.payer ?? context.payer,
    gumballMachine,
    gumballGuard: publicKey(
      input.gumballGuard ??
        findGumballGuardPda(context, { base: gumballMachine }),
      false
    ),
  };
  const { data, remainingAccounts } = parseMintArgs<
    MA extends undefined ? DefaultGuardSetMintArgs : MA
  >(context, program, mintContext, mintArgs);

  const ix = baseDraw(context, {
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
