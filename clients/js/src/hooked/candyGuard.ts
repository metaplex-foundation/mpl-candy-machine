import {
  Account,
  assertAccountExists,
  Context,
  deserializeAccount,
  gpaBuilder,
  mapSerializer,
  PublicKey,
  RpcAccount,
  RpcGetAccountOptions,
  RpcGetAccountsOptions,
  Serializer,
} from '@metaplex-foundation/umi';
import { DefaultGuardSet, DefaultGuardSetArgs } from '../defaultGuards';
import { findCandyGuardPda } from '../generated/accounts/candyGuard';
import {
  CandyGuardProgram,
  getGuardGroupSerializer,
  getGuardSetSerializer,
  GuardRepository,
  GuardSet,
  GuardSetArgs,
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
  DA extends GuardSetArgs = DefaultGuardSetArgs,
  D extends DA & GuardSet = DA
>(
  context: Pick<Context, 'serializer' | 'programs'> & {
    guards: GuardRepository;
  },
  program?: CandyGuardProgram
): Serializer<CandyGuardAccountDataArgs<DA>, CandyGuardAccountData<D>> {
  const s = context.serializer;
  program ??= context.programs.get<CandyGuardProgram>('mplCandyGuard');
  return mapSerializer(
    s.struct<any>(
      [
        ['discriminator', s.array(s.u8(), { size: 8 })],
        ['base', s.publicKey()],
        ['bump', s.u8()],
        ['authority', s.publicKey()],
        ['guards', getGuardSetSerializer<DA, D>(context, program)],
        ['groups', s.array(getGuardGroupSerializer<DA, D>(context, program))],
      ],
      { description: 'CandyGuard' }
    ),
    (value) => ({ ...value, discriminator: DISCRIMINATOR })
  ) as Serializer<CandyGuardAccountDataArgs<DA>, CandyGuardAccountData<D>>;
}

export function deserializeCandyGuard<D extends GuardSet = DefaultGuardSet>(
  context: Pick<Context, 'serializer' | 'programs'> & {
    guards: GuardRepository;
  },
  rawAccount: RpcAccount,
  program?: CandyGuardProgram
): CandyGuard<D> {
  return deserializeAccount(
    rawAccount,
    getCandyGuardAccountDataSerializer<D>(context, program)
  );
}

export async function fetchCandyGuard<D extends GuardSet = DefaultGuardSet>(
  context: Pick<Context, 'serializer' | 'programs' | 'rpc'> & {
    guards: GuardRepository;
  },
  publicKey: PublicKey,
  options?: RpcGetAccountOptions,
  program?: CandyGuardProgram
): Promise<CandyGuard<D>> {
  const maybeAccount = await context.rpc.getAccount(publicKey, options);
  assertAccountExists(maybeAccount, 'CandyGuard');
  return deserializeCandyGuard<D>(context, maybeAccount, program);
}

export async function safeFetchCandyGuard<D extends GuardSet = DefaultGuardSet>(
  context: Pick<Context, 'serializer' | 'programs' | 'rpc'> & {
    guards: GuardRepository;
  },
  publicKey: PublicKey,
  options?: RpcGetAccountOptions,
  program?: CandyGuardProgram
): Promise<CandyGuard<D> | null> {
  const maybeAccount = await context.rpc.getAccount(publicKey, options);
  return maybeAccount.exists
    ? deserializeCandyGuard<D>(context, maybeAccount, program)
    : null;
}

export async function fetchAllCandyGuard<D extends GuardSet = DefaultGuardSet>(
  context: Pick<Context, 'serializer' | 'programs' | 'rpc'> & {
    guards: GuardRepository;
  },
  publicKeys: PublicKey[],
  options?: RpcGetAccountsOptions,
  program?: CandyGuardProgram
): Promise<CandyGuard<D>[]> {
  const maybeAccounts = await context.rpc.getAccounts(publicKeys, options);
  return maybeAccounts.map((maybeAccount) => {
    assertAccountExists(maybeAccount, 'CandyGuard');
    return deserializeCandyGuard<D>(context, maybeAccount, program);
  });
}

export async function safeFetchAllCandyGuard<
  D extends GuardSet = DefaultGuardSet
>(
  context: Pick<Context, 'serializer' | 'programs' | 'rpc'> & {
    guards: GuardRepository;
  },
  publicKeys: PublicKey[],
  options?: RpcGetAccountsOptions,
  program?: CandyGuardProgram
): Promise<CandyGuard<D>[]> {
  const maybeAccounts = await context.rpc.getAccounts(publicKeys, options);
  return maybeAccounts
    .filter((maybeAccount) => maybeAccount.exists)
    .map((maybeAccount) =>
      deserializeCandyGuard<D>(context, maybeAccount as RpcAccount, program)
    );
}

export function getCandyGuardGpaBuilder<D extends GuardSet = DefaultGuardSet>(
  context: Pick<Context, 'serializer' | 'programs' | 'rpc'> & {
    guards: GuardRepository;
  },
  program?: CandyGuardProgram
) {
  const s = context.serializer;
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
      discriminator: [0, s.array(s.u8(), { size: 8 })],
      base: [8, s.publicKey()],
      bump: [40, s.u8()],
      authority: [41, s.publicKey()],
    })
    .deserializeUsing<CandyGuard<D>>((account) =>
      deserializeCandyGuard(context, account, program)
    )
    .whereField('discriminator', DISCRIMINATOR);
}
