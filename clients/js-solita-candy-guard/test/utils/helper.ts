import { Test } from 'tape';
import {
  ConfirmedTransactionAssertablePromise,
  PayerTransactionHandler,
} from '@metaplex-foundation/amman-client';
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  SYSVAR_SLOT_HASHES_PUBKEY,
  SYSVAR_INSTRUCTIONS_PUBKEY,
  ComputeBudgetProgram,
} from '@solana/web3.js';
import {
  AddConfigLinesInstructionAccounts,
  AddConfigLinesInstructionArgs,
  AccountVersion,
  CandyMachine,
  CandyMachineData,
  ConfigLine,
  createAddConfigLinesInstruction,
  createInitializeInstruction,
  createInitializeV2Instruction,
  createMintInstruction,
  createMintV2Instruction,
  InitializeInstructionAccounts,
  InitializeV2InstructionAccounts,
  InitializeInstructionArgs,
  InitializeV2InstructionArgs,
  MintInstructionAccounts,
  MintV2InstructionAccounts,
  PROGRAM_ID,
} from '@metaplex-foundation/mpl-candy-machine-core';
import { amman } from '../setup';
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  createInitializeMintInstruction,
  createMintToInstruction,
  MintLayout,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import { keypairIdentity, Metaplex } from '@metaplex-foundation/js';
import { TokenStandard } from '@metaplex-foundation/mpl-token-metadata';
import { COLLECTION_METADATA } from './constants';
import { getCandyMachineSpace } from '.';
import { BN } from 'bn.js';

export const CANDY_MACHINE_PROGRAM = PROGRAM_ID;
export const METAPLEX_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');

export class CandyMachineHelper {
  async initialize(
    t: Test,
    payer: Keypair,
    candyMachine: Keypair,
    data: CandyMachineData,
    handler: PayerTransactionHandler,
    connection: Connection,
  ): Promise<{ tx: ConfirmedTransactionAssertablePromise }> {
    // creates a collection nft
    const metaplex = Metaplex.make(connection).use(keypairIdentity(payer));

    const { nft: collection } = await metaplex.nfts().create({
      uri: COLLECTION_METADATA,
      name: 'CORE Collection',
      sellerFeeBasisPoints: 500,
    });

    const authorityPda = metaplex
      .candyMachines()
      .pdas()
      .authority({ candyMachine: candyMachine.publicKey });

    await amman.addr.addLabel('Collection Mint', collection.address);

    const collectionAuthorityRecord = metaplex.nfts().pdas().collectionAuthorityRecord({
      mint: collection.mint.address,
      collectionAuthority: authorityPda,
    });
    await amman.addr.addLabel('Collection Authority Record', collectionAuthorityRecord);

    const collectionMetadata = metaplex.nfts().pdas().metadata({ mint: collection.mint.address });
    await amman.addr.addLabel('Collection Metadata', collectionMetadata);

    const collectionMasterEdition = metaplex
      .nfts()
      .pdas()
      .masterEdition({ mint: collection.mint.address });
    await amman.addr.addLabel('Collection Master Edition', collectionMasterEdition);

    const accounts: InitializeInstructionAccounts = {
      authorityPda,
      collectionUpdateAuthority: collection.updateAuthorityAddress,
      candyMachine: candyMachine.publicKey,
      authority: payer.publicKey,
      payer: payer.publicKey,
      collectionMetadata,
      collectionMint: collection.address,
      collectionMasterEdition,
      collectionAuthorityRecord,
      tokenMetadataProgram: METAPLEX_PROGRAM_ID,
    };

    const args: InitializeInstructionArgs = {
      data: data,
    };

    const ixInitialize = createInitializeInstruction(accounts, args);
    const ixCreateAccount = SystemProgram.createAccount({
      fromPubkey: payer.publicKey,
      newAccountPubkey: candyMachine.publicKey,
      lamports: await connection.getMinimumBalanceForRentExemption(getCandyMachineSpace(data)),
      space: getCandyMachineSpace(data),
      programId: CANDY_MACHINE_PROGRAM,
    });

    const tx = new Transaction().add(ixCreateAccount).add(ixInitialize);

    const txPromise = handler.sendAndConfirmTransaction(
      tx,
      [candyMachine, payer],
      'tx: Candy Machine Initialize',
    );

    return { tx: txPromise };
  }

