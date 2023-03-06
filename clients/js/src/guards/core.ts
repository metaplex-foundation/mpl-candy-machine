import {
  Context,
  Option,
  PublicKey,
  Serializer,
  Signer,
} from '@metaplex-foundation/umi';

export type GuardManifest<
  DA extends GuardDataArgs = {},
  D extends GuardData<DA> = DA,
  MA extends GuardMintArgs = {},
  RA extends GuardRouteArgs = {}
> = {
  name: string;
  serializer: Serializer<DA, D>;
  mintParser: MintParser<MA>;
  routeParser: RouteParser<RA>;
};

export type GuardDataArgs = {
  [name: string]: Option<object>;
};
export type GuardData<DA extends GuardDataArgs> = DA & {
  [name: string]: Option<object>;
};
export type GuardMintArgs = {
  [name: string]: Option<object>;
};
export type GuardRouteArgs = {
  [name: string]: Option<object>;
};

export type MintParser<MA extends GuardMintArgs> = (
  context: Pick<Context, 'eddsa' | 'programs' | 'serializer'>,
  mintContext: MintContext,
  args: MA
) => GuardInstructionExtras;

export type RouteParser<RA extends GuardRouteArgs> = (
  context: Pick<Context, 'eddsa' | 'programs' | 'serializer'>,
  routeContext: RouteContext,
  args: RA
) => GuardInstructionExtras;

export const noopParser: MintParser<{}> & RouteParser<{}> = () => ({
  data: new Uint8Array(),
  remainingAccounts: [],
});

export type MintContext = {
  /** The wallet to use for validation and non-SOL fees, this is typically the payer. */
  minter: Signer;
  /** The wallet to use for SOL fees. */
  payer: Signer;
  /** The NFT mint account as a Signer. */
  mint: Signer;
  /** The address of the Candy Machine we are using. */
  candyMachine: PublicKey;
  /** The address of the Candy Guard we are using. */
  candyGuard: PublicKey;
  /** The address of the Candy Guard's authority. */
  candyGuardAuthority: PublicKey;
};

export type RouteContext = Omit<MintContext, 'minter' | 'mint'>;

/** Additional data and accounts to pass to the mint or route instruction. */
export type GuardInstructionExtras = {
  /** The serialized data to pass to the instruction. */
  data: Uint8Array;
  /** {@inheritDoc GuardRemainingAccount} */
  remainingAccounts: GuardRemainingAccount[];
};

/**
 * A remaining account to push to the mint or route instruction.
 * When `isSigner` is true, the `address` attribute must be `Signer`
 * and it will be pushed to the `signers` array of the transaction.
 */
export type GuardRemainingAccount =
  | { publicKey: PublicKey; isWritable: boolean }
  | { signer: Signer; isWritable: boolean };
