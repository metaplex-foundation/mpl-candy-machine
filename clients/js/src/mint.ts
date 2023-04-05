import {
  getMasterEditionSize,
  getMetadataSize,
} from '@metaplex-foundation/mpl-token-metadata';
import {
  ACCOUNT_HEADER_SIZE,
  mergeBytes,
  none,
  Option,
  TransactionBuilder,
  transactionBuilder,
} from '@metaplex-foundation/umi';
import { DefaultGuardSetMintArgs } from './defaultGuards';
import {
  mint as baseMint,
  MintInstructionAccounts,
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
  group?: Option<string>;
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
  const mintContext: MintContext = {
    minter: input.payer ?? context.payer,
    payer: input.payer ?? context.payer,
    mint: input.nftMint,
    candyMachine: input.candyMachine,
    candyGuard:
      input.candyGuard ??
      findCandyGuardPda(context, { base: input.candyMachine }),
  };
  const { data, remainingAccounts } = parseMintArgs<
    MA extends undefined ? DefaultGuardSetMintArgs : MA
  >(context, program, mintContext, mintArgs);
  const prefix = context.serializer.u32().serialize(data.length);
  const ix = baseMint(context, {
    ...rest,
    mintArgs: mergeBytes([prefix, data]),
    group,
  }).items[0];

  const [keys, signers] = parseGuardRemainingAccounts(remainingAccounts);
  ix.instruction.keys.push(...keys);
  ix.signers.push(...signers);
  ix.bytesCreatedOnChain =
    getMetadataSize() + getMasterEditionSize() + 2 * ACCOUNT_HEADER_SIZE;

  return transactionBuilder([ix]);
}
