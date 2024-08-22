import { findAssociatedTokenPda } from '@metaplex-foundation/mpl-toolbox';
import {
  Context,
  publicKey,
  PublicKey,
  transactionBuilder,
  TransactionBuilder,
} from '@metaplex-foundation/umi';
import { NATIVE_MINT } from './constants';
import { baseSettleCoreAssetSale } from './generated';

export type SettleCoreAssetSaleInput = Parameters<
  typeof baseSettleCoreAssetSale
>[1] & {
  creators: PublicKey[];
};

export const settleCoreAssetSale = (
  context: Parameters<typeof baseSettleCoreAssetSale>[0] & Pick<Context, 'rpc'>,
  input: SettleCoreAssetSaleInput
): TransactionBuilder =>
  transactionBuilder().add(
    baseSettleCoreAssetSale(context, {
      ...input,
    }).addRemainingAccounts(
      input.creators.flatMap((creator) => {
        const accounts = [
          {
            pubkey: creator,
            isSigner: false,
            isWritable:
              input.paymentMint == null || input.paymentMint === NATIVE_MINT,
          },
        ];
        if (input.paymentMint != null && input.paymentMint !== NATIVE_MINT) {
          accounts.push({
            pubkey: findAssociatedTokenPda(context, {
              mint: publicKey(input.paymentMint),
              owner: creator,
            })[0],
            isSigner: false,
            isWritable: true,
          });
        }
        return accounts;
      })
    )
  );
