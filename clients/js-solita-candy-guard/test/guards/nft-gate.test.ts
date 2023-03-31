import test from 'tape';
import { amman, InitTransactions, killStuckProcess, newCandyGuardData } from '../setup';
import { Metaplex, keypairIdentity } from '@metaplex-foundation/js';
import { AccountMeta, PublicKey } from '@solana/web3.js';
import { ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { CandyMachine } from '@metaplex-foundation/mpl-candy-machine-core';
import spok from 'spok';
import { spokSamePubkey } from '../utils';

const API = new InitTransactions();

killStuckProcess();

test('nft gate (authority)', async (t) => {
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

  // enables the nft_gate guard

  const candyMachineObject = await CandyMachine.fromAccountAddress(connection, candyMachine);

  const updatedData = newCandyGuardData();
  updatedData.default.startDate = {
    date: 1662479807,
  };
  updatedData.default.nftGate = {
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
  const nftGateAccounts: AccountMeta[] = [];

  // token account
  const [tokenAccount] = await PublicKey.findProgramAddress(
    [
      payerPair.publicKey.toBuffer(),
      TOKEN_PROGRAM_ID.toBuffer(),
      mintForAuthority.publicKey.toBuffer(),
    ],
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );
  nftGateAccounts.push({
    pubkey: tokenAccount,
    isSigner: false,
    isWritable: false,
  });
  // token metadata
  nftGateAccounts.push({
    pubkey: nft.metadataAddress,
    isSigner: false,
    isWritable: false,
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
    nftGateAccounts,
  );
  await authorityMintTx2.assertSuccess(t);
});

test('nft gate (minter)', async (t) => {
  const { fstTxHandler: payerHandler, payerPair, connection: payerConnection } = await API.payer();

  // the mint from the first candy machine will be used as the gate
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

  // enables the nft_gate guard on a second candy machine using the
  // collectin info of the first

  const candyMachineObject = await CandyMachine.fromAccountAddress(payerConnection, candyMachine);

  const secondData = newCandyGuardData();
  secondData.default.startDate = {
    date: 1662479807,
  };
  secondData.default.nftGate = {
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

  spok(t, nft.collection?.address, spokSamePubkey(candyMachineObject.collectionMint));

  const nftGateAccounts: AccountMeta[] = [];

  // token account
  const [tokenAccount] = await PublicKey.findProgramAddress(
    [minter.publicKey.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mintForMinter.publicKey.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );
  nftGateAccounts.push({
    pubkey: tokenAccount,
    isSigner: false,
    isWritable: false,
  });
  // tokent metadata
  nftGateAccounts.push({
    pubkey: nft.metadataAddress,
    isSigner: false,
    isWritable: false,
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
    nftGateAccounts,
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

  // trying to mint again with the same gate nft

  const [, mintForMinter3] = await amman.genLabeledKeypair('Mint Account 3 (minter)');
  const { tx: minterMintTx3 } = await API.mint(
    t,
    secondCandyGuard,
    secondCandyMachine,
    minter,
    mintForMinter3,
    minterHandler,
    minterConnection,
    nftGateAccounts,
  );
  await minterMintTx3.assertSuccess(t);
});
