import {
  Account,
  Context,
  Pda,
  PublicKey,
  RpcAccount,
  RpcGetAccountOptions,
  RpcGetAccountsOptions,
  assertAccountExists,
  deserializeAccount,
  gpaBuilder,
  publicKey as toPublicKey,
} from '@metaplex-foundation/umi';
import {
  Serializer,
  array,
  mapSerializer,
  publicKey as publicKeySerializer,
  struct,
  u8,
} from '@metaplex-foundation/umi/serializers';
import { DefaultGuardSet, DefaultGuardSetArgs } from '../defaultGuards';
import { findCandyGuardPda } from '../generated/accounts/candyGuard';
import {
  CandyGuardProgram,
  GuardRepository,
  GuardSet,
  GuardSetArgs,
  getGuardGroupSerializer,
  getGuardSetSerializer,
} from '../guards';
import { CandyGuardData, CandyGuardDataArgs } from './candyGuardData';

const DISCRIMINATOR = [95, 25, 33, 117, 164, 206, 9, 250];

export { findCandyGuardPda };

export type CandyGuard<D extends GuardSet = DefaultGuardSet> = Account<
  CandyGuardAccountData<D>
>;

export type CandyGuardAccountData<D extends GuardSet = DefaultGuardSet> = {
  discriminator: Array<number>;
  base: PublicKey;
  bump: number;
  authority: PublicKey;
} & CandyGuardData<D>;

export type CandyGuardAccountDataArgs<
  DA extends GuardSetArgs = DefaultGuardSetArgs
> = {
  base: PublicKey;
  bump: number;
  authority: PublicKey;
} & CandyGuardDataArgs<DA>;

export function getCandyGuardAccountDataSerializer<
  DA extends GuardSetArgs,
  D extends DA & GuardSet
>(
  context: Pick<Context, 'programs'> & {
    guards: GuardRepository;
  },
  program?: CandyGuardProgram
): Serializer<CandyGuardAccountDataArgs<DA>, CandyGuardAccountData<D>> {
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
      { description: 'CandyGuard' }
    ),
    (value) => ({ ...value, discriminator: DISCRIMINATOR })
  ) as Serializer<CandyGuardAccountDataArgs<DA>, CandyGuardAccountData<D>>;
}

export function deserializeCandyGuard<D extends GuardSet = DefaultGuardSet>(
  context: Pick<Context, 'programs'> & {
    guards: GuardRepository;
  },
  rawAccount: RpcAccount,
  program?: CandyGuardProgram
): CandyGuard<D> {
  return deserializeAccount(
    rawAccount,
    getCandyGuardAccountDataSerializer<D, D>(context, program)
  );
}

export async function fetchCandyGuard<D extends GuardSet = DefaultGuardSet>(
  context: Pick<Context, 'programs' | 'rpc'> & {
    guards: GuardRepository;
  },
  publicKey: PublicKey | Pda,
  options?: RpcGetAccountOptions,
  program?: CandyGuardProgram
): Promise<CandyGuard<D>> {
  const maybeAccount = await context.rpc.getAccount(
    toPublicKey(publicKey, false),
    options
  );
  assertAccountExists(maybeAccount, 'CandyGuard');
  return deserializeCandyGuard<D>(context, maybeAccount, program);
}

export async function safeFetchCandyGuard<D extends GuardSet = DefaultGuardSet>(
  context: Pick<Context, 'programs' | 'rpc'> & {
    guards: GuardRepository;
  },
  publicKey: PublicKey | Pda,
  options?: RpcGetAccountOptions,
  program?: CandyGuardProgram
): Promise<CandyGuard<D> | null> {
  const maybeAccount = await context.rpc.getAccount(
    toPublicKey(publicKey, false),
    options
  );
  return maybeAccount.exists
    ? deserializeCandyGuard<D>(context, maybeAccount, program)
    : null;
}

export async function fetchAllCandyGuard<D extends GuardSet = DefaultGuardSet>(
  context: Pick<Context, 'programs' | 'rpc'> & {
    guards: GuardRepository;
  },
  publicKeys: (PublicKey | Pda)[],
  options?: RpcGetAccountsOptions,
  program?: CandyGuardProgram
): Promise<CandyGuard<D>[]> {
  const maybeAccounts = await context.rpc.getAccounts(
    publicKeys.map((publicKey) => toPublicKey(publicKey, false)),
    options
  );
  return maybeAccounts.map((maybeAccount) => {
    assertAccountExists(maybeAccount, 'CandyGuard');
    return deserializeCandyGuard<D>(context, maybeAccount, program);
  });
}

export async function safeFetchAllCandyGuard<
  D extends GuardSet = DefaultGuardSet
>(
  context: Pick<Context, 'programs' | 'rpc'> & {
    guards: GuardRepository;
  },
  publicKeys: (PublicKey | Pda)[],
  options?: RpcGetAccountsOptions,
  program?: CandyGuardProgram
): Promise<CandyGuard<D>[]> {
  const maybeAccounts = await context.rpc.getAccounts(
    publicKeys.map((publicKey) => toPublicKey(publicKey, false)),
    options
  );
  return maybeAccounts
    .filter((maybeAccount) => maybeAccount.exists)
    .map((maybeAccount) =>
      deserializeCandyGuard<D>(context, maybeAccount as RpcAccount, program)
    );
}

export function getCandyGuardGpaBuilder<D extends GuardSet = DefaultGuardSet>(
  context: Pick<Context, 'programs' | 'rpc'> & {
    guards: GuardRepository;
  },
  program?: CandyGuardProgram
) {
  const programId = context.programs.getPublicKey(
    'mplCandyGuard',
    'Guard1JwRhJkVH6XZhzoYxeBVQe872VH6QggF4BWmS9g'
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
    .deserializeUsing<CandyGuard<D>>((account) =>
      deserializeCandyGuard(context, account, program)
    )
    .whereField('discriminator', DISCRIMINATOR);
}
