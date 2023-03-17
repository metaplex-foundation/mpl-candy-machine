import {
  findAssociatedTokenPda,
  getSplAssociatedTokenProgramId,
  getSplSystemProgramId,
  getSplTokenProgramId,
} from '@metaplex-foundation/mpl-essentials';
import {
  findMasterEditionPda,
  findMetadataPda,
  findTokenRecordPda,
  getMplTokenMetadataProgramId,
  isProgrammable,
  TokenStandard,
} from '@metaplex-foundation/mpl-token-metadata';
import { publicKey, PublicKey, Signer } from '@metaplex-foundation/umi';
import { UnrecognizePathForRouteInstructionError } from '../errors';
import {
  AccountVersion,
  findFreezeEscrowPda,
  FreezeInstruction,
  FreezeSolPayment,
  FreezeSolPaymentArgs,
  getFreezeInstructionSerializer,
  getFreezeSolPaymentSerializer,
} from '../generated';
import { GuardManifest, GuardRemainingAccount, RouteParser } from '../guards';

/**
 * The freezeSolPayment guard allows minting frozen NFTs by charging
 * the payer an amount in SOL. Frozen NFTs cannot be transferred
 * or listed on any marketplaces until thawed.
 *
 * The funds are transferred to a freeze escrow until all NFTs are thaw,
 * at which point, they can be transferred (unlocked) to the configured
 * destination account.
 *
 * @see {@link FreezeSolPaymentRouteArgs} to learn more about
 * the instructions that can be executed against this guard.
 */
export const freezeSolPaymentGuardManifest: GuardManifest<
  FreezeSolPaymentArgs,
  FreezeSolPayment,
  FreezeSolPaymentMintArgs,
  FreezeSolPaymentRouteArgs
> = {
  name: 'freezeSolPayment',
  serializer: getFreezeSolPaymentSerializer,
  mintParser: (context, mintContext, args) => {
    const freezeEscrow = findFreezeEscrowPda(context, {
      destination: args.destination,
      candyMachine: mintContext.candyMachine,
      candyGuard: mintContext.candyGuard,
    });
    const nftAta = findAssociatedTokenPda(context, {
      mint: mintContext.mint,
      owner: mintContext.minter.publicKey,
    });
    return {
      data: new Uint8Array(),
      remainingAccounts: [
        { publicKey: freezeEscrow, isWritable: true },
        { publicKey: nftAta, isWritable: false },
      ],
    };
  },
  routeParser: (context, routeContext, args) => {
    const { path } = args;
    switch (path) {
      case 'initialize':
        return initializeRouteInstruction(context, routeContext, args);
      case 'thaw':
        return thawRouteInstruction(context, routeContext, args);
      case 'unlockFunds':
        return unlockFundsRouteInstruction(context, routeContext, args);
      default:
        throw new UnrecognizePathForRouteInstructionError(
          'freezeSolPayment',
          path
        );
    }
  },
};

export type FreezeSolPaymentMintArgs = Omit<FreezeSolPaymentArgs, 'lamports'>;

/**
 * The settings for the freezeSolPayment guard that should be provided
 * when accessing the guard's special "route" instruction.
 */
export type FreezeSolPaymentRouteArgs =
  | FreezeSolPaymentRouteArgsInitialize
  | FreezeSolPaymentRouteArgsThaw
  | FreezeSolPaymentRouteArgsUnlockFunds;

/**
 * The `initialize` path creates the freeze escrow account that will
 * hold the funds until all NFTs are thawed. It must be called before
 * any NFTs can be minted.
 *
 * ```ts
 * route(umi, {
 *   candyMachine,
 *   candyGuard,
 *   guard: 'freezeSolPayment',
 *   args: {
 *     path: 'initialize',
 *     period: 15 * 24 * 60 * 60, // 15 days.
 *     candyGuardAuthority,
 *   },
 * });
 * ```
 */
export type FreezeSolPaymentRouteArgsInitialize = Omit<
  FreezeSolPaymentArgs,
  'lamports'
> & {
  /** Selects the path to execute in the route instruction. */
  path: 'initialize';

  /** The freeze period in seconds (maximum 30 days). */
  period: number;

  /** The authority of the Candy Guard as a Signer. */
  candyGuardAuthority: Signer;
};

/**
 * The `thaw` path unfreezes one NFT if one of the following conditions are met:
 * - All NFTs have been minted.
 * - The configured period has elapsed (max 30 days).
 * - The Candy Machine account was deleted.
 *
 * Anyone can call this instruction. Since the funds are not transferrable
 * until all NFTs are thawed, it creates an incentive for the treasury to
 * thaw all NFTs as soon as possible.
 *
 * ```ts
 * route(umi, {
 *   candyMachine,
 *   candyGuard,
 *   guard: 'freezeSolPayment',
 *   args: {
 *     path: 'thaw',
 *     nftMint: nftToThaw.address,
 *     nftOwner: nftToThaw.token.ownerAddress,
 *     candyMachineVersion: AccountVersion.V2,
 *     tokenStandard: TokenStandard.NonFungible,
 *   },
 * });
 * ```
 */
export type FreezeSolPaymentRouteArgsThaw = Omit<
  FreezeSolPaymentArgs,
  'lamports'
> & {
  /** Selects the path to execute in the route instruction. */
  path: 'thaw';

  /** The mint address of the NFT to thaw. */
  nftMint: PublicKey;

  /** The owner address of the NFT to thaw. */
  nftOwner: PublicKey;

  /** The version of the Candy Machine account. */
  candyMachineVersion: AccountVersion;

  /** The token standard of assets being minted. */
  tokenStandard: TokenStandard;

  /** The Candy Machine's ruleSet if any. */
  ruleSet?: PublicKey;
};

