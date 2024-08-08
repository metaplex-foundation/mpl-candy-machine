import {
  Context,
  PublicKey,
  transactionBuilder,
  TransactionBuilder,
} from '@metaplex-foundation/umi';
import { NATIVE_MINT } from './constants';
import {
  createGumballGuard,
  CreateGumballGuardInstructionDataArgs,
} from './createGumballGuard';
import { createGumballMachine } from './createGumballMachine';
import { DefaultGuardSetArgs } from './defaultGuards';
import { TokenPaymentArgs, wrap } from './generated';
import { GuardRepository, GuardSetArgs } from './guards';
import { findGumballGuardPda } from './hooked';

export type CreateInput<DA extends GuardSetArgs = DefaultGuardSetArgs> =
  Parameters<typeof createGumballMachine>[1] &
    CreateGumballGuardInstructionDataArgs<DA>;

export const create = async <DA extends GuardSetArgs = DefaultGuardSetArgs>(
  context: Parameters<typeof createGumballMachine>[0] &
    Pick<Context, 'eddsa'> & {
      guards: GuardRepository;
    },
  input: CreateInput<DA extends undefined ? DefaultGuardSetArgs : DA>
): Promise<TransactionBuilder> => {
  // Auto-set payment mint if solPayment or tokenPayment is set.
  input.settings.paymentMint = getPaymentMint(input);

  const { guards, groups, ...rest } = input;
  const gumballGuard = findGumballGuardPda(context, {
    base: input.gumballMachine.publicKey,
  });

  return transactionBuilder()
    .add(await createGumballMachine(context, rest))
    .add(
      createGumballGuard(context, {
        base: input.gumballMachine,
        guards,
        groups,
      })
    )
    .add(
      wrap(context, {
        gumballGuard,
        gumballMachine: input.gumballMachine.publicKey,
      })
    );
};

function getPaymentMint<DA extends GuardSetArgs = DefaultGuardSetArgs>(
  input: CreateInput<DA extends undefined ? DefaultGuardSetArgs : DA>
) {
  // eslint-disable-next-line no-restricted-syntax
  for (const group of input.groups ?? []) {
    const mint = getPaymentMintFromGuards(group.guards);
    if (mint) {
      return mint;
    }
  }

  return getPaymentMintFromGuards(input.guards);
}

function getPaymentMintFromGuards(
  guards: Partial<GuardSetArgs> | undefined
): PublicKey {
  if (guards?.solPayment) {
    return NATIVE_MINT;
  }

  if (guards?.tokenPayment) {
    return (guards.tokenPayment as TokenPaymentArgs).mint;
  }

  if (guards?.token2022Payment) {
    return (guards.token2022Payment as TokenPaymentArgs).mint;
  }

  return NATIVE_MINT;
}
