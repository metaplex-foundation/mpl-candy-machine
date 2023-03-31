import test from 'tape';
import { amman, newCandyGuardData, InitTransactions, killStuckProcess } from './setup';
import { CandyMachineHelper } from './utils';
import { TokenStandard } from '@metaplex-foundation/mpl-token-metadata';

const API = new InitTransactions();
const HELPER = new CandyMachineHelper();

killStuckProcess();

test('mint: Programmable NFT', async (t) => {
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

  const { tx: createTxCM } = await HELPER.initializeV2(
    t,
    payerPair,
    candyMachine,
    candyMachineData,
    TokenStandard.ProgrammableNonFungible,
    fstTxHandler,
    connection,
  );
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

  for (const tx of txs) {
    await fstTxHandler
      .sendAndConfirmTransaction(tx, [payerPair], 'tx: AddConfigLines')
      .assertNone();
  }

  // candy guard
  const candyGuardData = newCandyGuardData();

  const { tx: initializeTxCG, candyGuard: address } = await API.initialize(
    t,
    candyGuardData,
    payerPair,
    fstTxHandler,
  );
  await initializeTxCG.assertSuccess(t);

  const { tx: wrapTx } = await API.wrap(
    t,
    address,
    candyMachine.publicKey,
    payerPair,
    fstTxHandler,
  );

  await wrapTx.assertSuccess(t, [/SetMintAuthority/i]);

  // minting through the candy guard (as a minter)

  const {
    fstTxHandler: minterHandler,
    minterPair: minter,
    connection: minterConnection,
  } = await API.minter();

  const [, mintKeypair5] = await amman.genLabeledKeypair('CG Mint Account 1 (minter)');
  const { tx: mintTx5 } = await API.mintV2(
    address,
    candyMachine.publicKey,
    minter,
    minter,
    mintKeypair5,
    minterHandler,
    minterConnection,
  );
  await mintTx5.assertSuccess(t);
});

test('mint: Programmable NFT from Candy Machine and Candy Guard', async (t) => {
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

  const { tx: createTxCM } = await HELPER.initializeV2(
    t,
    payerPair,
    candyMachine,
    candyMachineData,
    TokenStandard.ProgrammableNonFungible,
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
  const { tx: mintTx1 } = await HELPER.mintV2(
    t,
    candyMachine.publicKey,
    payerPair,
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
  const { tx: mintTx4 } = await API.mintV2(
    address,
    candyMachine.publicKey,
    payerPair,
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
  const { tx: mintTx5 } = await API.mintV2(
    address,
    candyMachine.publicKey,
    minter,
    minter,
    mintKeypair5,
    minterHandler,
    minterConnection,
  );
  await mintTx5.assertSuccess(t);

  const [, mintKeypair6] = await amman.genLabeledKeypair('CG Mint Account 2 (minter)');
  const { tx: mintTx6 } = await API.mintV2(
    address,
    candyMachine.publicKey,
    minter,
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
  const { tx: mintTx7 } = await HELPER.mintV2(
    t,
    candyMachine.publicKey,
    minter,
    payerPair,
    mintKeypair7,
    fstTxHandler,
    connection,
  );
  await mintTx7.assertSuccess(t);
});
