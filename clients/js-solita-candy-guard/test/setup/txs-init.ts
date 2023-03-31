import {
  ConfirmedTransactionAssertablePromise,
  GenLabeledKeypair,
  LoadOrGenKeypair,
  LOCALHOST,
  PayerTransactionHandler,
} from '@metaplex-foundation/amman-client';
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  SYSVAR_SLOT_HASHES_PUBKEY,
  Transaction,
  TransactionInstruction,
  SYSVAR_INSTRUCTIONS_PUBKEY,
  AccountMeta,
  StakeProgram,
  Authorized,
  ComputeBudgetProgram,
} from '@solana/web3.js';
import { Test } from 'tape';
import { amman } from '.';
import {
  CANDY_MACHINE_PROGRAM,
  CandyMachineHelper,
  getCandyGuardPDA,
  METAPLEX_PROGRAM_ID,
} from '../utils';
import {
  CandyGuardData,
  createInitializeInstruction,
  createMintInstruction,
  createMintV2Instruction,
  createSetAuthorityInstruction,
  createUnwrapInstruction,
  createUpdateInstruction,
  createWithdrawInstruction,
  createWrapInstruction,
  InitializeInstructionAccounts,
  InitializeInstructionArgs,
  MintInstructionAccounts,
  MintInstructionArgs,
  MintV2InstructionAccounts,
  MintV2InstructionArgs,
  PROGRAM_ID,
  SetAuthorityInstructionAccounts,
  SetAuthorityInstructionArgs,
  UnwrapInstructionAccounts,
  UpdateInstructionAccounts,
  UpdateInstructionArgs,
  WithdrawInstructionAccounts,
  WrapInstructionAccounts,
} from '../../src/generated';
import { AccountVersion, CandyMachine } from '@metaplex-foundation/mpl-candy-machine-core';
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
import { serialize } from '../../src';
import { BN } from 'bn.js';

export class InitTransactions {
  readonly HELPER: CandyMachineHelper;
  readonly getKeypair: LoadOrGenKeypair | GenLabeledKeypair;
  constructor(readonly resuseKeypairs = false) {
    this.getKeypair = resuseKeypairs ? amman.loadOrGenKeypair : amman.genLabeledKeypair;
    this.HELPER = new CandyMachineHelper();
  }

  // wallets

  async payer() {
    const [payer, payerPair] = await this.getKeypair('Payer');

    const connection = new Connection(LOCALHOST, 'confirmed');
    await amman.airdrop(connection, payer, 2);

    const transactionHandler = amman.payerTransactionHandler(connection, payerPair);

    return {
      fstTxHandler: transactionHandler,
      connection,
      payer,
      payerPair,
    };
  }

  async authority() {
    const [authority, authorityPair] = await this.getKeypair('Authority');

    const connection = new Connection(LOCALHOST, 'confirmed');
    await amman.airdrop(connection, authority, 2);

    const transactionHandler = amman.payerTransactionHandler(connection, authorityPair);

    return {
      fstTxHandler: transactionHandler,
      connection,
      authority,
      authorityPair,
    };
  }

  async minter() {
    const [minter, minterPair] = await this.getKeypair('Minter');

    const connection = new Connection(LOCALHOST, 'confirmed');
    await amman.airdrop(connection, minter, 2);

    const transactionHandler = amman.payerTransactionHandler(connection, minterPair);

    return {
      fstTxHandler: transactionHandler,
      connection,
      minter,
      minterPair,
    };
  }

  // instructions

  async initialize(
    t: Test,
    data: CandyGuardData,
    payer: Keypair,
    handler: PayerTransactionHandler,
  ): Promise<{ tx: ConfirmedTransactionAssertablePromise; candyGuard: PublicKey }> {
    const [, keypair] = await this.getKeypair('Candy Guard Base Pubkey');
    const pda = await getCandyGuardPDA(PROGRAM_ID, keypair);
    amman.addr.addLabel('Candy Guard Account', pda);

    const accounts: InitializeInstructionAccounts = {
      candyGuard: pda,
      base: keypair.publicKey,
      authority: payer.publicKey,
      payer: payer.publicKey,
      systemProgram: SystemProgram.programId,
    };

    const args: InitializeInstructionArgs = {
      data: serialize(data),
    };

    const tx = new Transaction().add(createInitializeInstruction(accounts, args));

    return {
      tx: handler.sendAndConfirmTransaction(tx, [payer, keypair], 'tx: Initialize'),
      candyGuard: pda,
    };
  }

