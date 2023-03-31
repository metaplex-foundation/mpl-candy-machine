import { AccountMeta, Connection, Keypair, PublicKey } from '@solana/web3.js';
import { Test } from 'tape';
import { PayerTransactionHandler } from '@metaplex-foundation/amman-client';
import { keypairIdentity, Metaplex } from '@metaplex-foundation/js';
import { amman, InitTransactions } from '../setup';

export async function multiple(
  t: Test,
  quantity: number,
  candyGuard: PublicKey,
  candyMachine: PublicKey,
  payer: Keypair,
  handler: PayerTransactionHandler,
  connection: Connection,
  remainingAccounts?: AccountMeta[] | null,
  mintArgs?: Uint8Array | null,
  label?: string | null,
): Promise<number[]> {
  const API = new InitTransactions();
  const indices: number[] = [];

  for (let i = 0; i < quantity; i++) {
    const [, mint] = await amman.genLabeledKeypair(`Mint Account ${i} (minter)`);
    // minting
    const { tx: mintTransaction } = await API.mint(
      t,
      candyGuard,
      candyMachine,
      payer,
      mint,
      handler,
      connection,
      remainingAccounts,
      mintArgs,
      label,
    );
    await mintTransaction.assertNone();

    const metaplex = Metaplex.make(connection).use(keypairIdentity(payer));
    const nft = await metaplex.nfts().findByMint({ mintAddress: mint.publicKey });
    indices.push(parseInt(nft.name));
  }

  return indices;
}
