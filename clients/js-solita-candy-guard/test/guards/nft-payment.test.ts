import spok from 'spok';
import test from 'tape';
import { amman, InitTransactions, killStuckProcess, newCandyGuardData } from '../setup';
import { Metaplex, keypairIdentity, Nft } from '@metaplex-foundation/js';
import { AccountMeta, PublicKey } from '@solana/web3.js';
import { ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID, getAccount } from '@solana/spl-token';
import { CandyMachine } from '@metaplex-foundation/mpl-candy-machine-core';
import { TokenStandard } from '@metaplex-foundation/mpl-token-metadata';
import { METAPLEX_PROGRAM_ID, spokSameBigint } from '../utils';
import { BN } from 'bn.js';

const API = new InitTransactions();

killStuckProcess();

test('nft payment: NonFungible', async (t) => {
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

  // enables the nft_payment guard

  const [tokenAccount] = await PublicKey.findProgramAddress(
    [minter.publicKey.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mintForMinter.publicKey.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );

  const candyMachineObject = await CandyMachine.fromAccountAddress(connection, candyMachine);

  const updatedData = newCandyGuardData();
  updatedData.default.startDate = {
    date: 1662479807,
  };
  updatedData.default.nftPayment = {
    requiredCollection: candyMachineObject.collectionMint,
    destination: payerPair.publicKey,
  };

  const { tx: updateTx } = await API.update(t, candyGuard, updatedData, payerPair, fstTxHandler);
  await updateTx.assertSuccess(t);

  // mint (as a minter)

  const [, mintForMinter2] = await amman.genLabeledKeypair('Mint Account 2 (minter)');
  const { tx: minterMintTx2 } = await API.mint(
    t,
    candyGuard,
    candyMachine,
    minter,
    mintForMinter2,
    minterHandler,
    minterConnection,
  );
  await minterMintTx2.assertError(t, /Missing expected remaining account/i);

  const metaplex = Metaplex.make(connection).use(keypairIdentity(payerPair));
  const nft = await metaplex.nfts().findByMint({ mintAddress: mintForMinter.publicKey });
  const paymentGuardAccounts: AccountMeta[] = [];

  // nft account
  paymentGuardAccounts.push({
    pubkey: tokenAccount,
    isSigner: false,
    isWritable: true,
  });
  // nft metadata
  paymentGuardAccounts.push({
    pubkey: nft.metadataAddress,
    isSigner: false,
    isWritable: true,
  });
  // nft mint
  paymentGuardAccounts.push({
    pubkey: mintForMinter.publicKey,
    isSigner: false,
    isWritable: false,
  });
  // destination
  paymentGuardAccounts.push({
    pubkey: updatedData.default.nftPayment.destination,
    isSigner: false,
    isWritable: false,
  });
  // destination ATA
  const [destinationAta] = await PublicKey.findProgramAddress(
    [
      updatedData.default.nftPayment.destination.toBuffer(),
      TOKEN_PROGRAM_ID.toBuffer(),
      mintForMinter.publicKey.toBuffer(),
    ],
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );
  paymentGuardAccounts.push({
    pubkey: destinationAta,
    isSigner: false,
    isWritable: true,
  });
  // associate token program
  paymentGuardAccounts.push({
    pubkey: ASSOCIATED_TOKEN_PROGRAM_ID,
    isSigner: false,
    isWritable: false,
  });

  const [, mintForMinter3] = await amman.genLabeledKeypair('Mint Account 3 (minter)');
  const { tx: minterMintTx3 } = await API.mint(
    t,
    candyGuard,
    candyMachine,
    minter,
    mintForMinter3,
    minterHandler,
    minterConnection,
    paymentGuardAccounts,
  );
  await minterMintTx3.assertSuccess(t);

  // check the transfer result

  const sourceAccount = await getAccount(connection, tokenAccount);

  spok(t, sourceAccount, {
    amount: spokSameBigint(new BN(0)),
  });

  const destinationAccount = await getAccount(connection, destinationAta);

  spok(t, destinationAccount, {
    amount: spokSameBigint(new BN(1)),
  });
});

test('nft payment: Programmable NonFungible', async (t) => {
  const { fstTxHandler, payerPair, connection } = await API.payer();

  const data = newCandyGuardData();
  data.default.startDate = {
    date: 1662479807,
  };

  const { candyGuard, candyMachine } = await API.deployV2(
    t,
    data,
    payerPair,
    fstTxHandler,
    connection,
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

  // enables the nft_payment guard

  const [tokenAccount] = await PublicKey.findProgramAddress(
    [minter.publicKey.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mintForMinter.publicKey.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );

  const candyMachineObject = await CandyMachine.fromAccountAddress(connection, candyMachine);

  const updatedData = newCandyGuardData();
  updatedData.default.startDate = {
    date: 1662479807,
  };
  updatedData.default.nftPayment = {
    requiredCollection: candyMachineObject.collectionMint,
    destination: payerPair.publicKey,
  };

  const { tx: updateTx } = await API.update(t, candyGuard, updatedData, payerPair, fstTxHandler);
  await updateTx.assertSuccess(t);

  // mint (as a minter)

  const [, mintForMinter2] = await amman.genLabeledKeypair('Mint Account 2 (minter)');
  const { tx: minterMintTx2 } = await API.mintV2(
    candyGuard,
    candyMachine,
    minter,
    minter,
    mintForMinter2,
    minterHandler,
    minterConnection,
  );
  await minterMintTx2.assertError(t, /Missing expected remaining account/i);

  const metaplex = Metaplex.make(connection).use(keypairIdentity(payerPair));
  const nft = (await metaplex.nfts().findByMint({ mintAddress: mintForMinter.publicKey })) as Nft;
  const paymentGuardAccounts: AccountMeta[] = [];

  // nft account
  paymentGuardAccounts.push({
    pubkey: tokenAccount,
    isSigner: false,
    isWritable: true,
  });
  // nft metadata
  paymentGuardAccounts.push({
    pubkey: nft.metadataAddress,
    isSigner: false,
    isWritable: true,
  });
  // nft mint
  paymentGuardAccounts.push({
    pubkey: mintForMinter.publicKey,
    isSigner: false,
    isWritable: false,
  });
  // destination
  paymentGuardAccounts.push({
    pubkey: updatedData.default.nftPayment.destination,
    isSigner: false,
    isWritable: false,
  });
  // destination ATA
  const [destinationAta] = await PublicKey.findProgramAddress(
    [
      updatedData.default.nftPayment.destination.toBuffer(),
      TOKEN_PROGRAM_ID.toBuffer(),
      mintForMinter.publicKey.toBuffer(),
    ],
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );
  paymentGuardAccounts.push({
    pubkey: destinationAta,
    isSigner: false,
    isWritable: true,
  });
  // associate token program
  paymentGuardAccounts.push({
    pubkey: ASSOCIATED_TOKEN_PROGRAM_ID,
    isSigner: false,
    isWritable: false,
  });
  // master edition
  paymentGuardAccounts.push({
    pubkey: nft.edition.address,
    isSigner: false,
    isWritable: false,
  });
  // owner token record
  const [ownerTokenRecord] = await PublicKey.findProgramAddress(
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
    pubkey: ownerTokenRecord,
    isSigner: false,
    isWritable: true,
  });
  // destination token record
  const [destinationTokenRecord] = await PublicKey.findProgramAddress(
    [
      Buffer.from('metadata'),
      METAPLEX_PROGRAM_ID.toBuffer(),
      mintForMinter.publicKey.toBuffer(),
      Buffer.from('token_record'),
      destinationAta.toBuffer(),
    ],
    METAPLEX_PROGRAM_ID,
  );
  paymentGuardAccounts.push({
    pubkey: destinationTokenRecord,
    isSigner: false,
    isWritable: true,
  });

  const [, mintForMinter3] = await amman.genLabeledKeypair('Mint Account 3 (minter)');
  const { tx: minterMintTx3 } = await API.mintV2(
    candyGuard,
    candyMachine,
    minter,
    minter,
    mintForMinter3,
    minterHandler,
    minterConnection,
    paymentGuardAccounts,
  );
  await minterMintTx3.assertSuccess(t);

  // check the transfer result

  const sourceAccount = await getAccount(connection, tokenAccount);

  spok(t, sourceAccount, {
    amount: spokSameBigint(new BN(0)),
  });

  const destinationAccount = await getAccount(connection, destinationAta);

  spok(t, destinationAccount, {
    amount: spokSameBigint(new BN(1)),
  });
});
