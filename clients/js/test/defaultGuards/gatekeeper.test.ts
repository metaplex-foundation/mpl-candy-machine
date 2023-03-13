import { Buffer } from 'buffer';
import { Keypair } from '@solana/web3.js';
import test from 'ava';
import {
  addGatekeeper,
  issueVanilla,
  addFeatureToNetwork,
  NetworkFeature,
  UserTokenExpiry,
  GatewayTokenData,
} from '@identity.com/solana-gateway-ts';
import {
  assertThrows,
  createWallet,
  killStuckProcess,
  metaplex,
} from '../../../helpers';
import { assertMintingWasSuccessful, createCandyMachine } from '../helpers';
import {
  assertAccountExists,
  DateTime,
  isEqualToAmount,
  Metaplex,
  now,
  Pda,
  PublicKey,
  Signer,
  sol,
  toBigNumber,
  toDateTime,
  TransactionBuilder,
} from '@/index';

const SECONDS_IN_A_DAY = 24 * 60 * 60;

test('it allows minting via a gatekeeper service', async (t) => {
  // Given a Gatekeeper Network.
  const umi = await createUmi();
  const { gatekeeperNetwork, gatekeeperAuthority } =
    await createGatekeeperNetwork(umi);

  // And a payer with a valid gateway Token Account from that network.
  const payer = await generateSignerWithSol(umi, sol(10));
  const gatewayTokenAccount = await issueGatewayToken(
    umi,
    gatekeeperNetwork.publicKey,
    gatekeeperAuthority,
    payer
  );

  // And a loaded Candy Machine with a gatekeeper guard on that network.
  const collectionMint = (await createCollectionNft(umi)).publicKey;
  const { publicKey: candyMachine } = await createV2(umi, {
    collectionMint,

    configLines: [{ name: 'Degen #1', uri: 'https://example.com/degen/1' }],
    guards: {
      gatekeeper: {
        network: gatekeeperNetwork.publicKey,
        expireOnUse: false,
      },
    },
  });

  // When that payer mints from the Candy Machine using its valid token.
  const mint = generateSigner(umi);
  await transactionBuilder(umi).add().sendAndConfirm();
  mintV2(
    umi,
    {
      candyMachine,
      collectionUpdateAuthority: collection.updateAuthority.publicKey,
      guards: {
        gatekeeper: {
          tokenAccount: gatewayTokenAccount,
        },
      },
    },
    { payer }
  );

  // Then minting was successful.
  await assertSuccessfulMint(
    t,
    umi,
    { mint, owner: minter },
    {
      candyMachine,
      collectionUpdateAuthority: collection.updateAuthority.publicKey,
      nft,
      owner: payer.publicKey,
    }
  );
});

test('it defaults to calculating the gateway token PDA for us', async (t) => {
  // Given a Gatekeeper Network.
  const umi = await createUmi();
  const { gatekeeperNetwork, gatekeeperAuthority } =
    await createGatekeeperNetwork(umi);

  // And a payer with a valid gateway Token Account from that network.
  const payer = await generateSignerWithSol(umi, sol(10));
  await issueGatewayToken(
    umi,
    gatekeeperNetwork.publicKey,
    gatekeeperAuthority,
    payer
  );

  // And a loaded Candy Machine with a gatekeeper guard on that network.
  const collectionMint = (await createCollectionNft(umi)).publicKey;
  const { publicKey: candyMachine } = await createV2(umi, {
    collectionMint,

    configLines: [{ name: 'Degen #1', uri: 'https://example.com/degen/1' }],
    guards: {
      gatekeeper: {
        network: gatekeeperNetwork.publicKey,
        expireOnUse: false,
      },
    },
  });

  // When that payer mints from the Candy Machine without passing in its valid token.
  const mint = generateSigner(umi);
  await transactionBuilder(umi).add().sendAndConfirm();
  mintV2(
    umi,
    {
      candyMachine,
      collectionUpdateAuthority: collection.updateAuthority.publicKey,
    },
    { payer }
  );

  // Then minting was still successful.
  await assertSuccessfulMint(
    t,
    umi,
    { mint, owner: minter },
    {
      candyMachine,
      collectionUpdateAuthority: collection.updateAuthority.publicKey,
      nft,
      owner: payer.publicKey,
    }
  );
});

