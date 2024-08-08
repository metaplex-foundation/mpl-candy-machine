import { Context, PublicKey, Signer } from '@metaplex-foundation/umi';
import { Serializer } from '@metaplex-foundation/umi/serializers';

export type GuardManifest<
  DA extends object = {},
  D extends DA = DA,
  MA extends object = {},
  RA extends object = {}
> = {
  name: string;
  serializer: () => Serializer<DA, D>;
  mintParser: MintParser<MA>;
  routeParser: RouteParser<RA>;
};

export type MintParser<MA extends object> = (
  context: Pick<Context, 'eddsa' | 'programs'>,
  mintContext: MintContext,
  args: MA
) => GuardInstructionExtras;

export type RouteParser<RA extends object> = (
  context: Pick<Context, 'eddsa' | 'programs'>,
  routeContext: RouteContext,
  args: RA
) => GuardInstructionExtras;

export const noopParser: MintParser<{}> & RouteParser<{}> = () => ({
  data: new Uint8Array(),
  remainingAccounts: [],
});

export type MintContext = {
  /** The wallet to use for validation and non-SOL fees, this is typically the payer. */
  buyer: Signer;
  /** The wallet to use for SOL fees. */
  payer: Signer;
  /** The address of the Gumball Machine we are using. */
  gumballMachine: PublicKey;
  /** The address of the Gumball Guard we are using. */
  gumballGuard: PublicKey;
};

export type RouteContext = Omit<MintContext, 'buyer' | 'mint'>;

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