  async wrap(
    t: Test,
    candyGuard: PublicKey,
    candyMachine: PublicKey,
    payer: Keypair,
    handler: PayerTransactionHandler,
  ): Promise<{ tx: ConfirmedTransactionAssertablePromise }> {
    const accounts: WrapInstructionAccounts = {
      candyGuard,
      authority: payer.publicKey,
      candyMachine: candyMachine,
      candyMachineProgram: CANDY_MACHINE_PROGRAM,
      candyMachineAuthority: payer.publicKey,
    };

    const tx = new Transaction().add(createWrapInstruction(accounts));

    return {
      tx: handler.sendAndConfirmTransaction(tx, [payer], 'tx: Wrap'),
    };
  }

  async unwrap(
    t: Test,
    candyGuard: PublicKey,
    candyMachine: PublicKey,
    payer: Keypair,
    handler: PayerTransactionHandler,
  ): Promise<{ tx: ConfirmedTransactionAssertablePromise }> {
    const accounts: UnwrapInstructionAccounts = {
      candyGuard,
      authority: payer.publicKey,
      candyMachine: candyMachine,
      candyMachineProgram: CANDY_MACHINE_PROGRAM,
      candyMachineAuthority: payer.publicKey,
    };

    const tx = new Transaction().add(createUnwrapInstruction(accounts));

    return {
      tx: handler.sendAndConfirmTransaction(tx, [payer], 'tx: Unwrap'),
    };
  }

  async update(
    t: Test,
    candyGuard: PublicKey,
    data: CandyGuardData,
    payer: Keypair,
    handler: PayerTransactionHandler,
  ): Promise<{ tx: ConfirmedTransactionAssertablePromise }> {
    const accounts: UpdateInstructionAccounts = {
      candyGuard,
      authority: payer.publicKey,
      payer: payer.publicKey,
      systemProgram: SystemProgram.programId,
    };

    const args: UpdateInstructionArgs = {
      data: serialize(data),
    };

    const tx = new Transaction().add(createUpdateInstruction(accounts, args));

    return {
      tx: handler.sendAndConfirmTransaction(tx, [payer], 'tx: Update'),
    };
  }

  async setAuthority(
    t: Test,
    candyGuard: PublicKey,
    authority: Keypair,
    newAuthority: PublicKey,
    handler: PayerTransactionHandler,
  ): Promise<{ tx: ConfirmedTransactionAssertablePromise }> {
    const accounts: SetAuthorityInstructionAccounts = {
      candyGuard,
      authority: authority.publicKey,
    };

    const args: SetAuthorityInstructionArgs = {
      newAuthority,
    };

    const tx = new Transaction().add(createSetAuthorityInstruction(accounts, args));

    return {
      tx: handler.sendAndConfirmTransaction(tx, [authority], 'tx: SetAuthority'),
    };
  }

  async mint(
    t: Test,
    candyGuard: PublicKey,
    candyMachine: PublicKey,
    payer: Keypair,
    mint: Keypair,
    handler: PayerTransactionHandler,
    connection: Connection,
    remainingAccounts?: AccountMeta[] | null,
    mintArgs?: Uint8Array | null,
    label?: string | null,
  ): Promise<{ tx: ConfirmedTransactionAssertablePromise }> {
    const { instructions } = await this.mintInstruction(
      candyGuard,
      candyMachine,
      payer,
      mint,
      connection,
      remainingAccounts,
      mintArgs,
      label,
    );

    const tx = new Transaction().add(...instructions);

    return { tx: handler.sendAndConfirmTransaction(tx, [payer, mint], 'tx: Candy Guard Mint') };
  }

