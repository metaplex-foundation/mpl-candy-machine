import test from 'tape';
import { amman, InitTransactions, killStuckProcess, newCandyGuardData, sleep } from '../setup';
import { PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import { PROGRAM_ID } from '../../src';
import {
  createRouteInstruction,
  RouteInstructionAccounts,
  RouteInstructionArgs,
} from '../../src/generated/instructions/route';
import { GuardType } from '../../src/generated/types/GuardType';
import { i64 } from '@metaplex-foundation/beet';
import { getAccount, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { keypairIdentity, Metaplex } from '@metaplex-foundation/js';
import { assertIsNotNull, METAPLEX_PROGRAM_ID } from '../utils';
import {
  FreezeInstruction,
  freezeInstructionBeet,
} from '../../src/generated/types/FreezeInstruction';

const API = new InitTransactions();

killStuckProcess();

test('Freeze Sol Payment (thaw not enabled)', async (t) => {
  const { fstTxHandler: authorityHandler, authorityPair, connection } = await API.authority();

  const data = newCandyGuardData();
  data.default.freezeSolPayment = {
    lamports: 1000000000,
    destination: authorityPair.publicKey,
  };

  const { candyGuard, candyMachine } = await API.deploy(
    t,
    data,
    authorityPair,
    authorityHandler,
    connection,
  );

  const [freezeEscrow] = await PublicKey.findProgramAddress(
    [
      Buffer.from('freeze_escrow'),
      authorityPair.publicKey.toBuffer(),
      candyGuard.toBuffer(),
      candyMachine.toBuffer(),
    ],
    PROGRAM_ID,
  );
  amman.addr.addLabel('Freeze Escrow', freezeEscrow);

  const {
    fstTxHandler: minterHandler,
    minterPair,
    connection: minterConnection,
  } = await API.minter();

  const [, mintForMinter] = await amman.genLabeledKeypair('Mint Account (minter)');
  const { tx: minterMintTx } = await API.mint(
    t,
    candyGuard,
    candyMachine,
    minterPair,
    mintForMinter,
    minterHandler,
    minterConnection,
    [
      {
        pubkey: freezeEscrow,
        isSigner: false,
        isWritable: true,
      },
    ],
  );

  await minterMintTx.assertError(t, /Freeze must be initialized/i);

  // route instruction to enable freeze

  const freeze_accounts: RouteInstructionAccounts = {
    candyGuard: candyGuard,
    candyMachine: candyMachine,
    payer: authorityPair.publicKey,
  };

  const freeze_buffer = Buffer.alloc(freezeInstructionBeet.byteSize + i64.byteSize);
  freezeInstructionBeet.write(freeze_buffer, 0, FreezeInstruction.Initialize);
  i64.write(freeze_buffer, freezeInstructionBeet.byteSize, 24 * 60 * 60);

  const freeze_args: RouteInstructionArgs = {
    args: {
      guard: GuardType.FreezeSolPayment,
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
        pubkey: authorityPair.publicKey,
        isSigner: true,
        isWritable: false,
      },
      {
        pubkey: SystemProgram.programId,
        isSigner: false,
        isWritable: false,
      },
    ],
  );

  const freezeTx = new Transaction().add(freezeRouteIx);

  const freezeHandler = authorityHandler.sendAndConfirmTransaction(
    freezeTx,
    [authorityPair],
    'tx: Route (Initialize)',
  );

  await freezeHandler.assertSuccess(t);

  // minting

  const [, mintForMinter2] = await amman.genLabeledKeypair('Mint Account 2 (minter)');
  const metaplex = Metaplex.make(connection).use(keypairIdentity(minterPair));
  const nftAta = metaplex
    .tokens()
    .pdas()
    .associatedTokenAccount({ mint: mintForMinter2.publicKey, owner: minterPair.publicKey });

  const { tx: minterMintTx2 } = await API.mint(
    t,
    candyGuard,
    candyMachine,
    minterPair,
    mintForMinter2,
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
        isWritable: false,
      },
    ],
  );

  await minterMintTx2.assertSuccess(t);

  const nftAtaAccount = await getAccount(minterConnection, nftAta);
  t.true(nftAtaAccount.isFrozen);

  // thaw

  const thaw_accounts: RouteInstructionAccounts = {
    candyGuard: candyGuard,
    candyMachine: candyMachine,
    payer: minterPair.publicKey,
  };

  const thaw_buffer = Buffer.alloc(freezeInstructionBeet.byteSize);
  freezeInstructionBeet.write(thaw_buffer, 0, FreezeInstruction.Thaw);

  const thaw_args: RouteInstructionArgs = {
    args: {
      guard: GuardType.FreezeSolPayment,
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
        pubkey: mintForMinter2.publicKey,
        isSigner: false,
        isWritable: false,
      },
      {
        pubkey: minterPair.publicKey,
        isSigner: false,
        isWritable: false,
      },
      {
        pubkey: nftAta,
        isSigner: false,
        isWritable: true,
      },
      {
        pubkey: metaplex.nfts().pdas().masterEdition({ mint: mintForMinter2.publicKey }),
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

  const thawHandler = minterHandler.sendAndConfirmTransaction(
    thawTx,
    [minterPair],
    'tx: Route (Thaw)',
  );

  await thawHandler.assertError(t, /Thaw is not enabled/i);
});

test('Freeze Sol Payment (thaw enabled)', async (t) => {
  const { fstTxHandler: authorityHandler, authorityPair, connection } = await API.authority();

  const data = newCandyGuardData();
  data.default.freezeSolPayment = {
    lamports: 1000000000,
    destination: authorityPair.publicKey,
  };

  const { candyGuard, candyMachine } = await API.deploy(
    t,
    data,
    authorityPair,
    authorityHandler,
    connection,
  );

  const [freezeEscrow] = await PublicKey.findProgramAddress(
    [
      Buffer.from('freeze_escrow'),
      authorityPair.publicKey.toBuffer(),
      candyGuard.toBuffer(),
      candyMachine.toBuffer(),
    ],
    PROGRAM_ID,
  );

  // route instruction to enable freeze

  const freeze_accounts: RouteInstructionAccounts = {
    candyGuard: candyGuard,
    candyMachine: candyMachine,
    payer: authorityPair.publicKey,
  };

  const freeze_buffer = Buffer.alloc(freezeInstructionBeet.byteSize + i64.byteSize);
  freezeInstructionBeet.write(freeze_buffer, 0, FreezeInstruction.Initialize);
  i64.write(freeze_buffer, freezeInstructionBeet.byteSize, 1);

  const freeze_args: RouteInstructionArgs = {
    args: {
      guard: GuardType.FreezeSolPayment,
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
        pubkey: authorityPair.publicKey,
        isSigner: true,
        isWritable: false,
      },
      {
        pubkey: SystemProgram.programId,
        isSigner: false,
        isWritable: false,
      },
    ],
  );

  const freezeTx = new Transaction().add(freezeRouteIx);

  const freezeHandler = authorityHandler.sendAndConfirmTransaction(
    freezeTx,
    [authorityPair],
    'tx: Route (Initialize)',
  );

  await freezeHandler.assertSuccess(t);

  // minting

  const {
    fstTxHandler: minterHandler,
    minterPair,
    connection: minterConnection,
  } = await API.minter();

  const [, mintForMinter2] = await amman.genLabeledKeypair('Mint Account (minter)');
  const metaplex = Metaplex.make(connection).use(keypairIdentity(minterPair));
  const nftAta = metaplex
    .tokens()
    .pdas()
    .associatedTokenAccount({ mint: mintForMinter2.publicKey, owner: minterPair.publicKey });

  const { tx: minterMintTx2 } = await API.mint(
    t,
    candyGuard,
    candyMachine,
    minterPair,
    mintForMinter2,
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
        isWritable: false,
      },
    ],
  );

  await minterMintTx2.assertSuccess(t);

  let nftAtaAccount = await getAccount(minterConnection, nftAta);
  t.true(nftAtaAccount.isFrozen);

  // thaw

  await sleep(1000); // make sure that the freeze period is over

  const thaw_accounts: RouteInstructionAccounts = {
    candyGuard: candyGuard,
    candyMachine: candyMachine,
    payer: minterPair.publicKey,
  };

  const thaw_buffer = Buffer.alloc(freezeInstructionBeet.byteSize);
  freezeInstructionBeet.write(thaw_buffer, 0, FreezeInstruction.Thaw);

  const thaw_args: RouteInstructionArgs = {
    args: {
      guard: GuardType.FreezeSolPayment,
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
        pubkey: mintForMinter2.publicKey,
        isSigner: false,
        isWritable: false,
      },
      {
        pubkey: minterPair.publicKey,
        isSigner: false,
        isWritable: false,
      },
      {
        pubkey: nftAta,
        isSigner: false,
        isWritable: true,
      },
      {
        pubkey: metaplex.nfts().pdas().masterEdition({ mint: mintForMinter2.publicKey }),
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

  const beforePayer = await minterConnection.getAccountInfo(minterPair.publicKey);
  assertIsNotNull(t, beforePayer);

  const thawTx = new Transaction().add(thawRouteIx);
  const thawHandler = minterHandler.sendAndConfirmTransaction(
    thawTx,
    [minterPair],
    'tx: Route (Thaw)',
  );

  await thawHandler.assertSuccess(t);

  const afterPayer = await minterConnection.getAccountInfo(minterPair.publicKey);
  assertIsNotNull(t, afterPayer);
  t.true(afterPayer.lamports > beforePayer.lamports);

  nftAtaAccount = await getAccount(minterConnection, nftAta);
  t.false(nftAtaAccount.isFrozen);

  // route instruction to unlock fund

  const authorityWallet = await connection.getAccountInfo(authorityPair.publicKey);

  const unlock_accounts: RouteInstructionAccounts = {
    candyGuard: candyGuard,
    candyMachine: candyMachine,
    payer: authorityPair.publicKey,
  };

  const unlock_buffer = Buffer.alloc(freezeInstructionBeet.byteSize);
  freezeInstructionBeet.write(unlock_buffer, 0, FreezeInstruction.UnlockFunds);

  const unlock_args: RouteInstructionArgs = {
    args: {
      guard: GuardType.FreezeSolPayment,
      data: unlock_buffer,
    },
    label: null,
  };

  const unlockRouteIx = createRouteInstruction(unlock_accounts, unlock_args);
  unlockRouteIx.keys.push(
    ...[
      {
        pubkey: freezeEscrow,
        isSigner: false,
        isWritable: true,
      },
      {
        pubkey: authorityPair.publicKey,
        isSigner: true,
        isWritable: false,
      },
      {
        pubkey: authorityPair.publicKey,
        isSigner: false,
        isWritable: true,
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
    [authorityPair],
    'tx: Route (Unlock Funds)',
  );

  await unlockHandler.assertSuccess(t);

  const updatedAuthorityWallet = await connection.getAccountInfo(authorityPair.publicKey);

  t.true(authorityWallet!.lamports < updatedAuthorityWallet!.lamports);
});

test('Freeze Sol Payment (unlock not enabled)', async (t) => {
  const { fstTxHandler: authorityHandler, authorityPair, connection } = await API.authority();

  const data = newCandyGuardData();
  data.default.freezeSolPayment = {
    lamports: 1000000000,
    destination: authorityPair.publicKey,
  };

  const { candyGuard, candyMachine } = await API.deploy(
    t,
    data,
    authorityPair,
    authorityHandler,
    connection,
  );

  const [freezeEscrow] = await PublicKey.findProgramAddress(
    [
      Buffer.from('freeze_escrow'),
      authorityPair.publicKey.toBuffer(),
      candyGuard.toBuffer(),
      candyMachine.toBuffer(),
    ],
    PROGRAM_ID,
  );

  // route instruction to enable freeze

  const freeze_accounts: RouteInstructionAccounts = {
    candyGuard: candyGuard,
    candyMachine: candyMachine,
    payer: authorityPair.publicKey,
  };

  const freeze_buffer = Buffer.alloc(freezeInstructionBeet.byteSize + i64.byteSize);
  freezeInstructionBeet.write(freeze_buffer, 0, FreezeInstruction.Initialize);
  i64.write(freeze_buffer, freezeInstructionBeet.byteSize, 1);

  const freeze_args: RouteInstructionArgs = {
    args: {
      guard: GuardType.FreezeSolPayment,
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
        pubkey: authorityPair.publicKey,
        isSigner: true,
        isWritable: false,
      },
      {
        pubkey: SystemProgram.programId,
        isSigner: false,
        isWritable: false,
      },
    ],
  );

  const freezeTx = new Transaction().add(freezeRouteIx);

  const freezeHandler = authorityHandler.sendAndConfirmTransaction(
    freezeTx,
    [authorityPair],
    'tx: Route (Initialize)',
  );

  await freezeHandler.assertSuccess(t);

  // minting

  const {
    fstTxHandler: minterHandler,
    minterPair,
    connection: minterConnection,
  } = await API.minter();

  const [, mintForMinter2] = await amman.genLabeledKeypair('Mint Account (minter)');
  const metaplex = Metaplex.make(connection).use(keypairIdentity(minterPair));
  const nftAta = metaplex
    .tokens()
    .pdas()
    .associatedTokenAccount({ mint: mintForMinter2.publicKey, owner: minterPair.publicKey });

  const { tx: minterMintTx2 } = await API.mint(
    t,
    candyGuard,
    candyMachine,
    minterPair,
    mintForMinter2,
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
        isWritable: false,
      },
    ],
  );

  await minterMintTx2.assertSuccess(t);

  // route instruction to unlock fund

  const unlock_accounts: RouteInstructionAccounts = {
    candyGuard: candyGuard,
    candyMachine: candyMachine,
    payer: authorityPair.publicKey,
  };

  const unlock_buffer = Buffer.alloc(freezeInstructionBeet.byteSize);
  freezeInstructionBeet.write(unlock_buffer, 0, FreezeInstruction.UnlockFunds);

  const unlock_args: RouteInstructionArgs = {
    args: {
      guard: GuardType.FreezeSolPayment,
      data: unlock_buffer,
    },
    label: null,
  };

  const unlockRouteIx = createRouteInstruction(unlock_accounts, unlock_args);
  unlockRouteIx.keys.push(
    ...[
      {
        pubkey: freezeEscrow,
        isSigner: false,
        isWritable: true,
      },
      {
        pubkey: authorityPair.publicKey,
        isSigner: true,
        isWritable: false,
      },
      {
        pubkey: authorityPair.publicKey,
        isSigner: false,
        isWritable: true,
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
    [authorityPair],
    'tx: Route (Unlock Funds)',
  );

  await unlockHandler.assertError(t, /Unlock is not enabled/i);
});

test('Freeze Sol Payment (thaw with closed candy guard)', async (t) => {
  const { fstTxHandler: authorityHandler, authorityPair, connection } = await API.authority();

  const data = newCandyGuardData();
  data.default.freezeSolPayment = {
    lamports: 1000000000,
    destination: authorityPair.publicKey,
  };

  const { candyGuard, candyMachine } = await API.deploy(
    t,
    data,
    authorityPair,
    authorityHandler,
    connection,
  );

  const [freezeEscrow] = await PublicKey.findProgramAddress(
    [
      Buffer.from('freeze_escrow'),
      authorityPair.publicKey.toBuffer(),
      candyGuard.toBuffer(),
      candyMachine.toBuffer(),
    ],
    PROGRAM_ID,
  );

  // route instruction to enable freeze

  const freeze_accounts: RouteInstructionAccounts = {
    candyGuard: candyGuard,
    candyMachine: candyMachine,
    payer: authorityPair.publicKey,
  };

  const freeze_buffer = Buffer.alloc(freezeInstructionBeet.byteSize + i64.byteSize);
  freezeInstructionBeet.write(freeze_buffer, 0, FreezeInstruction.Initialize);
  i64.write(freeze_buffer, freezeInstructionBeet.byteSize, 1);

  const freeze_args: RouteInstructionArgs = {
    args: {
      guard: GuardType.FreezeSolPayment,
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
        pubkey: authorityPair.publicKey,
        isSigner: true,
        isWritable: false,
      },
      {
        pubkey: SystemProgram.programId,
        isSigner: false,
        isWritable: false,
      },
    ],
  );

  const freezeTx = new Transaction().add(freezeRouteIx);

  const freezeHandler = authorityHandler.sendAndConfirmTransaction(
    freezeTx,
    [authorityPair],
    'tx: Route (Initialize)',
  );

  await freezeHandler.assertSuccess(t);

  // minting

  const {
    fstTxHandler: minterHandler,
    minterPair,
    connection: minterConnection,
  } = await API.minter();

  const [, mintForMinter2] = await amman.genLabeledKeypair('Mint Account (minter)');
  const metaplex = Metaplex.make(connection).use(keypairIdentity(minterPair));
  const nftAta = metaplex
    .tokens()
    .pdas()
    .associatedTokenAccount({ mint: mintForMinter2.publicKey, owner: minterPair.publicKey });

  const { tx: minterMintTx2 } = await API.mint(
    t,
    candyGuard,
    candyMachine,
    minterPair,
    mintForMinter2,
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
        isWritable: false,
      },
    ],
  );

  await minterMintTx2.assertSuccess(t);

  let nftAtaAccount = await getAccount(minterConnection, nftAta);
  t.true(nftAtaAccount.isFrozen);

  // close candy guard account

  const { tx: withdrawTransaction } = await API.withdraw(
    t,
    candyGuard,
    authorityPair,
    authorityHandler,
  );
  await withdrawTransaction.assertSuccess(t);

  // thaw

  await sleep(1000); // make sure that the freeze period is over

  const thaw_accounts: RouteInstructionAccounts = {
    candyGuard: candyGuard,
    candyMachine: candyMachine,
    payer: minterPair.publicKey,
  };

  const thaw_buffer = Buffer.alloc(freezeInstructionBeet.byteSize);
  freezeInstructionBeet.write(thaw_buffer, 0, FreezeInstruction.Thaw);

  const thaw_args: RouteInstructionArgs = {
    args: {
      guard: GuardType.FreezeSolPayment,
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
        pubkey: mintForMinter2.publicKey,
        isSigner: false,
        isWritable: false,
      },
      {
        pubkey: minterPair.publicKey,
        isSigner: false,
        isWritable: false,
      },
      {
        pubkey: nftAta,
        isSigner: false,
        isWritable: true,
      },
      {
        pubkey: metaplex.nfts().pdas().masterEdition({ mint: mintForMinter2.publicKey }),
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

  const thawHandler = minterHandler.sendAndConfirmTransaction(
    thawTx,
    [minterPair],
    'tx: Route (Thaw)',
  );

  await thawHandler.assertSuccess(t);

  nftAtaAccount = await getAccount(minterConnection, nftAta);
  t.false(nftAtaAccount.isFrozen);
});
