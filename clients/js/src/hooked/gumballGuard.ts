import {
  Account,
  assertAccountExists,
  Context,
  deserializeAccount,
  gpaBuilder,
  Pda,
  PublicKey,
  publicKey as toPublicKey,
  RpcAccount,
  RpcGetAccountOptions,
  RpcGetAccountsOptions,
} from '@metaplex-foundation/umi';
import {
  array,
  mapSerializer,
  publicKey as publicKeySerializer,
  Serializer,
  struct,
  u8,
} from '@metaplex-foundation/umi/serializers';
import { DefaultGuardSet, DefaultGuardSetArgs } from '../defaultGuards';
import { findGumballGuardPda } from '../generated/accounts/gumballGuard';
import {
  CandyGuardProgram,
  getGuardGroupSerializer,
  getGuardSetSerializer,
  GuardRepository,
  GuardSet,
  GuardSetArgs,
} from '../guards';
import { GumballGuardData, GumballGuardDataArgs } from './gumballGuardData';

const DISCRIMINATOR = [95, 25, 33, 117, 164, 206, 9, 250];

export { findGumballGuardPda };

export type GumballGuard<D extends GuardSet = DefaultGuardSet> = Account<
  GumballGuardAccountData<D>
>;

export type GumballGuardAccountData<D extends GuardSet = DefaultGuardSet> = {
  discriminator: Array<number>;
  base: PublicKey;
  bump: number;
  authority: PublicKey;
} & GumballGuardData<D>;

export type GumballGuardAccountDataArgs<
  DA extends GuardSetArgs = DefaultGuardSetArgs
> = {
  base: PublicKey;
  bump: number;
  authority: PublicKey;
} & GumballGuardDataArgs<DA>;

export function getGumballGuardAccountDataSerializer<
  DA extends GuardSetArgs,
  D extends DA & GuardSet
>(
  context: Pick<Context, 'programs'> & {
    guards: GuardRepository;
  },
  program?: CandyGuardProgram
): Serializer<GumballGuardAccountDataArgs<DA>, GumballGuardAccountData<D>> {
  program ??= context.programs.get<CandyGuardProgram>('mplCandyGuard');
  return mapSerializer(
    struct<any>(
      [
        ['discriminator', array(u8(), { size: 8 })],
        ['base', publicKeySerializer()],
        ['bump', u8()],
        ['authority', publicKeySerializer()],
        ['guards', getGuardSetSerializer<DA, D>(context, program)],
        ['groups', array(getGuardGroupSerializer<DA, D>(context, program))],
      ],
      { description: 'GumballGuard' }
    ),
    (value) => ({ ...value, discriminator: DISCRIMINATOR })
  ) as Serializer<GumballGuardAccountDataArgs<DA>, GumballGuardAccountData<D>>;
}

export function deserializeGumballGuard<D extends GuardSet = DefaultGuardSet>(
  context: Pick<Context, 'programs'> & {
    guards: GuardRepository;
  },
  rawAccount: RpcAccount,
  program?: CandyGuardProgram
): GumballGuard<D> {
  return deserializeAccount(
    rawAccount,
    getGumballGuardAccountDataSerializer<D, D>(context, program)
  );
}

export async function fetchGumballGuard<D extends GuardSet = DefaultGuardSet>(
  context: Pick<Context, 'programs' | 'rpc'> & {
    guards: GuardRepository;
  },
  publicKey: PublicKey | Pda,
  options?: RpcGetAccountOptions,
  program?: CandyGuardProgram
): Promise<GumballGuard<D>> {
  const maybeAccount = await context.rpc.getAccount(
    toPublicKey(publicKey, false),
    options
  );
  assertAccountExists(maybeAccount, 'GumballGuard');
  return deserializeGumballGuard<D>(context, maybeAccount, program);
}

export async function safeFetchGumballGuard<
  D extends GuardSet = DefaultGuardSet
>(
  context: Pick<Context, 'programs' | 'rpc'> & {
    guards: GuardRepository;
  },
  publicKey: PublicKey | Pda,
  options?: RpcGetAccountOptions,
  program?: CandyGuardProgram
): Promise<GumballGuard<D> | null> {
  const maybeAccount = await context.rpc.getAccount(
    toPublicKey(publicKey, false),
    options
  );
  return maybeAccount.exists
    ? deserializeGumballGuard<D>(context, maybeAccount, program)
    : null;
}

export async function fetchAllGumballGuard<
  D extends GuardSet = DefaultGuardSet
>(
  context: Pick<Context, 'programs' | 'rpc'> & {
    guards: GuardRepository;
  },
  publicKeys: (PublicKey | Pda)[],
  options?: RpcGetAccountsOptions,
  program?: CandyGuardProgram
): Promise<GumballGuard<D>[]> {
  const maybeAccounts = await context.rpc.getAccounts(
    publicKeys.map((publicKey) => toPublicKey(publicKey, false)),
    options
  );
  return maybeAccounts.map((maybeAccount) => {
    assertAccountExists(maybeAccount, 'GumballGuard');
    return deserializeGumballGuard<D>(context, maybeAccount, program);
  });
}

export async function safeFetchAllGumballGuard<
  D extends GuardSet = DefaultGuardSet
>(
  context: Pick<Context, 'programs' | 'rpc'> & {
    guards: GuardRepository;
  },
  publicKeys: (PublicKey | Pda)[],
  options?: RpcGetAccountsOptions,
  program?: CandyGuardProgram
): Promise<GumballGuard<D>[]> {
  const maybeAccounts = await context.rpc.getAccounts(
    publicKeys.map((publicKey) => toPublicKey(publicKey, false)),
    options
  );
  return maybeAccounts
    .filter((maybeAccount) => maybeAccount.exists)
    .map((maybeAccount) =>
      deserializeGumballGuard<D>(context, maybeAccount as RpcAccount, program)
    );
}

export function getGumballGuardGpaBuilder<D extends GuardSet = DefaultGuardSet>(
  context: Pick<Context, 'programs' | 'rpc'> & {
    guards: GuardRepository;
  },
  program?: CandyGuardProgram
) {
  const programId = context.programs.getPublicKey(
    'mplCandyGuard',
    'GGRDy4ieS7ExrUu313QkszyuT9o3BvDLuc3H5VLgCpSF'
  );
  return gpaBuilder(context, programId)
    .registerFields<{
      discriminator: Array<number>;
      base: PublicKey;
      bump: number;
      authority: PublicKey;
    }>({
      discriminator: [0, array(u8(), { size: 8 })],
      base: [8, publicKeySerializer()],
      bump: [40, u8()],
      authority: [41, publicKeySerializer()],
    })
    .deserializeUsing<GumballGuard<D>>((account) =>
      deserializeGumballGuard(context, account, program)
    )
    .whereField('discriminator', DISCRIMINATOR);
}
