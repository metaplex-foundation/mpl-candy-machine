import {
  Context,
  Option,
  PublicKey,
  Serializer,
  Signer,
} from '@metaplex-foundation/umi';

export type GuardManifest<
  DA extends object = {},
  D extends DA = DA,
  MA extends object = {},
  RA extends object = {}
> = {
  name: string;
  serializer: (context: Pick<Context, 'serializer'>) => Serializer<DA, D>;
  mintParser: MintParser<MA>;
  routeParser: RouteParser<RA>;
};

export type GuardSetDataArgs = {
  [name: string]: Option<object>;
};
export type GuardSetData = {
  [name: string]: Option<object>;
};
export type GuardSetMintArgs = {
  [name: string]: Option<object>;
};
export type GuardSetRouteArgs = {
  [name: string]: Option<object>;
};

export type MintParser<MA extends object> = (
  context: Pick<Context, 'eddsa' | 'programs' | 'serializer'>,
  mintContext: MintContext,
  args: MA
) => GuardInstructionExtras;

export type RouteParser<RA extends object> = (
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
