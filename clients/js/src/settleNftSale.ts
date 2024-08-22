import { findAssociatedTokenPda } from '@metaplex-foundation/mpl-toolbox';
import {
  Context,
  publicKey,
  PublicKey,
  transactionBuilder,
  TransactionBuilder,
} from '@metaplex-foundation/umi';
import { NATIVE_MINT } from './constants';
import { baseSettleNftSale } from './generated';

export type SettleNftSaleInput = Parameters<typeof baseSettleNftSale>[1] & {
  creators: PublicKey[];
};

export const settleNftSale = (
  context: Parameters<typeof baseSettleNftSale>[0] & Pick<Context, 'rpc'>,
  input: SettleNftSaleInput
): TransactionBuilder =>
  transactionBuilder().add(
    baseSettleNftSale(context, {
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