  async mintV2(
    candyGuard: PublicKey,
    candyMachine: PublicKey,
    minter: Keypair,
    payer: Keypair,
    mint: Keypair,
    handler: PayerTransactionHandler,
    connection: Connection,
    remainingAccounts?: AccountMeta[] | null,
    mintArgs?: Uint8Array | null,
    label?: string | null,
  ): Promise<{ tx: ConfirmedTransactionAssertablePromise }> {
    const { instructions } = await this.mintV2Instruction(
      candyGuard,
      candyMachine,
      minter,
      payer,
      mint,
      connection,
      remainingAccounts,
      mintArgs,
      label,
    );

    const tx = new Transaction().add(...instructions);

    return {
      tx: handler.sendAndConfirmTransaction(tx, [payer, mint, minter], 'tx: Candy Guard MintV2'),
    };
  }

  async withdraw(
    t: Test,
    candyGuard: PublicKey,
    payer: Keypair,
    handler: PayerTransactionHandler,
  ): Promise<{ tx: ConfirmedTransactionAssertablePromise }> {
    const accounts: WithdrawInstructionAccounts = {
      candyGuard: candyGuard,
      authority: payer.publicKey,
    };

    const tx = new Transaction().add(createWithdrawInstruction(accounts));

    return {
      tx: handler.sendAndConfirmTransaction(tx, [payer], 'tx: Withdraw'),
    };
  }

  async mintWithInvalidProgram(
    t: Test,
    candyGuard: PublicKey,
    candyMachine: PublicKey,
    payer: Keypair,
    mint: Keypair,
    handler: PayerTransactionHandler,
    connection: Connection,
    remainingAccounts?: AccountMeta[] | null,
    mintArgs?: Uint8Array | null,
    label?: string | null,
  ): Promise<{ tx: ConfirmedTransactionAssertablePromise }> {
    const { instructions } = await this.mintInstruction(
      candyGuard,
      candyMachine,
      payer,
      mint,
      connection,
      remainingAccounts,
      mintArgs,
      label,
    );

    instructions.push(
      StakeProgram.initialize({
        stakePubkey: payer.publicKey,
        authorized: new Authorized(payer.publicKey, payer.publicKey),
      }),
    );

    const tx = new Transaction().add(...instructions);

    return {
      tx: handler.sendAndConfirmTransaction(
        tx,
        [payer, mint],
        'tx: Candy Guard Mint (invalid program)',
      ),
    };
  }

  async mintWithInvalidInstruction(
    t: Test,
    candyGuard: PublicKey,
    candyMachine: PublicKey,
    payer: Keypair,
    mint: Keypair,
    handler: PayerTransactionHandler,
    connection: Connection,
    remainingAccounts?: AccountMeta[] | null,
    mintArgs?: Uint8Array | null,
    label?: string | null,
  ): Promise<{ tx: ConfirmedTransactionAssertablePromise }> {
    const { instructions } = await this.mintInstruction(
      candyGuard,
      candyMachine,
      payer,
      mint,
      connection,
      remainingAccounts,
      mintArgs,
      label,
    );

    const [, extendedMint] = await amman.genLabeledKeypair('Extended Mint Account');

    instructions.push(
      SystemProgram.createAccount({
        fromPubkey: payer.publicKey,
        newAccountPubkey: extendedMint.publicKey,
        lamports: await connection.getMinimumBalanceForRentExemption(MintLayout.span),
        space: MintLayout.span,
        programId: TOKEN_PROGRAM_ID,
      }),
    );

    const tx = new Transaction().add(...instructions);

    return {
      tx: handler.sendAndConfirmTransaction(
        tx,
        [payer, mint, extendedMint],
        'tx: Candy Guard Mint (invalid instruction)',
      ),
    };
  }