test('it forbids minting when providing the wrong token', async (t) => {
  // Given a Gatekeeper Network.
  const umi = await createUmi();
  const { gatekeeperNetwork } = await createGatekeeperNetwork(umi);

  // And a payer without a valid gateway Token Account from that network.
  const payer = await generateSignerWithSol(umi, sol(10));
  const wrongToken = generateSigner(umi).publicKey;

  // Given a loaded Candy Machine with a gatekeeper guard.
  const collectionMint = (await createCollectionNft(umi)).publicKey;
  const { publicKey: candyMachine } = await createV2(umi, {
    collectionMint,

    configLines: [{ name: 'Degen #1', uri: 'https://example.com/degen/1' }],
    guards: {
      gatekeeper: {
        network: gatekeeperNetwork.publicKey,
        expireOnUse: false,
      },
    },
  });

  // When the payer tries to mint from it with the wrong token.
  const mint = generateSigner(umi);
  const promise = transactionBuilder(umi).add().sendAndConfirm();
  mintV2(
    umi,
    {
      candyMachine,
      collectionUpdateAuthority: collection.updateAuthority.publicKey,
      guards: {
        gatekeeper: {
          tokenAccount: wrongToken,
        },
      },
    },
    { payer }
  );

  // Then we expect an error.
  await t.throwsAsync(promise, { message: /Gateway token is not valid/ });
});

test('it allows minting using gateway tokens that expire when they are still valid', async (t) => {
  // Given a Gatekeeper Network.
  const umi = await createUmi();
  const { gatekeeperNetwork, gatekeeperAuthority } =
    await createGatekeeperNetwork(umi);

  // And a payer with a valid gateway Token Account from that network
  // that has not yet expired.
  const payer = await generateSignerWithSol(umi, sol(10));
  const gatewayTokenAccount = await issueGatewayToken(
    umi,
    gatekeeperNetwork.publicKey,
    gatekeeperAuthority,
    payer,
    toDateTime(now().addn(SECONDS_IN_A_DAY)) // Tomorrow.
  );

  // And a loaded Candy Machine with a gatekeeper guard on that network.
  const collectionMint = (await createCollectionNft(umi)).publicKey;
  const { publicKey: candyMachine } = await createV2(umi, {
    collectionMint,

    configLines: [{ name: 'Degen #1', uri: 'https://example.com/degen/1' }],
    guards: {
      gatekeeper: {
        network: gatekeeperNetwork.publicKey,
        expireOnUse: false,
      },
    },
  });

  // When that payer mints from the Candy Machine using its non-expired token.
  const mint = generateSigner(umi);
  await transactionBuilder(umi).add().sendAndConfirm();
  mintV2(
    umi,
    {
      candyMachine,
      collectionUpdateAuthority: collection.updateAuthority.publicKey,
      guards: {
        gatekeeper: {
          tokenAccount: gatewayTokenAccount,
        },
      },
    },
    { payer }
  );

  // Then minting was successful.
  await assertSuccessfulMint(
    t,
    umi,
    { mint, owner: minter },
    {
      candyMachine,
      collectionUpdateAuthority: collection.updateAuthority.publicKey,
      nft,
      owner: payer.publicKey,
    }
  );
});

test('it forbids minting using gateway tokens that have expired', async (t) => {
  // Given a Gatekeeper Network.
  const umi = await createUmi();
  const { gatekeeperNetwork, gatekeeperAuthority } =
    await createGatekeeperNetwork(umi);

  // And a payer with a gateway Token Account from that network that has expired.
  const payer = await generateSignerWithSol(umi, sol(10));
  const expiredGatewayTokenAccount = await issueGatewayToken(
    umi,
    gatekeeperNetwork.publicKey,
    gatekeeperAuthority,
    payer,
    toDateTime(now().subn(SECONDS_IN_A_DAY)) // Yesterday.
  );

  // And a loaded Candy Machine with a gatekeeper guard on that network.
  const collectionMint = (await createCollectionNft(umi)).publicKey;
  const { publicKey: candyMachine } = await createV2(umi, {
    collectionMint,

    configLines: [{ name: 'Degen #1', uri: 'https://example.com/degen/1' }],
    guards: {
      gatekeeper: {
        network: gatekeeperNetwork.publicKey,
        expireOnUse: false,
      },
    },
  });

  // When the payer tries to mint from the Candy Machine using its expired token.
  const mint = generateSigner(umi);
  const promise = transactionBuilder(umi).add().sendAndConfirm();
  mintV2(
    umi,
    {
      candyMachine,
      collectionUpdateAuthority: collection.updateAuthority.publicKey,
      guards: {
        gatekeeper: {
          tokenAccount: expiredGatewayTokenAccount,
        },
      },
    },
    { payer }
  );

  // Then we expect an error.
  await t.throwsAsync(promise, { message: /Gateway token is not valid/ });
});

