import {
  mergeBytes,
  none,
  Option,
  WrappedInstruction,
} from '@metaplex-foundation/umi';
import { DefaultGuardSetRouteArgs } from './defaultGuards';
import {
  route as baseRoute,
  RouteInstructionAccounts,
} from './generated/instructions/route';
import {
  CandyGuardProgram,
  GuardRepository,
  GuardSetRouteArgs,
  parseGuardRemainingAccounts,
  parseRouteArgs,
  RouteContext,
} from './guards';
import { findCandyGuardPda } from './hooked';

export { RouteInstructionAccounts };

export type RouteInstructionData<
  G extends keyof RA & string,
  RA extends GuardSetRouteArgs
> = {
  discriminator: Array<number>;
  guard: G;
  routeArgs: RA[G];
  group: Option<string>;
};

export type RouteInstructionDataArgs<
  G extends keyof RA & string,
  RA extends GuardSetRouteArgs
> = {
  guard: G;
  routeArgs: RA[G];
  group?: Option<string>;
};

export function route<
  G extends keyof RA & string,
  RA extends GuardSetRouteArgs = DefaultGuardSetRouteArgs
>(
  context: Parameters<typeof baseRoute>[0] & {
    guards: GuardRepository;
  },
  input: RouteInstructionAccounts &
    RouteInstructionDataArgs<
      G,
      RA extends undefined ? DefaultGuardSetRouteArgs : RA
    >
): WrappedInstruction {
  const { routeArgs = {}, group = none(), ...rest } = input;
  const program = context.programs.get<CandyGuardProgram>('mplCandyGuard');
  const routeContext: RouteContext = {
    payer: input.payer ?? context.payer,
    candyMachine: input.candyMachine,
    candyGuard:
      input.candyGuard ??
      findCandyGuardPda(context, { base: input.candyMachine }),
  };
  const { data, remainingAccounts, guardIndex } = parseRouteArgs<
    G,
    RA extends undefined ? DefaultGuardSetRouteArgs : RA
  >(context, program, routeContext, input.guard, input.routeArgs);
  const prefix = context.serializer.u32().serialize(data.length);
  const ix = baseRoute(context, {
    ...rest,
    guard: guardIndex,
    data: mergeBytes([prefix, data]),
    group,
  });

  const [keys, signers] = parseGuardRemainingAccounts(remainingAccounts);
  ix.instruction.keys.push(...keys);
  ix.signers.push(...signers);

  return ix;
}