  async deploy(
    t: Test,
    guards: CandyGuardData,
    payer: Keypair,
    handler: PayerTransactionHandler,
    connection: Connection,
  ): Promise<{ candyGuard: PublicKey; candyMachine: PublicKey }> {
    // candy machine

    const [, candyMachine] = await amman.genLabeledKeypair('Candy Machine Account');

    const items = 10;

    const candyMachineData = {
      itemsAvailable: items,
      symbol: 'CORE',
      sellerFeeBasisPoints: 500,
      maxSupply: 0,
      isMutable: true,
      retainAuthority: true,
      creators: [
        {
          address: payer.publicKey,
          verified: false,
          percentageShare: 100,
        },
      ],
      configLineSettings: {
        prefixName: 'TEST ',
        nameLength: 10,
        prefixUri: 'https://arweave.net/',
        uriLength: 50,
        isSequential: false,
      },
      hiddenSettings: null,
    };

    const { tx: createTxCM } = await this.HELPER.initialize(
      t,
      payer,
      candyMachine,
      candyMachineData,
      handler,
      connection,
    );
    // executes the transaction
    await createTxCM.assertSuccess(t);

    const lines: { name: string; uri: string }[] = [];

    for (let i = 0; i < items; i++) {
      const line = {
        name: `NFT #${i + 1}`,
        uri: 'uJSdJIsz_tYTcjUEWdeVSj0aR90K-hjDauATWZSi-tQ',
      };

      lines.push(line);
    }
    const { txs } = await this.HELPER.addConfigLines(t, candyMachine.publicKey, payer, lines);
    // confirms that all lines have been written
    for (const tx of txs) {
      await handler.sendAndConfirmTransaction(tx, [payer], 'tx: AddConfigLines').assertNone();
    }

    // candy guard

    const { tx: initializeTxCG, candyGuard: address } = await this.initialize(
      t,
      guards,
      payer,
      handler,
    );
    // executes the transaction
    await initializeTxCG.assertSuccess(t);

    const { tx: wrapTx } = await this.wrap(t, address, candyMachine.publicKey, payer, handler);

    await wrapTx.assertSuccess(t, [/SetMintAuthority/i]);

    return { candyGuard: address, candyMachine: candyMachine.publicKey };
  }

  async deployV2(
    t: Test,
    guards: CandyGuardData,
    payer: Keypair,
    handler: PayerTransactionHandler,
    connection: Connection,
    tokenStandard: TokenStandard = TokenStandard.NonFungible,
  ): Promise<{ candyGuard: PublicKey; candyMachine: PublicKey }> {
    // candy machine

    const [, candyMachine] = await amman.genLabeledKeypair('Candy Machine Account');

    const items = 10;

    const candyMachineData = {
      itemsAvailable: items,
      symbol: 'CORE',
      sellerFeeBasisPoints: 500,
      maxSupply: 0,
      isMutable: true,
      retainAuthority: true,
      creators: [
        {
          address: payer.publicKey,
          verified: false,
          percentageShare: 100,
        },
      ],
      configLineSettings: {
        prefixName: 'TEST ',
        nameLength: 10,
        prefixUri: 'https://arweave.net/',
        uriLength: 50,
        isSequential: false,
      },
      hiddenSettings: null,
    };

    const { tx: createTxCM } = await this.HELPER.initializeV2(
      t,
      payer,
      candyMachine,
      candyMachineData,
      tokenStandard,
      handler,
      connection,
    );
    // executes the transaction
    await createTxCM.assertSuccess(t);

    const lines: { name: string; uri: string }[] = [];

    for (let i = 0; i < items; i++) {
      const line = {
        name: `NFT #${i + 1}`,
        uri: 'uJSdJIsz_tYTcjUEWdeVSj0aR90K-hjDauATWZSi-tQ',
      };

      lines.push(line);
    }
    const { txs } = await this.HELPER.addConfigLines(t, candyMachine.publicKey, payer, lines);
    // confirms that all lines have been written
    for (const tx of txs) {
      await handler.sendAndConfirmTransaction(tx, [payer], 'tx: AddConfigLines').assertNone();
    }

    // candy guard

    const { tx: initializeTxCG, candyGuard: address } = await this.initialize(
      t,
      guards,
      payer,
      handler,
    );
    // executes the transaction
    await initializeTxCG.assertSuccess(t);

    const { tx: wrapTx } = await this.wrap(t, address, candyMachine.publicKey, payer, handler);

    await wrapTx.assertSuccess(t, [/SetMintAuthority/i]);

    return { candyGuard: address, candyMachine: candyMachine.publicKey };
  }