/**
 * The `unlockFunds` path transfers all of the escrow funds to the
 * configured destination address once all NFTs have been thawed.
 *
 * ```ts
 * route(umi, {
 *   candyMachine,
 *   candyGuard,
 *   guard: 'freezeSolPayment',
 *   args: {
 *     path: 'unlockFunds',
 *     candyGuardAuthority,
 *   },
 * });
 * ```
 */
export type FreezeSolPaymentRouteArgsUnlockFunds = Omit<
  FreezeSolPaymentArgs,
  'lamports'
> & {
  /** Selects the path to execute in the route instruction. */
  path: 'unlockFunds';

  /** The authority of the Candy Guard as a Signer. */
  candyGuardAuthority: Signer;
};

const initializeRouteInstruction: RouteParser<
  FreezeSolPaymentRouteArgsInitialize
> = (context, routeContext, args) => {
  const freezeEscrow = findFreezeEscrowPda(context, {
    destination: args.destination,
    candyMachine: routeContext.candyMachine,
    candyGuard: routeContext.candyGuard,
  });
  const s = context.serializer;
  const serializer = s.tuple([
    getFreezeInstructionSerializer(context),
    s.u64(),
  ]);
  return {
    data: serializer.serialize([FreezeInstruction.Initialize, args.period]),
    remainingAccounts: [
      { publicKey: freezeEscrow, isWritable: true },
      { signer: args.candyGuardAuthority, isWritable: false },
      { publicKey: getSplSystemProgramId(context), isWritable: false },
    ],
  };
};

const thawRouteInstruction: RouteParser<FreezeSolPaymentRouteArgsThaw> = (
  context,
  routeContext,
  args
) => {
  const freezeEscrow = findFreezeEscrowPda(context, {
    destination: args.destination,
    candyMachine: routeContext.candyMachine,
    candyGuard: routeContext.candyGuard,
  });
  const nftFreezeAta = findAssociatedTokenPda(context, {
    mint: args.nftMint,
    owner: freezeEscrow,
  });
  const nftAta = findAssociatedTokenPda(context, {
    mint: args.nftMint,
    owner: args.nftOwner,
  });
  const nftMetadata = findMetadataPda(context, { mint: args.nftMint });
  const nftEdition = findMasterEditionPda(context, { mint: args.nftMint });
  const nftAtaTokenRecord = findTokenRecordPda(context, {
    mint: args.nftMint,
    token: nftAta,
  });
  const nftFreezeAtaTokenRecord = findTokenRecordPda(context, {
    mint: args.nftMint,
    token: nftAta,
  });
  const tokenAuthRulesProgram = context.programs.getPublicKey(
    'mplTokenAuthRules',
    'auth9SigNpDKz4sJJ1DfCTuZrZNSAgh9sFD3rboVmgg'
  );
  const data = getFreezeInstructionSerializer(context).serialize(
    FreezeInstruction.Thaw
  );
  const remainingAccounts: GuardRemainingAccount[] = [
    { publicKey: freezeEscrow, isWritable: true },
    { publicKey: args.nftMint, isWritable: false },
    { publicKey: args.nftOwner, isWritable: false },
    { publicKey: nftAta, isWritable: true },
    { publicKey: nftEdition, isWritable: false },
    { publicKey: getSplTokenProgramId(context), isWritable: false },
    { publicKey: getMplTokenMetadataProgramId(context), isWritable: false },
  ];

  if (args.candyMachineVersion === AccountVersion.V1) {
    return { data, remainingAccounts };
  }

  remainingAccounts.push(
    ...[
      //   7. `[]` Metadata account of the NFT.
      { publicKey: nftMetadata, isWritable: false },
      //   8. `[]` Freeze PDA associated token account of the NFT.
      { publicKey: nftFreezeAta, isWritable: false },
      //   9. `[]` System program.
      { publicKey: getSplSystemProgramId(context), isWritable: false },
      //   10. `[]` Sysvar instructions account.
      {
        publicKey: publicKey('Sysvar1nstructions1111111111111111111111111'),
        isWritable: false,
      },
      //   11. `[]` SPL Associated Token Account program.
      { publicKey: getSplAssociatedTokenProgramId(context), isWritable: false },
    ]
  );

  if (!isProgrammable(args.tokenStandard)) {
    return { data, remainingAccounts };
  }

  remainingAccounts.push(
    ...[
      //   12. `[]` Owner token record account.
      { publicKey: nftAtaTokenRecord, isWritable: false },
      //   13. `[]` Freeze PDA token record account.
      { publicKey: nftFreezeAtaTokenRecord, isWritable: false },
      //   14. `[]` Token Authorization Rules program.
      { publicKey: tokenAuthRulesProgram, isWritable: false },
    ]
  );

  if (args.ruleSet) {
    //   15. `[]` Token Authorization Rules account.
    remainingAccounts.push({ publicKey: args.ruleSet, isWritable: false });
  }

  return { data, remainingAccounts };
};

const unlockFundsRouteInstruction: RouteParser<
  FreezeSolPaymentRouteArgsUnlockFunds
> = (context, routeContext, args) => {
  const freezeEscrow = findFreezeEscrowPda(context, {
    destination: args.destination,
    candyMachine: routeContext.candyMachine,
    candyGuard: routeContext.candyGuard,
  });
  return {
    data: getFreezeInstructionSerializer(context).serialize(
      FreezeInstruction.UnlockFunds
    ),
    remainingAccounts: [
      { publicKey: freezeEscrow, isWritable: true },
      { signer: args.candyGuardAuthority, isWritable: false },
      { publicKey: args.destination, isWritable: true },
      { publicKey: getSplSystemProgramId(context), isWritable: false },
    ],
  };
};