  async initializeV2(
    t: Test,
    payer: Keypair,
    candyMachine: Keypair,
    data: CandyMachineData,
    tokenStandard: TokenStandard,
    handler: PayerTransactionHandler,
    connection: Connection,
  ): Promise<{ tx: ConfirmedTransactionAssertablePromise }> {
    // creates a collection nft
    const metaplex = Metaplex.make(connection).use(keypairIdentity(payer));

    const { nft: collection } = await metaplex.nfts().create({
      uri: COLLECTION_METADATA,
      name: 'CORE Collection',
      sellerFeeBasisPoints: 500,
    });

    const authorityPda = metaplex
      .candyMachines()
      .pdas()
      .authority({ candyMachine: candyMachine.publicKey });

    await amman.addr.addLabel('Collection Mint', collection.address);

    const collectionMetadata = metaplex.nfts().pdas().metadata({ mint: collection.mint.address });
    await amman.addr.addLabel('Collection Metadata', collectionMetadata);

    const collectionMasterEdition = metaplex
      .nfts()
      .pdas()
      .masterEdition({ mint: collection.mint.address });
    await amman.addr.addLabel('Collection Master Edition', collectionMasterEdition);

    const collectionDelegateRecord = metaplex.nfts().pdas().metadataDelegateRecord({
      mint: collection.address,
      type: 'CollectionV1',
      updateAuthority: payer.publicKey,
      delegate: authorityPda,
    });
    await amman.addr.addLabel('Metadata Delegate Record', collectionDelegateRecord);

    const accounts: InitializeV2InstructionAccounts = {
      authorityPda,
      collectionUpdateAuthority: collection.updateAuthorityAddress,
      candyMachine: candyMachine.publicKey,
      authority: payer.publicKey,
      payer: payer.publicKey,
      collectionMetadata,
      collectionMint: collection.address,
      collectionMasterEdition,
      collectionDelegateRecord,
      tokenMetadataProgram: METAPLEX_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
      sysvarInstructions: SYSVAR_INSTRUCTIONS_PUBKEY,
    };

    const args: InitializeV2InstructionArgs = {
      data: data,
      tokenStandard,
    };

    const ixCreateAccount = SystemProgram.createAccount({
      fromPubkey: payer.publicKey,
      newAccountPubkey: candyMachine.publicKey,
      lamports: await connection.getMinimumBalanceForRentExemption(getCandyMachineSpace(data)),
      space: getCandyMachineSpace(data),
      programId: CANDY_MACHINE_PROGRAM,
    });
    const ixInitialize = createInitializeV2Instruction(accounts, args);

    const tx = new Transaction().add(ixCreateAccount).add(ixInitialize);

    const txPromise = handler.sendAndConfirmTransaction(
      tx,
      [candyMachine, payer],
      'tx: Candy Machine InitializeV2',
    );

    return { tx: txPromise };
  }

  async addConfigLines(
    t: Test,
    candyMachine: PublicKey,
    payer: Keypair,
    lines: ConfigLine[],
  ): Promise<{ txs: Transaction[] }> {
    const accounts: AddConfigLinesInstructionAccounts = {
      candyMachine: candyMachine,
      authority: payer.publicKey,
    };

    const txs: Transaction[] = [];
    let start = 0;

    while (start < lines.length) {
      // sends the config lines in chunks of 10
      const limit = Math.min(lines.length - start, 10);
      const args: AddConfigLinesInstructionArgs = {
        configLines: lines.slice(start, start + limit),
        index: start,
      };

      const ix = createAddConfigLinesInstruction(accounts, args);
      txs.push(new Transaction().add(ix));

      start = start + limit;
    }

    return { txs };
  }

  async mint(
    t: Test,
    candyMachine: PublicKey,
    payer: Keypair,
    mint: Keypair,
    handler: PayerTransactionHandler,
    connection: Connection,
  ): Promise<{ tx: ConfirmedTransactionAssertablePromise }> {
    const candyMachineObject = await CandyMachine.fromAccountAddress(connection, candyMachine);

    // PDAs required for the mint

    const metaplex = Metaplex.make(connection).use(keypairIdentity(payer));

    const nftMetadata = metaplex.nfts().pdas().metadata({ mint: mint.publicKey });
    const nftMasterEdition = metaplex.nfts().pdas().masterEdition({ mint: mint.publicKey });
    const nftTokenAccount = metaplex
      .tokens()
      .pdas()
      .associatedTokenAccount({ mint: mint.publicKey, owner: payer.publicKey });

    const collectionMint = candyMachineObject.collectionMint;
    // retrieves the collection nft
    const collection = await metaplex.nfts().findByMint({ mintAddress: collectionMint });
    // collection PDAs
    const authorityPda = metaplex.candyMachines().pdas().authority({ candyMachine });
    const collectionAuthorityRecord = metaplex.nfts().pdas().collectionAuthorityRecord({
      mint: collectionMint,
      collectionAuthority: authorityPda,
    });

    const collectionMetadata = metaplex.nfts().pdas().metadata({ mint: collectionMint });
    const collectionMasterEdition = metaplex.nfts().pdas().masterEdition({ mint: collectionMint });

    const accounts: MintInstructionAccounts = {
      candyMachine: candyMachine,
      authorityPda,
      mintAuthority: candyMachineObject.mintAuthority,
      payer: payer.publicKey,
      nftMint: mint.publicKey,
      nftMintAuthority: payer.publicKey,
      nftMetadata,
      nftMasterEdition,
      collectionAuthorityRecord,
      collectionMint,
      collectionUpdateAuthority: collection.updateAuthorityAddress,
      collectionMetadata,
      collectionMasterEdition,
      tokenMetadataProgram: METAPLEX_PROGRAM_ID,
      recentSlothashes: SYSVAR_SLOT_HASHES_PUBKEY,
    };

    const ixs: TransactionInstruction[] = [];
    ixs.push(
      SystemProgram.createAccount({
        fromPubkey: payer.publicKey,
        newAccountPubkey: mint.publicKey,
        lamports: await connection.getMinimumBalanceForRentExemption(MintLayout.span),
        space: MintLayout.span,
        programId: TOKEN_PROGRAM_ID,
      }),
    );
    ixs.push(createInitializeMintInstruction(mint.publicKey, 0, payer.publicKey, payer.publicKey));
    ixs.push(
      createAssociatedTokenAccountInstruction(
        payer.publicKey,
        nftTokenAccount,
        payer.publicKey,
        mint.publicKey,
      ),
    );
    ixs.push(createMintToInstruction(mint.publicKey, nftTokenAccount, payer.publicKey, 1, []));
    // candy machine mint instruction
    ixs.push(createMintInstruction(accounts));
    const tx = new Transaction().add(...ixs);

    return { tx: handler.sendAndConfirmTransaction(tx, [payer, mint], 'tx: Candy Machine Mint') };
  }

