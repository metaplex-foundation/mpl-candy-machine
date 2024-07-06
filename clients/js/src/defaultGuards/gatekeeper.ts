import { PublicKey } from '@metaplex-foundation/umi';
import { publicKey, string } from '@metaplex-foundation/umi/serializers';
import {
  Gatekeeper,
  GatekeeperArgs,
  getGatekeeperSerializer,
} from '../generated';
import { GuardManifest, GuardRemainingAccount, noopParser } from '../guards';

/**
 * The gatekeeper guard checks whether the minting wallet
 * has a valid Gateway Token from a specified Gateway Network.
 *
 * In most cases, this token will be obtain after completing a
 * captcha challenge but any Gateway Network may be used.
 *
 * The `network` argument specifies the public key of the Gatekeeper
 * Network that will be used to check the validity of the minting wallet.
 * For instance, you may use the "Civic Captcha Pass" Network,
 * which ensures the minting wallet has passed a captcha, by using
 * the following address: `ignREusXmGrscGNUesoU9mxfds9AiYTezUKex2PsZV6`.
 *
 * The `expireOnUse` argument defines whether we should mark the Gateway
 * Token of the minting wallet as expired after the NFT has been minting.
 * - When set to `true`, they will need to go through the Gatekeeper
 * Network again in order to mint another NFT.
 * - When set to `false`, they will be able to mint another NFT
 * until the Gateway Token expires naturally.
 */
export const gatekeeperGuardManifest: GuardManifest<
  GatekeeperArgs,
  Gatekeeper,
  GatekeeperMintArgs
> = {
  name: 'gatekeeper',
  serializer: getGatekeeperSerializer,
  mintParser: (context, mintContext, args) => {
    const gatewayProgramId = context.programs.getPublicKey(
      'civicGateway',
      'gatem74V238djXdzWnJf94Wo1DcnuGkfijbf3AuBhfs'
    );
    const tokenAccount =
      args?.tokenAccount ??
      context.eddsa.findPda(gatewayProgramId, [
        publicKey().serialize(mintContext.buyer),
        string({ size: 'variable' }).serialize('gateway'),
        new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0]),
        publicKey().serialize(args.gatekeeperNetwork),
      ])[0];
    const remainingAccounts: GuardRemainingAccount[] = [
      { publicKey: tokenAccount, isWritable: true },
    ];
    if (args.expireOnUse) {
      const [expireAccount] = context.eddsa.findPda(gatewayProgramId, [
        publicKey().serialize(args.gatekeeperNetwork),
        string({ size: 'variable' }).serialize('expire'),
      ]);
      remainingAccounts.push({
        publicKey: gatewayProgramId,
        isWritable: false,
      });
      remainingAccounts.push({
        publicKey: expireAccount,
        isWritable: false,
      });
    }
    return { data: new Uint8Array(), remainingAccounts };
  },
  routeParser: noopParser,
};

export type GatekeeperMintArgs = GatekeeperArgs & {
  /**
   * The Gateway Token PDA derived from the payer
   * and the Gatekeeper Network which is used to
   * verify the payer's eligibility to mint.
   *
   * @defaultValue
   * Computes the Gateway Token PDA using the payer's and the
   * Gatekeeper Network's public keys as well as the default
   * `seed` value which is `[0, 0, 0, 0, 0, 0, 0, 0]`.
   */
  tokenAccount?: PublicKey;
};
