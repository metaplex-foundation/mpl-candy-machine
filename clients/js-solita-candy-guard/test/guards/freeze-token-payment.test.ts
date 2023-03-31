import test from 'tape';
import { amman, InitTransactions, killStuckProcess, newCandyGuardData, sleep } from '../setup';
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createMint,
  getAccount,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import { assertIsNotNull, METAPLEX_PROGRAM_ID } from '../utils';
import {
  createRouteInstruction,
  GuardType,
  PROGRAM_ID,
  RouteInstructionAccounts,
  RouteInstructionArgs,
} from '../../src';
import {
  FreezeInstruction,
  freezeInstructionBeet,
} from '../../src/generated/types/FreezeInstruction';
import { i64 } from '@metaplex-foundation/beet';
import { PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import { keypairIdentity, Metaplex } from '@metaplex-foundation/js';

const API = new InitTransactions();

killStuckProcess();

test('Token Payment', async (t) => {
  // creates a token mint to act as a payment token
  const {
    fstTxHandler: authorityHandler,
    authorityPair: authority,
    connection: authorityConnection,
  } = await API.authority();

  const tokenMint = await createMint(authorityConnection, authority, authority.publicKey, null, 0);

  const destination = await getOrCreateAssociatedTokenAccount(
    authorityConnection,
    authority,
    tokenMint,
    authority.publicKey,
  );

  const data = newCandyGuardData();
  data.default.freezeTokenPayment = {
    amount: 5,
    mint: tokenMint,
    destinationAta: destination.address,
  };

  const { candyGuard, candyMachine } = await API.deploy(
    t,
    data,
    authority,
    authorityHandler,
    authorityConnection,
  );

  const [freezeEscrow] = await PublicKey.findProgramAddress(
    [
      Buffer.from('freeze_escrow'),
      destination.address.toBuffer(),
      candyGuard.toBuffer(),
      candyMachine.toBuffer(),
    ],
    PROGRAM_ID,
  );
  amman.addr.addLabel('Freeze Escrow', freezeEscrow);

  const [freezeAta] = await PublicKey.findProgramAddress(
    [freezeEscrow.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), tokenMint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );
  amman.addr.addLabel('Freeze ATA', freezeAta);

  // route instruction to enable freeze

  const freeze_accounts: RouteInstructionAccounts = {
    candyGuard: candyGuard,
    candyMachine: candyMachine,
    payer: authority.publicKey,
  };

  const freeze_buffer = Buffer.alloc(freezeInstructionBeet.byteSize + i64.byteSize);
  freezeInstructionBeet.write(freeze_buffer, 0, FreezeInstruction.Initialize);
  i64.write(freeze_buffer, freezeInstructionBeet.byteSize, 24 * 60 * 60);

  const freeze_args: RouteInstructionArgs = {
    args: {
      guard: GuardType.FreezeTokenPayment,
      data: freeze_buffer,
    },
    label: null,
  };

  const freezeRouteIx = createRouteInstruction(freeze_accounts, freeze_args);
  freezeRouteIx.keys.push(
    ...[
      {
        pubkey: freezeEscrow,
        isSigner: false,
        isWritable: true,
      },
      {
        pubkey: authority.publicKey,
        isSigner: true,
        isWritable: false,
      },
      {
        pubkey: SystemProgram.programId,
        isSigner: false,
        isWritable: false,
      },
      {
        pubkey: freezeAta,
        isSigner: false,
        isWritable: true,
      },
      {
        pubkey: tokenMint,
        isSigner: false,
        isWritable: false,
      },
      {
        pubkey: TOKEN_PROGRAM_ID,
        isSigner: false,
        isWritable: false,
      },
      {
        pubkey: ASSOCIATED_TOKEN_PROGRAM_ID,
        isSigner: false,
        isWritable: false,
      },
      {
        pubkey: destination.address,
        isSigner: false,
        isWritable: false,
      },
    ],
  );

  const freezeTx = new Transaction().add(freezeRouteIx);

  const freezeHandler = authorityHandler.sendAndConfirmTransaction(
    freezeTx,
    [authority],
    'tx: Route (Initialize)',
  );

  await freezeHandler.assertSuccess(t);

  // mint (as a minter)

  const {
    fstTxHandler: minterHandler,
    minterPair: minter,
    connection: minterConnection,
  } = await API.minter();

  let minterATA = await getOrCreateAssociatedTokenAccount(
    minterConnection,
    minter,
    tokenMint,
    minter.publicKey,
  );

  await mintTo(
    authorityConnection,
    authority,
    tokenMint,
    minterATA.address,
    authority,
    // airdrop 10 tokens
    10,
  );

  // refresh the ATA account
  minterATA = await getOrCreateAssociatedTokenAccount(
    minterConnection,
    minter,
    tokenMint,
    minter.publicKey,
  );

  const [, mintForMinter] = await amman.genLabeledKeypair('Mint Account (minter)');
  const metaplex = Metaplex.make(minterConnection).use(keypairIdentity(minter));
  const nftAta = metaplex
    .tokens()
    .pdas()
    .associatedTokenAccount({ mint: mintForMinter.publicKey, owner: minter.publicKey });

  const { tx: minterMintTx } = await API.mint(
    t,
    candyGuard,
    candyMachine,
    minter,
    mintForMinter,
    minterHandler,
    minterConnection,
    [
      {
        pubkey: freezeEscrow,
        isSigner: false,
        isWritable: true,
      },
      {
        pubkey: nftAta,
        isSigner: false,
        isWritable: true,
      },
      {
        pubkey: minterATA.address,
        isSigner: false,
        isWritable: true,
      },
      {
        pubkey: freezeAta,
        isSigner: false,
        isWritable: true,
      },
    ],
  );
  await minterMintTx.assertSuccess(t);

  const updatedMinterATA = await getOrCreateAssociatedTokenAccount(
    minterConnection,
    minter,
    tokenMint,
    minter.publicKey,
  );

  t.true(updatedMinterATA.amount < minterATA.amount, 'amount after mint must be lower');

  const nftAtaAccount = await getAccount(minterConnection, nftAta);
  t.true(nftAtaAccount.isFrozen);

  // thaw

  const thaw_accounts: RouteInstructionAccounts = {
    candyGuard: candyGuard,
    candyMachine: candyMachine,
    payer: minter.publicKey,
  };

  const thaw_buffer = Buffer.alloc(freezeInstructionBeet.byteSize);
  freezeInstructionBeet.write(thaw_buffer, 0, FreezeInstruction.Thaw);

  const thaw_args: RouteInstructionArgs = {
    args: {
      guard: GuardType.FreezeTokenPayment,
      data: thaw_buffer,
    },
    label: null,
  };

  const thawRouteIx = createRouteInstruction(thaw_accounts, thaw_args);
  thawRouteIx.keys.push(
    ...[
      {
        pubkey: freezeEscrow,
        isSigner: false,
        isWritable: true,
      },
      {
        pubkey: mintForMinter.publicKey,
        isSigner: false,
        isWritable: false,
      },
      {
        pubkey: minter.publicKey,
        isSigner: false,
        isWritable: false,
      },
      {
        pubkey: nftAta,
        isSigner: false,
        isWritable: true,
      },
      {
        pubkey: metaplex.nfts().pdas().masterEdition({ mint: mintForMinter.publicKey }),
        isSigner: false,
        isWritable: false,
      },
      {
        pubkey: TOKEN_PROGRAM_ID,
        isSigner: false,
        isWritable: false,
      },
      {
        pubkey: METAPLEX_PROGRAM_ID,
        isSigner: false,
        isWritable: false,
      },
    ],
  );

  const thawTx = new Transaction().add(thawRouteIx);

  const thawHandler = minterHandler.sendAndConfirmTransaction(thawTx, [minter], 'tx: Route (Thaw)');

  await thawHandler.assertError(t, /Thaw is not enabled/i);
});

test('Token Payment (thaw)', async (t) => {
  // creates a token mint to act as a payment token
  const {
    fstTxHandler: authorityHandler,
    authorityPair: authority,
    connection: authorityConnection,
  } = await API.authority();

  const tokenMint = await createMint(authorityConnection, authority, authority.publicKey, null, 0);

  const destination = await getOrCreateAssociatedTokenAccount(
    authorityConnection,
    authority,
    tokenMint,
    authority.publicKey,
  );

  const data = newCandyGuardData();
  data.default.freezeTokenPayment = {
    amount: 5,
    mint: tokenMint,
    destinationAta: destination.address,
  };

  const { candyGuard, candyMachine } = await API.deploy(
    t,
    data,
    authority,
    authorityHandler,
    authorityConnection,
  );

  const [freezeEscrow] = await PublicKey.findProgramAddress(
    [
      Buffer.from('freeze_escrow'),
      destination.address.toBuffer(),
      candyGuard.toBuffer(),
      candyMachine.toBuffer(),
    ],
    PROGRAM_ID,
  );
  amman.addr.addLabel('Freeze Escrow', freezeEscrow);

  const [freezeAta] = await PublicKey.findProgramAddress(
    [freezeEscrow.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), tokenMint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );
  amman.addr.addLabel('Freeze ATA', freezeAta);

  // route instruction to enable freeze

  const freeze_accounts: RouteInstructionAccounts = {
    candyGuard: candyGuard,
    candyMachine: candyMachine,
    payer: authority.publicKey,
  };

  const freeze_buffer = Buffer.alloc(freezeInstructionBeet.byteSize + i64.byteSize);
  freezeInstructionBeet.write(freeze_buffer, 0, FreezeInstruction.Initialize);
  i64.write(freeze_buffer, freezeInstructionBeet.byteSize, 1); // 1 second

  const freeze_args: RouteInstructionArgs = {
    args: {
      guard: GuardType.FreezeTokenPayment,
      data: freeze_buffer,
    },
    label: null,
  };

  const freezeRouteIx = createRouteInstruction(freeze_accounts, freeze_args);
  freezeRouteIx.keys.push(
    ...[
      {
        pubkey: freezeEscrow,
        isSigner: false,
        isWritable: true,
      },
      {
        pubkey: authority.publicKey,
        isSigner: true,
        isWritable: false,
      },
      {
        pubkey: SystemProgram.programId,
        isSigner: false,
        isWritable: false,
      },
      {
        pubkey: freezeAta,
        isSigner: false,
        isWritable: true,
      },
      {
        pubkey: tokenMint,
        isSigner: false,
        isWritable: false,
      },
      {
        pubkey: TOKEN_PROGRAM_ID,
        isSigner: false,
        isWritable: false,
      },
      {
        pubkey: ASSOCIATED_TOKEN_PROGRAM_ID,
        isSigner: false,
        isWritable: false,
      },
      {
        pubkey: destination.address,
        isSigner: false,
        isWritable: false,
      },
    ],
  );

  const freezeTx = new Transaction().add(freezeRouteIx);

  const freezeHandler = authorityHandler.sendAndConfirmTransaction(
    freezeTx,
    [authority],
    'tx: Route (Initialize)',
  );

  await freezeHandler.assertSuccess(t);

  // mint (as a minter)

  const {
    fstTxHandler: minterHandler,
    minterPair: minter,
    connection: minterConnection,
  } = await API.minter();

  let minterATA = await getOrCreateAssociatedTokenAccount(
    minterConnection,
    minter,
    tokenMint,
    minter.publicKey,
  );

  await mintTo(
    authorityConnection,
    authority,
    tokenMint,
    minterATA.address,
    authority,
    // airdrop 10 tokens
    10,
  );

  // refresh the ATA account
  minterATA = await getOrCreateAssociatedTokenAccount(
    minterConnection,
    minter,
    tokenMint,
    minter.publicKey,
  );

  const [, mintForMinter] = await amman.genLabeledKeypair('Mint Account (minter)');
  const metaplex = Metaplex.make(minterConnection).use(keypairIdentity(minter));
  const nftAta = metaplex
    .tokens()
    .pdas()
    .associatedTokenAccount({ mint: mintForMinter.publicKey, owner: minter.publicKey });

  const { tx: minterMintTx } = await API.mint(
    t,
    candyGuard,
    candyMachine,
    minter,
    mintForMinter,
    minterHandler,
    minterConnection,
    [
      {
        pubkey: freezeEscrow,
        isSigner: false,
        isWritable: true,
      },
      {
        pubkey: nftAta,
        isSigner: false,
        isWritable: true,
      },
      {
        pubkey: minterATA.address,
        isSigner: false,
        isWritable: true,
      },
      {
        pubkey: freezeAta,
        isSigner: false,
        isWritable: true,
      },
    ],
  );
  await minterMintTx.assertSuccess(t);

  const updatedMinterATA = await getOrCreateAssociatedTokenAccount(
    minterConnection,
    minter,
    tokenMint,
    minter.publicKey,
  );

  t.true(updatedMinterATA.amount < minterATA.amount, 'amount after mint must be lower');

  let nftAtaAccount = await getAccount(minterConnection, nftAta);
  t.true(nftAtaAccount.isFrozen);

  // thaw

  await sleep(1000); // make sure thaw is enabled

  const thaw_accounts: RouteInstructionAccounts = {
    candyGuard: candyGuard,
    candyMachine: candyMachine,
    payer: minter.publicKey,
  };

  const thaw_buffer = Buffer.alloc(freezeInstructionBeet.byteSize);
  freezeInstructionBeet.write(thaw_buffer, 0, FreezeInstruction.Thaw);

  const thaw_args: RouteInstructionArgs = {
    args: {
      guard: GuardType.FreezeTokenPayment,
      data: thaw_buffer,
    },
    label: null,
  };

  const thawRouteIx = createRouteInstruction(thaw_accounts, thaw_args);
  thawRouteIx.keys.push(
    ...[
      {
        pubkey: freezeEscrow,
        isSigner: false,
        isWritable: true,
      },
      {
        pubkey: mintForMinter.publicKey,
        isSigner: false,
        isWritable: false,
      },
      {
        pubkey: minter.publicKey,
        isSigner: false,
        isWritable: false,
      },
      {
        pubkey: nftAta,
        isSigner: false,
        isWritable: true,
      },
      {
        pubkey: metaplex.nfts().pdas().masterEdition({ mint: mintForMinter.publicKey }),
        isSigner: false,
        isWritable: false,
      },
      {
        pubkey: TOKEN_PROGRAM_ID,
        isSigner: false,
        isWritable: false,
      },
      {
        pubkey: METAPLEX_PROGRAM_ID,
        isSigner: false,
        isWritable: false,
      },
      {
        pubkey: destination.address,
        isSigner: false,
        isWritable: false,
      },
    ],
  );

  const beforePayer = await minterConnection.getAccountInfo(minter.publicKey);
  assertIsNotNull(t, beforePayer);

  const thawTx = new Transaction().add(thawRouteIx);

  const thawHandler = minterHandler.sendAndConfirmTransaction(thawTx, [minter], 'tx: Route (Thaw)');

  await thawHandler.assertSuccess(t);

  const afterPayer = await minterConnection.getAccountInfo(minter.publicKey);
  assertIsNotNull(t, afterPayer);
  t.true(afterPayer.lamports > beforePayer.lamports);

  // refresh the nft ata
  nftAtaAccount = await getAccount(minterConnection, nftAta);
  t.false(nftAtaAccount.isFrozen);
});

test('Token Payment (unlock not allowed)', async (t) => {
  // creates a token mint to act as a payment token
  const {
    fstTxHandler: authorityHandler,
    authorityPair: authority,
    connection: authorityConnection,
  } = await API.authority();

  const tokenMint = await createMint(authorityConnection, authority, authority.publicKey, null, 0);

  const destination = await getOrCreateAssociatedTokenAccount(
    authorityConnection,
    authority,
    tokenMint,
    authority.publicKey,
  );

  const data = newCandyGuardData();
  data.default.freezeTokenPayment = {
    amount: 5,
    mint: tokenMint,
    destinationAta: destination.address,
  };

  const { candyGuard, candyMachine } = await API.deploy(
    t,
    data,
    authority,
    authorityHandler,
    authorityConnection,
  );

  const [freezeEscrow] = await PublicKey.findProgramAddress(
    [
      Buffer.from('freeze_escrow'),
      destination.address.toBuffer(),
      candyGuard.toBuffer(),
      candyMachine.toBuffer(),
    ],
    PROGRAM_ID,
  );
  amman.addr.addLabel('Freeze Escrow', freezeEscrow);

  const [freezeAta] = await PublicKey.findProgramAddress(
    [freezeEscrow.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), tokenMint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );
  amman.addr.addLabel('Freeze ATA', freezeAta);

  // route instruction to enable freeze

  const freeze_accounts: RouteInstructionAccounts = {
    candyGuard: candyGuard,
    candyMachine: candyMachine,
    payer: authority.publicKey,
  };

  const freeze_buffer = Buffer.alloc(freezeInstructionBeet.byteSize + i64.byteSize);
  freezeInstructionBeet.write(freeze_buffer, 0, FreezeInstruction.Initialize);
  i64.write(freeze_buffer, freezeInstructionBeet.byteSize, 1); // 1 second

  const freeze_args: RouteInstructionArgs = {
    args: {
      guard: GuardType.FreezeTokenPayment,
      data: freeze_buffer,
    },
    label: null,
  };

  const freezeRouteIx = createRouteInstruction(freeze_accounts, freeze_args);
  freezeRouteIx.keys.push(
    ...[
      {
        pubkey: freezeEscrow,
        isSigner: false,
        isWritable: true,
      },
      {
        pubkey: authority.publicKey,
        isSigner: true,
        isWritable: false,
      },
      {
        pubkey: SystemProgram.programId,
        isSigner: false,
        isWritable: false,
      },
      {
        pubkey: freezeAta,
        isSigner: false,
        isWritable: true,
      },
      {
        pubkey: tokenMint,
        isSigner: false,
        isWritable: false,
      },
      {
        pubkey: TOKEN_PROGRAM_ID,
        isSigner: false,
        isWritable: false,
      },
      {
        pubkey: ASSOCIATED_TOKEN_PROGRAM_ID,
        isSigner: false,
        isWritable: false,
      },
      {
        pubkey: destination.address,
        isSigner: false,
        isWritable: false,
      },
    ],
  );

  const freezeTx = new Transaction().add(freezeRouteIx);

  const freezeHandler = authorityHandler.sendAndConfirmTransaction(
    freezeTx,
    [authority],
    'tx: Route (Initialize)',
  );

  await freezeHandler.assertSuccess(t);

  // mint (as a minter)

  const {
    fstTxHandler: minterHandler,
    minterPair: minter,
    connection: minterConnection,
  } = await API.minter();

  let minterATA = await getOrCreateAssociatedTokenAccount(
    minterConnection,
    minter,
    tokenMint,
    minter.publicKey,
  );

  await mintTo(
    authorityConnection,
    authority,
    tokenMint,
    minterATA.address,
    authority,
    // airdrop 10 tokens
    10,
  );

  // refresh the ATA account
  minterATA = await getOrCreateAssociatedTokenAccount(
    minterConnection,
    minter,
    tokenMint,
    minter.publicKey,
  );

  const [, mintForMinter] = await amman.genLabeledKeypair('Mint Account (minter)');
  const metaplex = Metaplex.make(minterConnection).use(keypairIdentity(minter));
  const nftAta = metaplex
    .tokens()
    .pdas()
    .associatedTokenAccount({ mint: mintForMinter.publicKey, owner: minter.publicKey });

  const { tx: minterMintTx } = await API.mint(
    t,
    candyGuard,
    candyMachine,
    minter,
    mintForMinter,
    minterHandler,
    minterConnection,
    [
      {
        pubkey: freezeEscrow,
        isSigner: false,
        isWritable: true,
      },
      {
        pubkey: nftAta,
        isSigner: false,
        isWritable: true,
      },
      {
        pubkey: minterATA.address,
        isSigner: false,
        isWritable: true,
      },
      {
        pubkey: freezeAta,
        isSigner: false,
        isWritable: true,
      },
    ],
  );
  await minterMintTx.assertSuccess(t);

  const updatedMinterATA = await getOrCreateAssociatedTokenAccount(
    minterConnection,
    minter,
    tokenMint,
    minter.publicKey,
  );

  t.true(updatedMinterATA.amount < minterATA.amount, 'amount after mint must be lower');

  const nftAtaAccount = await getAccount(minterConnection, nftAta);
  t.true(nftAtaAccount.isFrozen);

  // unlock

  const thaw_accounts: RouteInstructionAccounts = {
    candyGuard: candyGuard,
    candyMachine: candyMachine,
    payer: authority.publicKey,
  };

  const unlockBuffer = Buffer.alloc(freezeInstructionBeet.byteSize);
  freezeInstructionBeet.write(unlockBuffer, 0, FreezeInstruction.UnlockFunds);

  const thaw_args: RouteInstructionArgs = {
    args: {
      guard: GuardType.FreezeTokenPayment,
      data: unlockBuffer,
    },
    label: null,
  };

  const unlockRouteIx = createRouteInstruction(thaw_accounts, thaw_args);
  unlockRouteIx.keys.push(
    ...[
      {
        pubkey: freezeEscrow,
        isSigner: false,
        isWritable: true,
      },
      {
        pubkey: authority.publicKey,
        isSigner: true,
        isWritable: false,
      },
      {
        pubkey: freezeAta,
        isSigner: false,
        isWritable: true,
      },
      {
        pubkey: destination.address,
        isSigner: false,
        isWritable: true,
      },
      {
        pubkey: TOKEN_PROGRAM_ID,
        isSigner: false,
        isWritable: false,
      },
      {
        pubkey: SystemProgram.programId,
        isSigner: false,
        isWritable: false,
      },
    ],
  );

  const unlockTx = new Transaction().add(unlockRouteIx);

  const unlockHandler = authorityHandler.sendAndConfirmTransaction(
    unlockTx,
    [authority],
    'tx: Route (Unlock Funds)',
  );

  await unlockHandler.assertError(t, /Unlock is not enabled/i);
});

test('Token Payment (unlock)', async (t) => {
  // creates a token mint to act as a payment token
  const {
    fstTxHandler: authorityHandler,
    authorityPair: authority,
    connection: authorityConnection,
  } = await API.authority();

  const tokenMint = await createMint(authorityConnection, authority, authority.publicKey, null, 0);

  const destination = await getOrCreateAssociatedTokenAccount(
    authorityConnection,
    authority,
    tokenMint,
    authority.publicKey,
  );

  const data = newCandyGuardData();
  data.default.freezeTokenPayment = {
    amount: 5,
    mint: tokenMint,
    destinationAta: destination.address,
  };

  const { candyGuard, candyMachine } = await API.deploy(
    t,
    data,
    authority,
    authorityHandler,
    authorityConnection,
  );

  const [freezeEscrow] = await PublicKey.findProgramAddress(
    [
      Buffer.from('freeze_escrow'),
      destination.address.toBuffer(),
      candyGuard.toBuffer(),
      candyMachine.toBuffer(),
    ],
    PROGRAM_ID,
  );
  amman.addr.addLabel('Freeze Escrow', freezeEscrow);

  const [freezeAta] = await PublicKey.findProgramAddress(
    [freezeEscrow.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), tokenMint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );
  amman.addr.addLabel('Freeze ATA', freezeAta);

  // route instruction to enable freeze

  const freeze_accounts: RouteInstructionAccounts = {
    candyGuard: candyGuard,
    candyMachine: candyMachine,
    payer: authority.publicKey,
  };

  const freeze_buffer = Buffer.alloc(freezeInstructionBeet.byteSize + i64.byteSize);
  freezeInstructionBeet.write(freeze_buffer, 0, FreezeInstruction.Initialize);
  i64.write(freeze_buffer, freezeInstructionBeet.byteSize, 1); // 1 second

  const freeze_args: RouteInstructionArgs = {
    args: {
      guard: GuardType.FreezeTokenPayment,
      data: freeze_buffer,
    },
    label: null,
  };

  const freezeRouteIx = createRouteInstruction(freeze_accounts, freeze_args);
  freezeRouteIx.keys.push(
    ...[
      {
        pubkey: freezeEscrow,
        isSigner: false,
        isWritable: true,
      },
      {
        pubkey: authority.publicKey,
        isSigner: true,
        isWritable: false,
      },
      {
        pubkey: SystemProgram.programId,
        isSigner: false,
        isWritable: false,
      },
      {
        pubkey: freezeAta,
        isSigner: false,
        isWritable: true,
      },
      {
        pubkey: tokenMint,
        isSigner: false,
        isWritable: false,
      },
      {
        pubkey: TOKEN_PROGRAM_ID,
        isSigner: false,
        isWritable: false,
      },
      {
        pubkey: ASSOCIATED_TOKEN_PROGRAM_ID,
        isSigner: false,
        isWritable: false,
      },
      {
        pubkey: destination.address,
        isSigner: false,
        isWritable: false,
      },
    ],
  );

  const freezeTx = new Transaction().add(freezeRouteIx);

  const freezeHandler = authorityHandler.sendAndConfirmTransaction(
    freezeTx,
    [authority],
    'tx: Route (Initialize)',
  );

  await freezeHandler.assertSuccess(t);

  // mint (as a minter)

  const {
    fstTxHandler: minterHandler,
    minterPair: minter,
    connection: minterConnection,
  } = await API.minter();

  let minterAta = await getOrCreateAssociatedTokenAccount(
    minterConnection,
    minter,
    tokenMint,
    minter.publicKey,
  );

  await mintTo(
    authorityConnection,
    authority,
    tokenMint,
    minterAta.address,
    authority,
    // airdrop 10 tokens
    10,
  );

  // refresh the ATA account
  minterAta = await getOrCreateAssociatedTokenAccount(
    minterConnection,
    minter,
    tokenMint,
    minter.publicKey,
  );

  const [, mintForMinter] = await amman.genLabeledKeypair('Mint Account (minter)');
  const metaplex = Metaplex.make(minterConnection).use(keypairIdentity(minter));
  const nftAta = metaplex
    .tokens()
    .pdas()
    .associatedTokenAccount({ mint: mintForMinter.publicKey, owner: minter.publicKey });

  const { tx: minterMintTx } = await API.mint(
    t,
    candyGuard,
    candyMachine,
    minter,
    mintForMinter,
    minterHandler,
    minterConnection,
    [
      {
        pubkey: freezeEscrow,
        isSigner: false,
        isWritable: true,
      },
      {
        pubkey: nftAta,
        isSigner: false,
        isWritable: true,
      },
      {
        pubkey: minterAta.address,
        isSigner: false,
        isWritable: true,
      },
      {
        pubkey: freezeAta,
        isSigner: false,
        isWritable: true,
      },
    ],
  );
  await minterMintTx.assertSuccess(t);

  const updatedMinterATA = await getOrCreateAssociatedTokenAccount(
    minterConnection,
    minter,
    tokenMint,
    minter.publicKey,
  );

  t.true(updatedMinterATA.amount < minterAta.amount, 'amount after mint must be lower');

  let nftAtaAccount = await getAccount(minterConnection, nftAta);
  t.true(nftAtaAccount.isFrozen);

  // thaw

  await sleep(1000); // make sure thaw is enabled

  const thawAccounts: RouteInstructionAccounts = {
    candyGuard: candyGuard,
    candyMachine: candyMachine,
    payer: minter.publicKey,
  };

  const thawBuffer = Buffer.alloc(freezeInstructionBeet.byteSize);
  freezeInstructionBeet.write(thawBuffer, 0, FreezeInstruction.Thaw);

  const thawArgs: RouteInstructionArgs = {
    args: {
      guard: GuardType.FreezeTokenPayment,
      data: thawBuffer,
    },
    label: null,
  };

  const thawRouteIx = createRouteInstruction(thawAccounts, thawArgs);
  thawRouteIx.keys.push(
    ...[
      {
        pubkey: freezeEscrow,
        isSigner: false,
        isWritable: true,
      },
      {
        pubkey: mintForMinter.publicKey,
        isSigner: false,
        isWritable: false,
      },
      {
        pubkey: minter.publicKey,
        isSigner: false,
        isWritable: false,
      },
      {
        pubkey: nftAta,
        isSigner: false,
        isWritable: true,
      },
      {
        pubkey: metaplex.nfts().pdas().masterEdition({ mint: mintForMinter.publicKey }),
        isSigner: false,
        isWritable: false,
      },
      {
        pubkey: TOKEN_PROGRAM_ID,
        isSigner: false,
        isWritable: false,
      },
      {
        pubkey: METAPLEX_PROGRAM_ID,
        isSigner: false,
        isWritable: false,
      },
    ],
  );

  const thawTx = new Transaction().add(thawRouteIx);

  const thawHandler = minterHandler.sendAndConfirmTransaction(thawTx, [minter], 'tx: Route (Thaw)');

  await thawHandler.assertSuccess(t);

  // refresh the nft ata
  nftAtaAccount = await getAccount(minterConnection, nftAta);
  t.false(nftAtaAccount.isFrozen);

  // unlock

  const unlockAccounts: RouteInstructionAccounts = {
    candyGuard: candyGuard,
    candyMachine: candyMachine,
    payer: authority.publicKey,
  };

  const unlockBuffer = Buffer.alloc(freezeInstructionBeet.byteSize);
  freezeInstructionBeet.write(unlockBuffer, 0, FreezeInstruction.UnlockFunds);

  const unlockArgs: RouteInstructionArgs = {
    args: {
      guard: GuardType.FreezeTokenPayment,
      data: unlockBuffer,
    },
    label: null,
  };

  const unlockRouteIx = createRouteInstruction(unlockAccounts, unlockArgs);
  unlockRouteIx.keys.push(
    ...[
      {
        pubkey: freezeEscrow,
        isSigner: false,
        isWritable: true,
      },
      {
        pubkey: authority.publicKey,
        isSigner: true,
        isWritable: false,
      },
      {
        pubkey: freezeAta,
        isSigner: false,
        isWritable: true,
      },
      {
        pubkey: destination.address,
        isSigner: false,
        isWritable: true,
      },
      {
        pubkey: TOKEN_PROGRAM_ID,
        isSigner: false,
        isWritable: false,
      },
      {
        pubkey: SystemProgram.programId,
        isSigner: false,
        isWritable: false,
      },
    ],
  );

  const unlockTx = new Transaction().add(unlockRouteIx);

  const unlockHandler = authorityHandler.sendAndConfirmTransaction(
    unlockTx,
    [authority],
    'tx: Route (Unlock Funds)',
  );

  await unlockHandler.assertSuccess(t);

  const updatedDestination = await getOrCreateAssociatedTokenAccount(
    authorityConnection,
    authority,
    tokenMint,
    authority.publicKey,
  );

  t.true(updatedDestination.amount > destination.amount, 'amount after unlock must be higher');
});
