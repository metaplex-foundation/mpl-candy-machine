import test from 'tape';
import { amman, InitTransactions, killStuckProcess, newCandyGuardData, sleep } from '../setup';
import { Metaplex, keypairIdentity } from '@metaplex-foundation/js';
import { AccountMeta, AddressLookupTableAccount, PublicKey } from '@solana/web3.js';
import { ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { METAPLEX_PROGRAM_ID, spokSamePubkey } from '../utils';
import { CandyMachine } from '@metaplex-foundation/mpl-candy-machine-core';
import { TokenStandard } from '@metaplex-foundation/mpl-token-metadata';
import spok from 'spok';
import { addAddressesToTable, createAndSendV0Tx, createLookupTable } from '../setup/lut';

const API = new InitTransactions();

killStuckProcess();

test('nft burn (authority)', async (t) => {
  const { fstTxHandler, payerPair, connection } = await API.payer();

  const data = newCandyGuardData();
  data.default.startDate = {
    date: 1662479807,
  };

  const { candyGuard, candyMachine } = await API.deploy(
    t,
    data,
    payerPair,
    fstTxHandler,
    connection,
  );

  // mint (as an authority)

  const [, mintForAuthority] = await amman.genLabeledKeypair('Mint Account (authority)');
  const { tx: authorityMintTx } = await API.mint(
    t,
    candyGuard,
    candyMachine,
    payerPair,
    mintForAuthority,
    fstTxHandler,
    connection,
  );
  await authorityMintTx.assertSuccess(t);

  // enables the nft_payment guard

  const candyMachineObject = await CandyMachine.fromAccountAddress(connection, candyMachine);

  const updatedData = newCandyGuardData();
  updatedData.default.startDate = {
    date: 1662479807,
  };
  updatedData.default.nftBurn = {
    requiredCollection: candyMachineObject.collectionMint,
  };

  const { tx: updateTx } = await API.update(t, candyGuard, updatedData, payerPair, fstTxHandler);
  await updateTx.assertSuccess(t);

  // mint (as a minter)

  const {
    fstTxHandler: minterHandler,
    minterPair: minter,
    connection: minterConnection,
  } = await API.minter();
  const [, mintForMinter] = await amman.genLabeledKeypair('Mint Account (minter)');
  const { tx: minterMintTx } = await API.mint(
    t,
    candyGuard,
    candyMachine,
    minter,
    mintForMinter,
    minterHandler,
    minterConnection,
  );
  await minterMintTx.assertError(t, /Missing expected remaining account/i);

  const metaplex = Metaplex.make(connection).use(keypairIdentity(payerPair));
  const nft = await metaplex.nfts().findByMint({ mintAddress: mintForAuthority.publicKey });
  const collection = await metaplex
    .nfts()
    .findByMint({ mintAddress: candyMachineObject.collectionMint });
  const paymentGuardAccounts: AccountMeta[] = [];

  // token account
  const [tokenAccount] = await PublicKey.findProgramAddress(
    [
      payerPair.publicKey.toBuffer(),
      TOKEN_PROGRAM_ID.toBuffer(),
      mintForAuthority.publicKey.toBuffer(),
    ],
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );
  paymentGuardAccounts.push({
    pubkey: tokenAccount,
    isSigner: false,
    isWritable: true,
  });
  // tokent metadata
  paymentGuardAccounts.push({
    pubkey: nft.metadataAddress,
    isSigner: false,
    isWritable: true,
  });
  // token edition
  const [tokenEdition] = await PublicKey.findProgramAddress(
    [
      Buffer.from('metadata'),
      METAPLEX_PROGRAM_ID.toBuffer(),
      mintForAuthority.publicKey.toBuffer(),
      Buffer.from('edition'),
    ],
    METAPLEX_PROGRAM_ID,
  );
  paymentGuardAccounts.push({
    pubkey: tokenEdition,
    isSigner: false,
    isWritable: true,
  });
  // mint account
  paymentGuardAccounts.push({
    pubkey: nft.address,
    isSigner: false,
    isWritable: true,
  });
  // mint collection
  paymentGuardAccounts.push({
    pubkey: collection.metadataAddress,
    isSigner: false,
    isWritable: true,
  });

  const [, mintForAuthority2] = await amman.genLabeledKeypair('Mint Account 2 (authority)');
  const { tx: authorityMintTx2 } = await API.mint(
    t,
    candyGuard,
    candyMachine,
    payerPair,
    mintForAuthority2,
    fstTxHandler,
    connection,
    paymentGuardAccounts,
  );
  await authorityMintTx2.assertSuccess(t);
});

test('nft burn (minter)', async (t) => {
  const { fstTxHandler: payerHandler, payerPair, connection: payerConnection } = await API.payer();

  // the mint from the first candy machine will be used as the payment (burn)
  // in the second candy machine

  const data = newCandyGuardData();
  data.default.startDate = {
    date: 1662479807,
  };

  const { candyGuard, candyMachine } = await API.deploy(
    t,
    data,
    payerPair,
    payerHandler,
    payerConnection,
  );

  // mint (as a minter)

  const {
    fstTxHandler: minterHandler,
    minterPair: minter,
    connection: minterConnection,
  } = await API.minter();
  const [, mintForMinter] = await amman.genLabeledKeypair('Mint Account (minter)');
  const { tx: minterMintTx } = await API.mint(
    t,
    candyGuard,
    candyMachine,
    minter,
    mintForMinter,
    minterHandler,
    minterConnection,
  );
  await minterMintTx.assertSuccess(t);

  // enables the nft_payment guard on a second candy machine using the
  // collectin info of the first

  const candyMachineObject = await CandyMachine.fromAccountAddress(payerConnection, candyMachine);

  const secondData = newCandyGuardData();
  secondData.default.startDate = {
    date: 1662479807,
  };
  secondData.default.nftBurn = {
    requiredCollection: candyMachineObject.collectionMint,
  };

  const { candyGuard: secondCandyGuard, candyMachine: secondCandyMachine } = await API.deploy(
    t,
    secondData,
    payerPair,
    payerHandler,
    payerConnection,
  );

  // mint from the second (gated) candy machine

  const metaplex = Metaplex.make(minterConnection).use(keypairIdentity(minter));
  const nft = await metaplex.nfts().findByMint({ mintAddress: mintForMinter.publicKey });
  const collection = await metaplex
    .nfts()
    .findByMint({ mintAddress: candyMachineObject.collectionMint });

  spok(t, nft.collection?.address, spokSamePubkey(candyMachineObject.collectionMint));

  const paymentGuardAccounts: AccountMeta[] = [];

  // token account
  const [tokenAccount] = await PublicKey.findProgramAddress(
    [minter.publicKey.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mintForMinter.publicKey.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );
  paymentGuardAccounts.push({
    pubkey: tokenAccount,
    isSigner: false,
    isWritable: true,
  });
  // tokent metadata
  paymentGuardAccounts.push({
    pubkey: nft.metadataAddress,
    isSigner: false,
    isWritable: true,
  });
  // token edition
  const [tokenEdition] = await PublicKey.findProgramAddress(
    [
      Buffer.from('metadata'),
      METAPLEX_PROGRAM_ID.toBuffer(),
      mintForMinter.publicKey.toBuffer(),
      Buffer.from('edition'),
    ],
    METAPLEX_PROGRAM_ID,
  );
  paymentGuardAccounts.push({
    pubkey: tokenEdition,
    isSigner: false,
    isWritable: true,
  });
  // mint account
  paymentGuardAccounts.push({
    pubkey: nft.address,
    isSigner: false,
    isWritable: true,
  });
  // mint collection
  paymentGuardAccounts.push({
    pubkey: collection.metadataAddress,
    isSigner: false,
    isWritable: true,
  });

  const [, mintForMinter2] = await amman.genLabeledKeypair('Mint Account 2 (minter)');
  const { tx: minterMintTx2 } = await API.mint(
    t,
    secondCandyGuard,
    secondCandyMachine,
    minter,
    mintForMinter2,
    minterHandler,
    minterConnection,
    paymentGuardAccounts,
  );
  await minterMintTx2.assertSuccess(t);

  const secondCandyMachineObject = await CandyMachine.fromAccountAddress(
    payerConnection,
    secondCandyMachine,
  );
  const secondNft = await metaplex.nfts().findByMint({ mintAddress: mintForMinter2.publicKey });

  spok(t, secondNft.collection, {
    address: spokSamePubkey(secondCandyMachineObject.collectionMint),
  });

  try {
    await metaplex.nfts().findByMint({ mintAddress: mintForMinter.publicKey });
    t.error('failed to burn gate NFT');
  } catch {
    t.pass('gate NFT was not found');
  }

  // trying to mint again without a valid NFT

  const [, mintForMinter3] = await amman.genLabeledKeypair('Mint Account 3 (minter)');
  const { tx: minterMintTx3 } = await API.mint(
    t,
    secondCandyGuard,
    secondCandyMachine,
    minter,
    mintForMinter3,
    minterHandler,
    minterConnection,
    paymentGuardAccounts,
  );
  await minterMintTx3.assertError(t);
});

test('nft burn: Programmable NonFungible', async (t) => {
  const { fstTxHandler: payerHandler, payerPair, connection: payerConnection } = await API.payer();

  // the mint from the first candy machine will be used as the payment (burn)
  // in the second candy machine

  const data = newCandyGuardData();
  data.default.startDate = {
    date: 1662479807,
  };

  const { candyGuard, candyMachine } = await API.deployV2(
    t,
    data,
    payerPair,
    payerHandler,
    payerConnection,
    TokenStandard.ProgrammableNonFungible,
  );

  // mint (as a minter)

  const {
    fstTxHandler: minterHandler,
    minterPair: minter,
    connection: minterConnection,
  } = await API.minter();
  const [, mintForMinter] = await amman.genLabeledKeypair('Mint Account (minter)');
  const { tx: minterMintTx } = await API.mintV2(
    candyGuard,
    candyMachine,
    minter,
    minter,
    mintForMinter,
    minterHandler,
    minterConnection,
  );
  await minterMintTx.assertSuccess(t);

  // enables the nft_payment guard on a second candy machine using the
  // collectin info of the first

  const candyMachineObject = await CandyMachine.fromAccountAddress(payerConnection, candyMachine);

  const secondData = newCandyGuardData();
  secondData.default.startDate = {
    date: 1662479807,
  };
  secondData.default.nftBurn = {
    requiredCollection: candyMachineObject.collectionMint,
  };

  const { candyGuard: secondCandyGuard, candyMachine: secondCandyMachine } = await API.deployV2(
    t,
    secondData,
    payerPair,
    payerHandler,
    payerConnection,
    TokenStandard.ProgrammableNonFungible,
  );

  // mint from the second (gated) candy machine

  const metaplex = Metaplex.make(minterConnection).use(keypairIdentity(minter));
  const nft = await metaplex.nfts().findByMint({ mintAddress: mintForMinter.publicKey });
  const collection = await metaplex
    .nfts()
    .findByMint({ mintAddress: candyMachineObject.collectionMint });

  spok(t, nft.collection?.address, spokSamePubkey(candyMachineObject.collectionMint));

  const paymentGuardAccounts: AccountMeta[] = [];

  // token account
  const [tokenAccount] = await PublicKey.findProgramAddress(
    [minter.publicKey.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mintForMinter.publicKey.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );
  paymentGuardAccounts.push({
    pubkey: tokenAccount,
    isSigner: false,
    isWritable: true,
  });
  // token metadata
  paymentGuardAccounts.push({
    pubkey: nft.metadataAddress,
    isSigner: false,
    isWritable: true,
  });
  // token edition
  const [tokenEdition] = await PublicKey.findProgramAddress(
    [
      Buffer.from('metadata'),
      METAPLEX_PROGRAM_ID.toBuffer(),
      mintForMinter.publicKey.toBuffer(),
      Buffer.from('edition'),
    ],
    METAPLEX_PROGRAM_ID,
  );
  paymentGuardAccounts.push({
    pubkey: tokenEdition,
    isSigner: false,
    isWritable: true,
  });
  // mint account
  paymentGuardAccounts.push({
    pubkey: nft.address,
    isSigner: false,
    isWritable: true,
  });
  // mint collection
  paymentGuardAccounts.push({
    pubkey: collection.metadataAddress,
    isSigner: false,
    isWritable: true,
  });
  // token record
  const [tokenRecord] = await PublicKey.findProgramAddress(
    [
      Buffer.from('metadata'),
      METAPLEX_PROGRAM_ID.toBuffer(),
      mintForMinter.publicKey.toBuffer(),
      Buffer.from('token_record'),
      tokenAccount.toBuffer(),
    ],
    METAPLEX_PROGRAM_ID,
  );
  paymentGuardAccounts.push({
    pubkey: tokenRecord,
    isSigner: false,
    isWritable: true,
  });

  // prepares a LUT for the NFT Burn guard

  const { tx, lookupTable } = await createLookupTable(
    minter.publicKey,
    minter,
    minterHandler,
    minterConnection,
  );
  await tx.assertSuccess(t);

  // adds addresses to the lookup table

  const addresses = paymentGuardAccounts.map((value) => value.pubkey);

  const { response } = await addAddressesToTable(
    lookupTable,
    minter.publicKey,
    minter,
    addresses,
    minterConnection,
  );

  t.true(response.value.err == null);

  const account = await minterConnection.getAccountInfo(lookupTable);

  if (account) {
    const table = AddressLookupTableAccount.deserialize(account.data);

    spok(t, table, {
      addresses: [...addresses.map((value) => spokSamePubkey(value))],
    });
  }

  console.log('[ waiting for lookup table activation ]');
  await sleep(1000);

  const lookupTableAccount = await minterConnection.getAddressLookupTable(lookupTable);
  const table = lookupTableAccount.value;

  const [, mintForMinter2] = await amman.genLabeledKeypair('Mint Account 2 (minter)');

  const { instructions } = await API.mintV2Instruction(
    secondCandyGuard,
    secondCandyMachine,
    minter,
    minter,
    mintForMinter2,
    minterConnection,
    paymentGuardAccounts,
  );

  if (table) {
    await createAndSendV0Tx(minter, [minter, mintForMinter2], instructions, minterConnection, [
      table,
    ]);
  }

  const secondCandyMachineObject = await CandyMachine.fromAccountAddress(
    payerConnection,
    secondCandyMachine,
  );
  const secondNft = await metaplex.nfts().findByMint({ mintAddress: mintForMinter2.publicKey });

  spok(t, secondNft.collection, {
    address: spokSamePubkey(secondCandyMachineObject.collectionMint),
  });

  try {
    await metaplex.nfts().findByMint({ mintAddress: mintForMinter.publicKey });
    t.error('failed to burn gate NFT');
  } catch {
    t.pass('burned NFT was not found');
  }
});