  async mintInstruction(
    candyGuard: PublicKey,
    candyMachine: PublicKey,
    payer: Keypair,
    mint: Keypair,
    connection: Connection,
    remainingAccounts?: AccountMeta[] | null,
    mintArgs?: Uint8Array | null,
    label?: string | null,
  ): Promise<{ instructions: TransactionInstruction[] }> {
    // candy machine object
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
      candyGuard,
      candyMachineProgram: CANDY_MACHINE_PROGRAM,
      candyMachine,
      payer: payer.publicKey,
      candyMachineAuthorityPda: authorityPda,
      nftMasterEdition: nftMasterEdition,
      nftMetadata,
      nftMint: mint.publicKey,
      nftMintAuthority: payer.publicKey,
      collectionUpdateAuthority: collection.updateAuthorityAddress,
      collectionAuthorityRecord,
      collectionMasterEdition,
      collectionMetadata,
      collectionMint,
      tokenMetadataProgram: METAPLEX_PROGRAM_ID,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
      recentSlothashes: SYSVAR_SLOT_HASHES_PUBKEY,
      instructionSysvarAccount: SYSVAR_INSTRUCTIONS_PUBKEY,
    };

    if (!mintArgs) {
      mintArgs = new Uint8Array();
    }

    const args: MintInstructionArgs = {
      mintArgs,
      label: label ?? null,
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

    const mintIx = createMintInstruction(accounts, args);
    if (remainingAccounts) {
      mintIx.keys.push(...remainingAccounts);
    }
    ixs.push(mintIx);

    return { instructions: ixs };
  }

  async mintV2Instruction(
    candyGuard: PublicKey,
    candyMachine: PublicKey,
    minter: Keypair,
    payer: Keypair,
    mint: Keypair,
    connection: Connection,
    remainingAccounts?: AccountMeta[] | null,
    mintArgs?: Uint8Array | null,
    label?: string | null,
  ): Promise<{ instructions: TransactionInstruction[] }> {
    // candy machine object
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
      mint: collectionMint,
      type: 'CollectionV1',
      updateAuthority: collection.updateAuthorityAddress,
      delegate: authorityPda,
    });
    await amman.addr.addLabel('Metadata Delegate Record', collectionDelegateRecord);

    const accounts: MintV2InstructionAccounts = {
      candyGuard,
      candyMachineProgram: CANDY_MACHINE_PROGRAM,
      candyMachine,
      payer: payer.publicKey,
      minter: minter.publicKey,
      candyMachineAuthorityPda: authorityPda,
      nftMasterEdition: nftMasterEdition,
      nftMetadata,
      nftMint: mint.publicKey,
      nftMintAuthority: payer.publicKey,
      token: nftTokenAccount,
      collectionUpdateAuthority: collection.updateAuthorityAddress,
      collectionDelegateRecord,
      collectionMasterEdition,
      collectionMetadata,
      collectionMint,
      tokenMetadataProgram: METAPLEX_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
      sysvarInstructions: SYSVAR_INSTRUCTIONS_PUBKEY,
      splTokenProgram: TOKEN_PROGRAM_ID,
      splAtaProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      recentSlothashes: SYSVAR_SLOT_HASHES_PUBKEY,
    };

    if (candyMachineObject.version == AccountVersion.V2) {
      accounts.tokenRecord = metaplex
        .nfts()
        .pdas()
        .tokenRecord({ mint: mint.publicKey, token: nftTokenAccount });
    }

    if (!mintArgs) {
      mintArgs = new Uint8Array();
    }

    const args: MintV2InstructionArgs = {
      mintArgs,
      label: label ?? null,
    };

    const ixs: TransactionInstruction[] = [];

    const mintIx = createMintV2Instruction(accounts, args);
    // this test always initializes the mint, we we need to set the
    // account to be writable and a signer to avoid warnings
    for (let i = 0; i < mintIx.keys.length; i++) {
      if (mintIx.keys[i].pubkey.toBase58() === mint.publicKey.toBase58()) {
        mintIx.keys[i].isSigner = true;
        mintIx.keys[i].isWritable = true;
      }
    }

    if (remainingAccounts) {
      mintIx.keys.push(...remainingAccounts);
    }

    const data = Buffer.from(
      Uint8Array.of(0, ...new BN(600000).toArray('le', 4), ...new BN(0).toArray('le', 4)),
    );

    const additionalComputeIx: TransactionInstruction = new TransactionInstruction({
      keys: [],
      programId: ComputeBudgetProgram.programId,
      data,
    });

    ixs.push(additionalComputeIx);
    ixs.push(mintIx);

    return { instructions: ixs };
  }
}