test('it may immediately mark gateway tokens as expired after using them', async (t) => {
  // Given a Gatekeeper Network.
  const umi = await createUmi();
  const { gatekeeperNetwork, gatekeeperAuthority } =
    await createGatekeeperNetwork(umi);

  // And a payer with a valid gateway Token Account from that network
  // that is set to expire tomorrow.
  const payer = await generateSignerWithSol(umi, sol(10));
  const tomorrowDateTime = toDateTime(now().addn(SECONDS_IN_A_DAY));
  const gatewayTokenAccount = await issueGatewayToken(
    umi,
    gatekeeperNetwork.publicKey,
    gatekeeperAuthority,
    payer,
    tomorrowDateTime
  );
  const gatewayTokenData = await getGatewayTokenData(umi, gatewayTokenAccount);
  t.true(!!gatewayTokenData.expiry, 'Gateway token expires');
  t.iss(gatewayTokenData.expiry?.toNumber(), tomorrowDateTime.toNumber());

  // And a loaded Candy Machine with a gatekeeper guard
  // that mark tokens as expire after using them.
  const collectionMint = (await createCollectionNft(umi)).publicKey;
  const { publicKey: candyMachine } = await createV2(umi, {
    collectionMint,

    configLines: [{ name: 'Degen #1', uri: 'https://example.com/degen/1' }],
    guards: {
      gatekeeper: {
        network: gatekeeperNetwork.publicKey,
        expireOnUse: true,
      },
    },
  });

  // When that payer mints from the Candy Machine using its token.
  const mint = generateSigner(umi);
  await transactionBuilder(umi).add().sendAndConfirm();
  mintV2(
    umi,
    {
      candyMachine,
      collectionUpdateAuthority: collection.updateAuthority.publicKey,
      guards: {
        gatekeeper: {
          tokenAccount: gatewayTokenAccount,
        },
      },
    },
    { payer }
  );

  // Then minting was successful.
  await assertSuccessfulMint(
    t,
    umi,
    { mint, owner: minter },
    {
      candyMachine,
      collectionUpdateAuthority: collection.updateAuthority.publicKey,
      nft,
      owner: payer.publicKey,
    }
  );

  // And the gateway token is now expired.
  const updatedGatewayTokenData = await getGatewayTokenData(
    umi,
    gatewayTokenAccount
  );
  t.true(!!updatedGatewayTokenData.expiry, 'Gateway token expires');
  const updateExpiry = updatedGatewayTokenData.expiry?.toNumber() as number;
  t.true(
    updateExpiry < tomorrowDateTime.toNumber(),
    'Gateway token expiry date was shortened'
  );
});

test('it charges a bot tax when trying to mint using the wrong token', async (t) => {
  // Given a Gatekeeper Network.
  const umi = await createUmi();
  const { gatekeeperNetwork } = await createGatekeeperNetwork(umi);

  // And a payer without a valid gateway Token Account from that network.
  const payer = await generateSignerWithSol(umi, sol(10));
  const wrongToken = generateSigner(umi).publicKey;

  // Given a loaded Candy Machine with a gatekeeper guard and a botTax guard.
  const collectionMint = (await createCollectionNft(umi)).publicKey;
  const { publicKey: candyMachine } = await createV2(umi, {
    collectionMint,

    configLines: [{ name: 'Degen #1', uri: 'https://example.com/degen/1' }],
    guards: {
      botTax: {
        lamports: sol(0.1),
        lastInstruction: true,
      },
      gatekeeper: {
        network: gatekeeperNetwork.publicKey,
        expireOnUse: false,
      },
    },
  });

  // When the payer tries to mint from it with the wrong token.
  const mint = generateSigner(umi);
  const promise = transactionBuilder(umi).add().sendAndConfirm();
  mintV2(
    umi,
    {
      candyMachine,
      collectionUpdateAuthority: collection.updateAuthority.publicKey,
      guards: {
        gatekeeper: {
          tokenAccount: wrongToken,
        },
      },
    },
    { payer }
  );

  // Then we expect a bot tax error.
  await t.throwsAsync(promise, { message: /CandyMachineBotTaxError/ });

  // And the payer was charged a bot tax.
  const payerBalance = await umi.rpc.getBalance(payer.publicKey);
  t.true(
    isEqualToAmount(payerBalance, sol(9.9), sol(0.01)),
    'payer was charged a bot tax'
  );
});

