import test from 'tape';
import spok from 'spok';
import { newCandyGuardData, InitTransactions, killStuckProcess } from './setup';
import { CandyGuard } from '../src/generated';
import { spokSamePubkey } from './utils';

const API = new InitTransactions();

killStuckProcess();

test('set_authority', async (t) => {
  const {
    fstTxHandler: authorityHandler,
    authorityPair: authority,
    connection,
  } = await API.authority();

  const data = newCandyGuardData();

  const { tx: txInit, candyGuard: address } = await API.initialize(
    t,
    data,
    authority,
    authorityHandler,
  );
  // executes the transaction
  await txInit.assertSuccess(t);

  // retrieves the created candy machine
  let candyGuard = await CandyGuard.fromAccountAddress(connection, address);
  spok(t, candyGuard, {
    authority: spokSamePubkey(authority.publicKey),
  });

  const { minterPair: minter } = await API.minter();
  const { tx: txUpdate } = await API.setAuthority(
    t,
    address,
    authority,
    minter.publicKey,
    authorityHandler,
  );
  await txUpdate.assertSuccess(t);

  // refresh the candy guard information
  candyGuard = await CandyGuard.fromAccountAddress(connection, address);
  spok(t, candyGuard, {
    authority: spokSamePubkey(minter.publicKey),
  });

  // trying again shoud fail
  const { tx: txUpdate2 } = await API.setAuthority(
    t,
    address,
    authority,
    minter.publicKey,
    authorityHandler,
  );
  await txUpdate2.assertError(t, /has_one constraint was violated/i);
});
