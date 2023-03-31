import test from 'tape';
import { amman, newCandyGuardData, newGuardSet, InitTransactions, killStuckProcess } from './setup';
import { CandyMachineHelper } from './utils';
import { AccountMeta } from '@solana/web3.js';
import { BN } from 'bn.js';

const API = new InitTransactions();
const HELPER = new CandyMachineHelper();

killStuckProcess();

test('mint (CPI)', async (t) => {
  const { fstTxHandler, payerPair, connection } = await API.payer();

  // candy machine
  const [, candyMachine] = await amman.genLabeledKeypair('Candy Machine Account');

  const items = 10;

  const candyMachineData = {
    itemsAvailable: items,
    symbol: 'CORE',
    sellerFeeBasisPoints: 500,
    maxSupply: 0,
    isMutable: true,
    creators: [
      {
        address: payerPair.publicKey,
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

  const { tx: createTxCM } = await HELPER.initialize(
    t,
    payerPair,
    candyMachine,
    candyMachineData,
    fstTxHandler,
    connection,
  );
  // executes the transaction
  await createTxCM.assertNone();

  const lines: { name: string; uri: string }[] = [];

  for (let i = 0; i < items; i++) {
    const line = {
      name: `NFT #${i + 1}`,
      uri: 'uJSdJIsz_tYTcjUEWdeVSj0aR90K-hjDauATWZSi-tQ',
    };

    lines.push(line);
  }
  const { txs } = await HELPER.addConfigLines(t, candyMachine.publicKey, payerPair, lines);
  // confirms that all lines have been written
  for (const tx of txs) {
    await fstTxHandler
      .sendAndConfirmTransaction(tx, [payerPair], 'tx: AddConfigLines')
      .assertNone();
  }

  // minting directly from the candy machine

  // as authority
  const [, mintKeypair1] = await amman.genLabeledKeypair('Mint Account 1 (authority)');
  const { tx: mintTx1 } = await HELPER.mint(
    t,
    candyMachine.publicKey,
    payerPair,
    mintKeypair1,
    fstTxHandler,
    connection,
  );
  await mintTx1.assertSuccess(t);

  // as a minter
  try {
    const {
      fstTxHandler: minterHandler,
      minterPair: minter,
      connection: minterConnection,
    } = await API.minter();
    const [, mintKeypair2] = await amman.genLabeledKeypair('Mint Account (minter)');
    const { tx: mintTx2 } = await HELPER.mint(
      t,
      candyMachine.publicKey,
      minter,
      mintKeypair2,
      minterHandler,
      minterConnection,
    );
    await mintTx2.assertSuccess(t);
    t.fail('only mint authority is allowed to mint');
  } catch {
    // we are expecting an error
    t.pass('minter is not the candy machine mint authority');
  }

  // candy guard
  const candyGuardData = newCandyGuardData();

  const { tx: initializeTxCG, candyGuard: address } = await API.initialize(
    t,
    candyGuardData,
    payerPair,
    fstTxHandler,
  );
  // executes the transaction
  await initializeTxCG.assertSuccess(t);

  const { tx: wrapTx } = await API.wrap(
    t,
    address,
    candyMachine.publicKey,
    payerPair,
    fstTxHandler,
  );

  await wrapTx.assertSuccess(t, [/SetMintAuthority/i]);

  // minting from the candy machine should fail

  try {
    const [, mintKeypair3] = await amman.genLabeledKeypair('CG Mint Account 1 (authority)');
    const { tx: mintTx3 } = await HELPER.mint(
      t,
      candyMachine.publicKey,
      payerPair,
      mintKeypair3,
      fstTxHandler,
      connection,
    );
    await mintTx3.assertSuccess(t);
    t.fail('only CG authority is allowed to mint');
  } catch {
    // we are expecting an error
    t.pass('payer is not the candy machine authority');
  }

  // minting through the candy guard (as authority)

  const [, mintKeypair4] = await amman.genLabeledKeypair('CG Mint Account 2 (authority)');
  const { tx: mintTx4 } = await API.mint(
    t,
    address,
    candyMachine.publicKey,
    payerPair,
    mintKeypair4,
    fstTxHandler,
    connection,
  );
  await mintTx4.assertSuccess(t);

  // minting through the candy guard (as a minter)

  const {
    fstTxHandler: minterHandler,
    minterPair: minter,
    connection: minterConnection,
  } = await API.minter();

  const [, mintKeypair5] = await amman.genLabeledKeypair('CG Mint Account 1 (minter)');
  const { tx: mintTx5 } = await API.mint(
    t,
    address,
    candyMachine.publicKey,
    minter,
    mintKeypair5,
    minterHandler,
    minterConnection,
  );
  await mintTx5.assertSuccess(t);

  const [, mintKeypair6] = await amman.genLabeledKeypair('CG Mint Account 2 (minter)');
  const { tx: mintTx6 } = await API.mint(
    t,
    address,
    candyMachine.publicKey,
    minter,
    mintKeypair6,
    minterHandler,
    minterConnection,
    null,
    null,
    'Group 1',
  );
  await mintTx6.assertError(t, /Group not found/i);

  // unwraps the candy machine

  const { tx: unwrapTx } = await API.unwrap(
    t,
    address,
    candyMachine.publicKey,
    payerPair,
    fstTxHandler,
  );

  await unwrapTx.assertSuccess(t, [/SetMintAuthority/i]);

  // mints directly from the candy machine

  // as authority
  const [, mintKeypair7] = await amman.genLabeledKeypair('Mint Account 2 (authority)');
  const { tx: mintTx7 } = await HELPER.mint(
    t,
    candyMachine.publicKey,
    payerPair,
    mintKeypair7,
    fstTxHandler,
    connection,
  );
  await mintTx7.assertSuccess(t);
});

test('mint from group', async (t) => {
  // deploys a candy guard with a mint limit

  const { fstTxHandler, payerPair, connection } = await API.payer();

  // date of the 'default' guard is way in the future
  const data = newCandyGuardData();
  data.default.startDate = {
    date: 64091606400,
  };
  data.groups = [];

  // VIP
  const vipGroup = newGuardSet();
  vipGroup.startDate = {
    date: 1662394820,
  };
  vipGroup.solPayment = {
    lamports: new BN(100000000),
    destination: payerPair.publicKey,
  };
  data.groups.push({
    label: 'VIP',
    guards: vipGroup,
  });

  // OGs
  const ogGroup = newGuardSet();
  ogGroup.startDate = {
    date: 1662394820,
  };
  ogGroup.solPayment = {
    lamports: new BN(50000000),
    destination: payerPair.publicKey,
  };
  data.groups.push({
    label: 'OGs',
    guards: ogGroup,
  });

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
    minterPair: minterKeypair,
    connection: minterConnection,
  } = await API.minter();

  const [, mintForMinter] = await amman.genLabeledKeypair('Mint Account (minter)');

  const accounts: AccountMeta[] = [];
  accounts.push({
    pubkey: payerPair.publicKey,
    isSigner: false,
    isWritable: true,
  });

  // without specifying a group (should fail)

  const { tx: minterMintTx1 } = await API.mint(
    t,
    candyGuard,
    candyMachine,
    minterKeypair,
    mintForMinter,
    minterHandler,
    minterConnection,
    accounts,
    null,
    null,
  );

  await minterMintTx1.assertError(t, /Missing required group label/i);

  // specifying a group

  const { tx: minterMintTx2 } = await API.mint(
    t,
    candyGuard,
    candyMachine,
    minterKeypair,
    mintForMinter,
    minterHandler,
    minterConnection,
    accounts,
    null,
    'OGs',
  );

  await minterMintTx2.assertSuccess(t);
});

test('mint from group (bot tax)', async (t) => {
  // deploys a candy guard with a mint limit

  const { fstTxHandler, payerPair, connection } = await API.payer();

  // date of the 'default' guard is way in the future
  const data = newCandyGuardData();
  data.default.botTax = {
    lamports: 1000000000,
    lastInstruction: true,
  };
  data.default.startDate = {
    date: 64091606400,
  };
  data.groups = [];

  // VIP
  const vipGroup = newGuardSet();
  vipGroup.startDate = {
    date: 1662394820,
  };
  vipGroup.solPayment = {
    lamports: new BN(100000000),
    destination: payerPair.publicKey,
  };
  data.groups.push({
    label: 'VIP',
    guards: vipGroup,
  });

  // OGs
  const ogGroup = newGuardSet();
  ogGroup.startDate = {
    date: 1662394820,
  };
  ogGroup.solPayment = {
    lamports: new BN(50000000),
    destination: payerPair.publicKey,
  };
  data.groups.push({
    label: 'OGs',
    guards: ogGroup,
  });

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
    minterPair: minterKeypair,
    connection: minterConnection,
  } = await API.minter();

  const [, mintForMinter] = await amman.genLabeledKeypair('Mint Account (minter)');

  const accounts: AccountMeta[] = [];
  accounts.push({
    pubkey: payerPair.publicKey,
    isSigner: false,
    isWritable: true,
  });

  // without specifying a group (bot tax apply)

  const { tx: minterMintTx1 } = await API.mint(
    t,
    candyGuard,
    candyMachine,
    minterKeypair,
    mintForMinter,
    minterHandler,
    minterConnection,
    accounts,
    null,
    null,
  );

  await minterMintTx1.assertSuccess(t, [/Botting/i]);

  // specifying a group

  const [, mintForMinter2] = await amman.genLabeledKeypair('Mint Account 2 (minter)');

  const { tx: minterMintTx2 } = await API.mint(
    t,
    candyGuard,
    candyMachine,
    minterKeypair,
    mintForMinter2,
    minterHandler,
    minterConnection,
    accounts,
    null,
    'OGs',
  );

  await minterMintTx2.assertSuccess(t);
});
