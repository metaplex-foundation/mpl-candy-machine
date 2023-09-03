import {
  ACCOUNT_HEADER_SIZE,
  Option,
  OptionOrNullable,
  TransactionBuilder,
  none,
  publicKey,
  transactionBuilder,
} from '@metaplex-foundation/umi';
import { MASTER_EDITION_SIZE, METADATA_SIZE } from './constants';
import { DefaultGuardSetMintArgs } from './defaultGuards';
import {
  MintInstructionAccounts,
  mint as baseMint,
} from './generated/instructions/mint';
import {
  CandyGuardProgram,
  GuardRepository,
  GuardSetMintArgs,
  MintContext,
  parseGuardRemainingAccounts,
  parseMintArgs,
} from './guards';
import { findCandyGuardPda } from './hooked';

export { MintInstructionAccounts };

export type MintInstructionData<MA extends GuardSetMintArgs> = {
  discriminator: Array<number>;
  mintArgs: MA;
  group: Option<string>;
};

export type MintInstructionDataArgs<MA extends GuardSetMintArgs> = {
  mintArgs?: Partial<MA>;
  group?: OptionOrNullable<string>;
};

export function mint<MA extends GuardSetMintArgs = DefaultGuardSetMintArgs>(
  context: Parameters<typeof baseMint>[0] & {
    guards: GuardRepository;
  },
  input: MintInstructionAccounts &
    MintInstructionDataArgs<MA extends undefined ? DefaultGuardSetMintArgs : MA>
): TransactionBuilder {
  const { mintArgs = {}, group = none(), ...rest } = input;
  const program = context.programs.get<CandyGuardProgram>('mplCandyGuard');
  const candyMachine = publicKey(input.candyMachine, false);
  const mintContext: MintContext = {
    minter: input.payer ?? context.payer,
    payer: input.payer ?? context.payer,
    mint: publicKey(input.nftMint, false),
    candyMachine,
    candyGuard: publicKey(
      input.candyGuard ?? findCandyGuardPda(context, { base: candyMachine }),
      false
    ),
  };
  const { data, remainingAccounts } = parseMintArgs<
    MA extends undefined ? DefaultGuardSetMintArgs : MA
  >(context, program, mintContext, mintArgs);
  const ix = baseMint(context, { ...rest, mintArgs: data, group }).items[0];

  const [keys, signers] = parseGuardRemainingAccounts(remainingAccounts);
  ix.instruction.keys.push(...keys);
  ix.signers.push(...signers);
  ix.bytesCreatedOnChain =
    METADATA_SIZE + MASTER_EDITION_SIZE + 2 * ACCOUNT_HEADER_SIZE;

  return transactionBuilder([ix]);
}