const createGatekeeperNetwork = async (
  umi: Metaplex
): Promise<{
  gatekeeperNetwork: Signer;
  gatekeeperAuthority: Signer;
}> => {
  // Prepare the accounts.
  const gatewayProgram = umi.programs().getGateway();
  const gatekeeperAuthority = await generateSignerWithSol(umi, sol(10));
  const gatekeeperNetwork = generateSigner(umi);
  const gatekeeperAccount = Pda.find(gatewayProgram.address, [
    gatekeeperAuthority.publicKey.toBuffer(),
    gatekeeperNetwork.publicKey.toBuffer(),
    Buffer.from('gatekeeper'),
  ]);

  // Create the gatekeeper network.
  const addGatekeeperTx = TransactionBuilder.make().add({
    instruction: addGatekeeper(
      gatekeeperAuthority.publicKey,
      gatekeeperAccount,
      gatekeeperAuthority.publicKey,
      gatekeeperNetwork.publicKey
    ),
    signers: [gatekeeperAuthority, gatekeeperNetwork],
  });
  await addGatekeeperTx.sendAndConfirm(umi);

  // Add the expire feature to the gatekeeper network.
  const expireFeature = new NetworkFeature({
    userTokenExpiry: new UserTokenExpiry({}),
  });
  const addExpireFeatureTx = TransactionBuilder.make().add({
    instruction: await addFeatureToNetwork(
      gatekeeperAuthority.publicKey,
      gatekeeperNetwork.publicKey,
      expireFeature
    ),
    signers: [gatekeeperAuthority, gatekeeperNetwork],
  });
  await addExpireFeatureTx.sendAndConfirm(umi);

  return { gatekeeperNetwork, gatekeeperAuthority };
};

const issueGatewayToken = async (
  umi: Metaplex,
  gatekeeperNetwork: PublicKey,
  gatekeeperAuthority: Signer,
  payer: Signer,
  expiryDate?: DateTime,
  seeds = [0, 0, 0, 0, 0, 0, 0, 0]
): Promise<PublicKey> => {
  const gatewayProgram = umi.programs().getGateway();
  const gatekeeperAccount = Pda.find(gatewayProgram.address, [
    gatekeeperAuthority.publicKey.toBuffer(),
    gatekeeperNetwork.toBuffer(),
    Buffer.from('gatekeeper'),
  ]);
  const gatewayTokenAccount = Pda.find(gatewayProgram.address, [
    payer.publicKey.toBuffer(),
    Buffer.from('gateway'),
    Buffer.from(seeds),
    gatekeeperNetwork.toBuffer(),
  ]);

  const issueVanillaTx = TransactionBuilder.make().add({
    instruction: issueVanilla(
      gatewayTokenAccount,
      payer.publicKey,
      gatekeeperAccount,
      payer.publicKey,
      gatekeeperAuthority.publicKey,
      gatekeeperNetwork,
      Buffer.from(seeds),
      expiryDate?.toNumber()
    ),
    signers: [payer, gatekeeperAuthority],
  });
  await issueVanillaTx.sendAndConfirm(umi);

  return gatewayTokenAccount;
};

const getGatewayTokenData = async (
  umi: Metaplex,
  gatewayTokenAccount: PublicKey
): Promise<GatewayTokenData> => {
  const account = await umi.rpc().getAccount(gatewayTokenAccount);
  assertAccountExists(account);

  return GatewayTokenData.fromAccount(account.data);
};