  async mintV2(
    t: Test,
    candyMachine: PublicKey,
    minter: Keypair,
    payer: Keypair,
    mint: Keypair,
    handler: PayerTransactionHandler,
    connection: Connection,
  ): Promise<{ tx: ConfirmedTransactionAssertablePromise }> {
    const candyMachineObject = await CandyMachine.fromAccountAddress(connection, candyMachine);

    // PDAs required for the mint

    const metaplex = Metaplex.make(connection).use(keypairIdentity(payer));

    const nftMetadata = metaplex.nfts().pdas().metadata({ mint: mint.publicKey });
    const nftMasterEdition = metaplex.nfts().pdas().masterEdition({ mint: mint.publicKey });
    const nftTokenAccount = metaplex
      .tokens()
      .pdas()
      .associatedTokenAccount({ mint: mint.publicKey, owner: minter.publicKey });

    const authorityPda = metaplex.candyMachines().pdas().authority({ candyMachine });

    const collectionMint = candyMachineObject.collectionMint;
    // retrieves the collection nft
    const collection = await metaplex.nfts().findByMint({ mintAddress: collectionMint });
    // collection PDAs
    const collectionMetadata = metaplex.nfts().pdas().metadata({ mint: collectionMint });
    const collectionMasterEdition = metaplex.nfts().pdas().masterEdition({ mint: collectionMint });

    const collectionDelegateRecord = metaplex.nfts().pdas().metadataDelegateRecord({
      mint: collection.address,
      type: 'CollectionV1',
      updateAuthority: payer.publicKey,
      delegate: authorityPda,
    });
    await amman.addr.addLabel('Metadata Delegate Record', collectionDelegateRecord);

    const accounts: MintV2InstructionAccounts = {
      candyMachine: candyMachine,
      authorityPda,
      mintAuthority: candyMachineObject.mintAuthority,
      payer: payer.publicKey,
      nftOwner: minter.publicKey,
      nftMint: mint.publicKey,
      nftMintAuthority: payer.publicKey,
      nftMetadata,
      nftMasterEdition,
      token: nftTokenAccount,
      collectionDelegateRecord,
      collectionMint,
      collectionUpdateAuthority: collection.updateAuthorityAddress,
      collectionMetadata,
      collectionMasterEdition,
      tokenMetadataProgram: METAPLEX_PROGRAM_ID,
      splTokenProgram: TOKEN_PROGRAM_ID,
      splAtaProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      recentSlothashes: SYSVAR_SLOT_HASHES_PUBKEY,
      sysvarInstructions: SYSVAR_INSTRUCTIONS_PUBKEY,
    };

    if (candyMachineObject.version == AccountVersion.V2) {
      accounts.tokenRecord = metaplex
        .nfts()
        .pdas()
        .tokenRecord({ mint: mint.publicKey, token: nftTokenAccount });
    }

    const ixs: TransactionInstruction[] = [];
    // candy machine mint instruction
    const mintIx = createMintV2Instruction(accounts);

    // this test always initializes the mint, we we need to set the
    // account to be writable and a signer to avoid warnings
    for (let i = 0; i < mintIx.keys.length; i++) {
      if (mintIx.keys[i].pubkey.toBase58() === mint.publicKey.toBase58()) {
        mintIx.keys[i].isSigner = true;
        mintIx.keys[i].isWritable = true;
      }
    }

    const data = Buffer.from(
      Uint8Array.of(0, ...new BN(400000).toArray('le', 4), ...new BN(0).toArray('le', 4)),
    );

    const additionalComputeIx: TransactionInstruction = new TransactionInstruction({
      keys: [],
      programId: ComputeBudgetProgram.programId,
      data,
    });

    ixs.push(additionalComputeIx);
    ixs.push(mintIx);
    const tx = new Transaction().add(...ixs);

    return { tx: handler.sendAndConfirmTransaction(tx, [payer, mint], 'tx: Candy Machine Mint') };
  }
}
