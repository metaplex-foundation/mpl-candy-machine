/**
 * This code was AUTOGENERATED using the kinobi library.
 * Please DO NOT EDIT THIS FILE, instead use visitors
 * to add features, then rerun kinobi to update it.
 *
 * @see https://github.com/metaplex-foundation/kinobi
 */

import {
  TokenStandardArgs,
  getTokenStandardSerializer,
} from '@metaplex-foundation/mpl-token-metadata';
import {
  Account,
  Context,
  PublicKey,
  RpcAccount,
  RpcGetAccountOptions,
  RpcGetAccountsOptions,
  assertAccountExists,
  deserializeAccount,
  gpaBuilder,
} from '@metaplex-foundation/umi';
import {
  CandyMachineAccountData,
  getCandyMachineAccountDataSerializer,
} from '../../hooked';
import {
  AccountVersionArgs,
  CandyMachineDataArgs,
  getAccountVersionSerializer,
  getCandyMachineDataSerializer,
} from '../types';

export type CandyMachine = Account<CandyMachineAccountData>;

export function deserializeCandyMachine(
  context: Pick<Context, 'serializer'>,
  rawAccount: RpcAccount
): CandyMachine {
  return deserializeAccount(
    rawAccount,
    getCandyMachineAccountDataSerializer(context)
  );
}

export async function fetchCandyMachine(
  context: Pick<Context, 'rpc' | 'serializer'>,
  publicKey: PublicKey,
  options?: RpcGetAccountOptions
): Promise<CandyMachine> {
  const maybeAccount = await context.rpc.getAccount(publicKey, options);
  assertAccountExists(maybeAccount, 'CandyMachine');
  return deserializeCandyMachine(context, maybeAccount);
}

export async function safeFetchCandyMachine(
  context: Pick<Context, 'rpc' | 'serializer'>,
  publicKey: PublicKey,
  options?: RpcGetAccountOptions
): Promise<CandyMachine | null> {
  const maybeAccount = await context.rpc.getAccount(publicKey, options);
  return maybeAccount.exists
    ? deserializeCandyMachine(context, maybeAccount)
    : null;
}

export async function fetchAllCandyMachine(
  context: Pick<Context, 'rpc' | 'serializer'>,
  publicKeys: PublicKey[],
  options?: RpcGetAccountsOptions
): Promise<CandyMachine[]> {
  const maybeAccounts = await context.rpc.getAccounts(publicKeys, options);
  return maybeAccounts.map((maybeAccount) => {
    assertAccountExists(maybeAccount, 'CandyMachine');
    return deserializeCandyMachine(context, maybeAccount);
  });
}

export async function safeFetchAllCandyMachine(
  context: Pick<Context, 'rpc' | 'serializer'>,
  publicKeys: PublicKey[],
  options?: RpcGetAccountsOptions
): Promise<CandyMachine[]> {
  const maybeAccounts = await context.rpc.getAccounts(publicKeys, options);
  return maybeAccounts
    .filter((maybeAccount) => maybeAccount.exists)
    .map((maybeAccount) =>
      deserializeCandyMachine(context, maybeAccount as RpcAccount)
    );
}

export function getCandyMachineGpaBuilder(
  context: Pick<Context, 'rpc' | 'serializer' | 'programs'>
) {
  const s = context.serializer;
  const programId = context.programs.get('mplCandyMachineCore').publicKey;
  return gpaBuilder(context, programId)
    .registerFields<{
      discriminator: Array<number>;
      version: AccountVersionArgs;
      tokenStandard: TokenStandardArgs;
      features: Array<number>;
      authority: PublicKey;
      mintAuthority: PublicKey;
      collectionMint: PublicKey;
      itemsRedeemed: number | bigint;
      data: CandyMachineDataArgs;
    }>({
      discriminator: [0, s.array(s.u8(), { size: 8 })],
      version: [8, getAccountVersionSerializer(context)],
      tokenStandard: [9, getTokenStandardSerializer(context)],
      features: [null, s.array(s.u8(), { size: 6 })],
      authority: [null, s.publicKey()],
      mintAuthority: [null, s.publicKey()],
      collectionMint: [null, s.publicKey()],
      itemsRedeemed: [null, s.u64()],
      data: [null, getCandyMachineDataSerializer(context)],
    })
    .deserializeUsing<CandyMachine>((account) =>
      deserializeCandyMachine(context, account)
    )
    .whereField('discriminator', [115, 157, 18, 166, 35, 44, 221, 13]);
}
