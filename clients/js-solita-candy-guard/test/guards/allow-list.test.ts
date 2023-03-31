import test from 'tape';
import { amman, InitTransactions, killStuckProcess, newCandyGuardData } from '../setup';
import { MerkleTree } from 'merkletreejs';
import { keccak_256 } from '@noble/hashes/sha3';
import { u32 } from '@metaplex-foundation/beet';
import { PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import { PROGRAM_ID } from '../../src';
import {
  createRouteInstruction,
  RouteInstructionAccounts,
  RouteInstructionArgs,
} from '../../src/generated/instructions/route';
import { GuardType } from '../../src/generated/types/GuardType';

const API = new InitTransactions();

killStuckProcess();

test('allowlist (mint without proof)', async (t) => {
  const addresses: string[] = [];

  // list of addresses in the allow list

  for (let i = 0; i < 9; i++) {
    const [address] = await amman.genLabeledKeypair(`Wallet ${i}`);
    addresses.push(address.toString());
  }

  const {
    fstTxHandler: minterHandler,
    minterPair: minterKeypair,
    connection: minterConnection,
  } = await API.minter();
  addresses.push(minterKeypair.publicKey.toString());

  // creates the merkle tree
  const tree = new MerkleTree(addresses.map(keccak_256), keccak_256, { sortPairs: true });

  // deploys a candy guard with the allow list – the allowList guard is configured
  // with the root of the merkle tree

  const { fstTxHandler, payerPair, connection } = await API.payer();

  const data = newCandyGuardData();
  data.default.allowList = {
    merkleRoot: [...tree.getRoot()],
  };

  const { candyGuard, candyMachine } = await API.deploy(
    t,
    data,
    payerPair,
    fstTxHandler,
    connection,
  );

  // mint (as a minter)

  const [, mintForMinter] = await amman.genLabeledKeypair('Mint Account (minter)');
  const { tx: minterMintTx } = await API.mint(
    t,
    candyGuard,
    candyMachine,
    minterKeypair,
    mintForMinter,
    minterHandler,
    minterConnection,
  );

  await minterMintTx.assertError(t, /Missing expected remaining account/i);

  // create the pda address
  const [proofPda] = await PublicKey.findProgramAddress(
    [
      Buffer.from('allow_list'),
      tree.getRoot(),
      minterKeypair.publicKey.toBuffer(),
      candyGuard.toBuffer(),
      candyMachine.toBuffer(),
    ],
    PROGRAM_ID,
  );

  const [, mintForMinter2] = await amman.genLabeledKeypair('Mint Account 2 (minter)');
  const { tx: minterMintTx2 } = await API.mint(
    t,
    candyGuard,
    candyMachine,
    minterKeypair,
    mintForMinter2,
    minterHandler,
    minterConnection,
    [
      {
        pubkey: proofPda,
        isSigner: false,
        isWritable: false,
      },
    ],
  );

  await minterMintTx2.assertError(t, /Missing allowed list proof/i);
});

test('allowlist (with proof)', async (t) => {
  const addresses: string[] = [];

  // list of addresses in the allow list

  for (let i = 0; i < 9; i++) {
    const [address] = await amman.genLabeledKeypair(`Wallet ${i}`);
    addresses.push(address.toString());
  }

  const {
    fstTxHandler: minterHandler,
    minterPair: minterKeypair,
    connection: minterConnection,
  } = await API.minter();
  addresses.push(minterKeypair.publicKey.toString());

  // creates the merkle tree
  const tree = new MerkleTree(addresses.map(keccak_256), keccak_256, { sortPairs: true });

  // deploys a candy guard with the allow list – the allowList guard is configured
  // with the root of the merkle tree

  const { fstTxHandler, payerPair, connection } = await API.payer();

  const data = newCandyGuardData();
  data.default.allowList = {
    merkleRoot: [...tree.getRoot()],
  };

  const { candyGuard, candyMachine } = await API.deploy(
    t,
    data,
    payerPair,
    fstTxHandler,
    connection,
  );

  // route instruction

  const accounts: RouteInstructionAccounts = {
    candyGuard: candyGuard,
    candyMachine: candyMachine,
    payer: minterKeypair.publicKey,
  };

  // the proof will be empty if the address is not found in the merkle tree
  const proof = tree.getProof(Buffer.from(keccak_256(minterKeypair.publicKey.toString())));

  const vectorSizeBuffer = Buffer.alloc(4);
  u32.write(vectorSizeBuffer, 0, proof.length);

  const leafBuffers = proof.map((leaf) => leaf.data);
  // prepares the mint arguments with the merkle proof
  const mintArgs = Buffer.concat([vectorSizeBuffer, ...leafBuffers]);

  const args: RouteInstructionArgs = {
    args: {
      guard: GuardType.AllowList,
      data: mintArgs,
    },
    label: null,
  };

  const [proofPda] = await PublicKey.findProgramAddress(
    [
      Buffer.from('allow_list'),
      tree.getRoot(),
      minterKeypair.publicKey.toBuffer(),
      candyGuard.toBuffer(),
      candyMachine.toBuffer(),
    ],
    PROGRAM_ID,
  );

  const routeIx = createRouteInstruction(accounts, args);
  routeIx.keys.push(
    ...[
      {
        pubkey: proofPda,
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

  const tx = new Transaction().add(routeIx);

  const h = minterHandler.sendAndConfirmTransaction(tx, [minterKeypair], 'tx: Route');

  await h.assertSuccess(t);

  // mint (as a minter)

  const [, mintForMinter] = await amman.genLabeledKeypair('Mint Account (minter)');
  const { tx: minterMintTx } = await API.mint(
    t,
    candyGuard,
    candyMachine,
    minterKeypair,
    mintForMinter,
    minterHandler,
    minterConnection,
    [
      {
        pubkey: proofPda,
        isSigner: false,
        isWritable: false,
      },
    ],
  );

  await minterMintTx.assertSuccess(t);
});

test('allowlist (with wrong proof pda)', async (t) => {
  const addresses: string[] = [];

  // list of addresses in the allow list

  for (let i = 0; i < 9; i++) {
    const [address] = await amman.genLabeledKeypair(`Wallet ${i}`);
    addresses.push(address.toString());
  }

  const { fstTxHandler: minterHandler, minterPair: minterKeypair } = await API.minter();
  addresses.push(minterKeypair.publicKey.toString());

  // creates the merkle tree
  const tree = new MerkleTree(addresses.map(keccak_256), keccak_256, { sortPairs: true });

  // deploys a candy guard with the allow list – the allowList guard is configured
  // with the root of the merkle tree

  const { fstTxHandler, payerPair, connection } = await API.payer();

  const data = newCandyGuardData();
  data.default.allowList = {
    merkleRoot: [...tree.getRoot()],
  };

  const { candyGuard, candyMachine } = await API.deploy(
    t,
    data,
    payerPair,
    fstTxHandler,
    connection,
  );

  // route instruction

  const accounts: RouteInstructionAccounts = {
    candyGuard: candyGuard,
    candyMachine: candyMachine,
    payer: minterKeypair.publicKey,
  };

  // the proof will be empty if the address is not found in the merkle tree
  const proof = tree.getProof(Buffer.from(keccak_256(minterKeypair.publicKey.toString())));

  const vectorSizeBuffer = Buffer.alloc(4);
  u32.write(vectorSizeBuffer, 0, proof.length);

  const leafBuffers = proof.map((leaf) => leaf.data);
  // prepares the mint arguments with the merkle proof
  const mintArgs = Buffer.concat([vectorSizeBuffer, ...leafBuffers]);

  const args: RouteInstructionArgs = {
    args: {
      guard: GuardType.AllowList,
      data: mintArgs,
    },
    label: null,
  };

  const [proofPda] = await PublicKey.findProgramAddress(
    [
      Buffer.from('allow_list'),
      tree.getRoot(),
      minterKeypair.publicKey.toBuffer(),
      candyGuard.toBuffer(),
      candyMachine.toBuffer(),
    ],
    PROGRAM_ID,
  );

  const routeIx = createRouteInstruction(accounts, args);
  routeIx.keys.push(
    ...[
      {
        pubkey: proofPda,
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

  const tx = new Transaction().add(routeIx);

  const h = minterHandler.sendAndConfirmTransaction(tx, [minterKeypair], 'tx: Route');

  await h.assertSuccess(t);

  // mint (as a minter)

  const [, mintForPayer] = await amman.genLabeledKeypair('Mint Account (payer)');
  const { tx: payerMintTx } = await API.mint(
    t,
    candyGuard,
    candyMachine,
    payerPair,
    mintForPayer,
    fstTxHandler,
    connection,
    [
      {
        pubkey: proofPda,
        isSigner: false,
        isWritable: false,
      },
    ],
  );

  await payerMintTx.assertError(t, /Public key mismatch/i);
});

test('allowlist (large)', async (t) => {
  const addresses: string[] = [];

  // list of addresses in the allow list

  console.log('Creating merkle tree...');

  for (let i = 0; i < 1999; i++) {
    const [address] = await amman.genLabeledKeypair(`Wallet ${i}`);
    addresses.push(address.toString());
  }

  const { minterPair: minterKeypair } = await API.minter();
  addresses.push(minterKeypair.publicKey.toString());

  // creates the merkle tree
  const tree = new MerkleTree(addresses.map(keccak_256), keccak_256, { sortPairs: true });

  // deploys a candy guard with the allow list – the allowList guard is configured
  // with the root of the merkle tree

  const { fstTxHandler: payerHandler, payerPair, connection } = await API.payer();

  const data = newCandyGuardData();
  data.default.allowList = {
    merkleRoot: [...tree.getRoot()],
  };

  const { candyGuard, candyMachine } = await API.deploy(
    t,
    data,
    payerPair,
    payerHandler,
    connection,
  );

  // route instruction

  const accounts: RouteInstructionAccounts = {
    candyGuard: candyGuard,
    candyMachine: candyMachine,
    payer: minterKeypair.publicKey,
  };

  // the proof will be empty if the address is not found in the merkle tree
  const proof = tree.getProof(Buffer.from(keccak_256(minterKeypair.publicKey.toString())));

  const vectorSizeBuffer = Buffer.alloc(4);
  u32.write(vectorSizeBuffer, 0, proof.length);

  const leafBuffers = proof.map((leaf) => leaf.data);
  // prepares the mint arguments with the merkle proof
  const mintArgs = Buffer.concat([vectorSizeBuffer, ...leafBuffers]);

  const args: RouteInstructionArgs = {
    args: {
      guard: GuardType.AllowList,
      data: mintArgs,
    },
    label: null,
  };

  const [proofPda] = await PublicKey.findProgramAddress(
    [
      Buffer.from('allow_list'),
      tree.getRoot(),
      minterKeypair.publicKey.toBuffer(),
      candyGuard.toBuffer(),
      candyMachine.toBuffer(),
    ],
    PROGRAM_ID,
  );

  const routeIx = createRouteInstruction(accounts, args);
  routeIx.keys.push(
    ...[
      {
        pubkey: proofPda,
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

  const tx = new Transaction().add(routeIx);

  const h = payerHandler.sendAndConfirmTransaction(tx, [minterKeypair], 'tx: Route');

  await h.assertSuccess(t);

  // mint (as a minter)

  const [, mintForMinter] = await amman.genLabeledKeypair('Mint Account (minter)');
  const { tx: minterMintTx } = await API.mint(
    t,
    candyGuard,
    candyMachine,
    minterKeypair,
    mintForMinter,
    payerHandler,
    connection,
    [
      {
        pubkey: proofPda,
        isSigner: false,
        isWritable: false,
      },
    ],
  );

  await minterMintTx.assertSuccess(t);
});

test('allowlist: minter different than payer', async (t) => {
  const addresses: string[] = [];

  // list of addresses in the allow list

  for (let i = 0; i < 9; i++) {
    const [address] = await amman.genLabeledKeypair(`Wallet ${i}`);
    addresses.push(address.toString());
  }

  const { minterPair: minterKeypair } = await API.minter();
  addresses.push(minterKeypair.publicKey.toString());

  // creates the merkle tree
  const tree = new MerkleTree(addresses.map(keccak_256), keccak_256, { sortPairs: true });

  // deploys a candy guard with the allow list – the allowList guard is configured
  // with the root of the merkle tree

  const { fstTxHandler: payerHandler, payerPair, connection } = await API.payer();

  const data = newCandyGuardData();
  data.default.allowList = {
    merkleRoot: [...tree.getRoot()],
  };

  const { candyGuard, candyMachine } = await API.deployV2(
    t,
    data,
    payerPair,
    payerHandler,
    connection,
  );

  // route instruction

  const accounts: RouteInstructionAccounts = {
    candyGuard: candyGuard,
    candyMachine: candyMachine,
    payer: payerPair.publicKey,
  };

  // the proof will be empty if the address is not found in the merkle tree
  const proof = tree.getProof(Buffer.from(keccak_256(minterKeypair.publicKey.toString())));

  const vectorSizeBuffer = Buffer.alloc(4);
  u32.write(vectorSizeBuffer, 0, proof.length);

  const leafBuffers = proof.map((leaf) => leaf.data);
  // prepares the mint arguments with the merkle proof
  const mintArgs = Buffer.concat([vectorSizeBuffer, ...leafBuffers]);

  const args: RouteInstructionArgs = {
    args: {
      guard: GuardType.AllowList,
      data: mintArgs,
    },
    label: null,
  };

  const [proofPda] = await PublicKey.findProgramAddress(
    [
      Buffer.from('allow_list'),
      tree.getRoot(),
      minterKeypair.publicKey.toBuffer(),
      candyGuard.toBuffer(),
      candyMachine.toBuffer(),
    ],
    PROGRAM_ID,
  );

  const routeIx = createRouteInstruction(accounts, args);
  routeIx.keys.push(
    ...[
      {
        pubkey: proofPda,
        isSigner: false,
        isWritable: true,
      },
      {
        pubkey: SystemProgram.programId,
        isSigner: false,
        isWritable: false,
      },
      {
        pubkey: minterKeypair.publicKey,
        isSigner: true,
        isWritable: false,
      },
    ],
  );

  const tx = new Transaction().add(routeIx);

  const h = payerHandler.sendAndConfirmTransaction(tx, [payerPair, minterKeypair], 'tx: Route');

  await h.assertSuccess(t);

  // payer as minter

  const [, mintForMinter] = await amman.genLabeledKeypair('Mint Account (minter)');

  const { tx: payerMintTx } = await API.mintV2(
    candyGuard,
    candyMachine,
    payerPair,
    payerPair,
    mintForMinter,
    payerHandler,
    connection,
    [
      {
        pubkey: proofPda,
        isSigner: false,
        isWritable: false,
      },
    ],
  );

  await payerMintTx.assertError(t, /Public key mismatch/i);

  const { tx: minterMintTx } = await API.mintV2(
    candyGuard,
    candyMachine,
    minterKeypair,
    payerPair,
    mintForMinter,
    payerHandler,
    connection,
    [
      {
        pubkey: proofPda,
        isSigner: false,
        isWritable: false,
      },
    ],
  );

  await minterMintTx.assertSuccess(t);
});
