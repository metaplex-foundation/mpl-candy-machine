import {
  TokenStandard,
  findTokenRecordPda,
  getTokenRecordSize,
  isProgrammable,
} from '@metaplex-foundation/mpl-token-metadata';
import {
  findAssociatedTokenPda,
  getMintSize,
  getTokenSize,
} from '@metaplex-foundation/mpl-toolbox';
import {
  ACCOUNT_HEADER_SIZE,
  Option,
  OptionOrNullable,
  TransactionBuilder,
  isSigner,
  none,
  publicKey,
  transactionBuilder,
} from '@metaplex-foundation/umi';
import { MASTER_EDITION_SIZE, METADATA_SIZE } from './constants';
import { DefaultGuardSetMintArgs } from './defaultGuards';
import {
  MintV2InstructionAccounts,
  mintV2 as baseMintV2,
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
    minter: input.minter ?? context.identity,
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

  // Default token Record value.
  const tokenStandard = input.tokenStandard ?? TokenStandard.NonFungible;
  const defaultTokenRecord = isProgrammable(tokenStandard)
    ? findTokenRecordPda(context, {
        mint: publicKey(input.nftMint, false),
        token: publicKey(
          input.token ??
            findAssociatedTokenPda(context, {
              mint: publicKey(input.nftMint),
              owner: publicKey(input.minter ?? context.identity),
            }),
          false
        ),
      })
    : undefined;

  const ix = baseMintV2(context, {
    ...rest,
    tokenRecord: input.tokenRecord ?? defaultTokenRecord,
    mintArgs: data,
    group,
  }).items[0];

  const [keys, signers] = parseGuardRemainingAccounts(remainingAccounts);
  ix.instruction.keys.push(...keys);
  ix.signers.push(...signers);
  ix.bytesCreatedOnChain =
    METADATA_SIZE + MASTER_EDITION_SIZE + 2 * ACCOUNT_HEADER_SIZE;

  if (isSigner(input.nftMint)) {
    ix.bytesCreatedOnChain +=
      getMintSize() + getTokenSize() + 2 * ACCOUNT_HEADER_SIZE;
  }

  if (isProgrammable(tokenStandard)) {
    ix.bytesCreatedOnChain += getTokenRecordSize() + ACCOUNT_HEADER_SIZE;
  }

  return transactionBuilder([ix]);
}
