import {
  addFeatureToNetwork,
  addGatekeeper,
  GatewayTokenData,
  issue,
  NetworkFeature,
  UserTokenExpiry,
} from '@identity.com/solana-gateway-ts';
import { setComputeUnitLimit } from '@metaplex-foundation/mpl-toolbox';
import {
  assertAccountExists,
  dateTime,
  DateTimeInput,
  generateSigner,
  PublicKey,
  Signer,
  sol,
  some,
  transactionBuilder,
  Umi,
} from '@metaplex-foundation/umi';
import { generateSignerWithSol } from '@metaplex-foundation/umi-bundle-tests';
import {
  fromWeb3JsInstruction,
  toWeb3JsPublicKey,
} from '@metaplex-foundation/umi-web3js-adapters';
import test from 'ava';
import { Buffer } from 'buffer';
import { mintV2 } from '../../src';
import {
  assertBotTax,
  assertSuccessfulMint,
  createCollectionNft,
  createUmi,
  createV2,
  tomorrow,
  yesterday,
} from '../_setup';

test('it allows minting via a gatekeeper service', async (t) => {
  // Given a Gatekeeper Network.
  const umi = await createUmi();
  const { gatekeeperNetwork, gatekeeperAuthority } =
    await createGatekeeperNetwork(umi);

  // And given the identity has a valid gateway Token Account from that network.
  const gatewayTokenAccount = await issueGatewayToken(
    umi,
    gatekeeperNetwork.publicKey,
    gatekeeperAuthority,
    umi.identity
  );

  // And a loaded Candy Machine with a gatekeeper guard on that network.
  const collectionMint = (await createCollectionNft(umi)).publicKey;
  const { publicKey: candyMachine } = await createV2(umi, {
    collectionMint,
    configLines: [{ name: 'Degen #1', uri: 'https://example.com/degen/1' }],
    guards: {
      gatekeeper: some({
        gatekeeperNetwork: gatekeeperNetwork.publicKey,
        expireOnUse: false,
      }),
    },
  });

  // When the identity mints from the Candy Machine using its valid token.
  const mint = generateSigner(umi);
  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      mintV2(umi, {
        candyMachine,
        nftMint: mint,
        collectionMint,
        collectionUpdateAuthority: umi.identity.publicKey,
        mintArgs: {
          gatekeeper: some({
            gatekeeperNetwork: gatekeeperNetwork.publicKey,
            expireOnUse: false,
            tokenAccount: gatewayTokenAccount,
          }),
        },
      })
    )
    .sendAndConfirm(umi);

  // Then minting was successful.
  await assertSuccessfulMint(t, umi, { mint, owner: umi.identity });
});

test('it defaults to calculating the gateway token PDA for us', async (t) => {
  // Given a Gatekeeper Network.
  const umi = await createUmi();
  const { gatekeeperNetwork, gatekeeperAuthority } =
    await createGatekeeperNetwork(umi);

  // And given the identity has a valid gateway Token Account from that network.
  await issueGatewayToken(
    umi,
    gatekeeperNetwork.publicKey,
    gatekeeperAuthority,
    umi.identity
  );

  // And a loaded Candy Machine with a gatekeeper guard on that network.
  const collectionMint = (await createCollectionNft(umi)).publicKey;
  const { publicKey: candyMachine } = await createV2(umi, {
    collectionMint,
    configLines: [{ name: 'Degen #1', uri: 'https://example.com/degen/1' }],
    guards: {
      gatekeeper: some({
        gatekeeperNetwork: gatekeeperNetwork.publicKey,
        expireOnUse: false,
      }),
    },
  });

  // When that payer mints from the Candy Machine without passing in its valid token.
  const mint = generateSigner(umi);
  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      mintV2(umi, {
        candyMachine,
        nftMint: mint,
        collectionMint,
        collectionUpdateAuthority: umi.identity.publicKey,
        mintArgs: {
          gatekeeper: some({
            gatekeeperNetwork: gatekeeperNetwork.publicKey,
            expireOnUse: false,
          }),
        },
      })
    )
    .sendAndConfirm(umi);

  // Then minting was still successful.
  await assertSuccessfulMint(t, umi, { mint, owner: umi.identity });
});

test('it allows minting even when the payer is different from the minter', async (t) => {
  // Given a Gatekeeper Network.
  const umi = await createUmi();
  const { gatekeeperNetwork, gatekeeperAuthority } =
    await createGatekeeperNetwork(umi);

  // And a separate minter that has a valid gateway Token Account from that network.
  const minter = generateSigner(umi);
  await issueGatewayToken(
    umi,
    gatekeeperNetwork.publicKey,
    gatekeeperAuthority,
    umi.payer,
    minter.publicKey
  );

  // And a loaded Candy Machine with a gatekeeper guard on that network.
  const collectionMint = (await createCollectionNft(umi)).publicKey;
  const { publicKey: candyMachine } = await createV2(umi, {
    collectionMint,
    configLines: [{ name: 'Degen #1', uri: 'https://example.com/degen/1' }],
    guards: {
      gatekeeper: some({
        gatekeeperNetwork: gatekeeperNetwork.publicKey,
        expireOnUse: false,
      }),
    },
  });

  // When that minter mints from the Candy Machine without passing in its valid token.
  const mint = generateSigner(umi);
  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      mintV2(umi, {
        candyMachine,
        nftMint: mint,
        minter,
        collectionMint,
        collectionUpdateAuthority: umi.identity.publicKey,
        mintArgs: {
          gatekeeper: some({
            gatekeeperNetwork: gatekeeperNetwork.publicKey,
            expireOnUse: false,
          }),
        },
      })
    )
    .sendAndConfirm(umi);

  // Then minting was still successful.
  await assertSuccessfulMint(t, umi, { mint, owner: minter });
});

test('it forbids minting when providing the wrong token', async (t) => {
  // Given a Gatekeeper Network such that the identity
  // has no valid gateway Token Account from that network.
  const umi = await createUmi();
  const { gatekeeperNetwork } = await createGatekeeperNetwork(umi);

  // Given a loaded Candy Machine with a gatekeeper guard.
  const collectionMint = (await createCollectionNft(umi)).publicKey;
  const { publicKey: candyMachine } = await createV2(umi, {
    collectionMint,
    configLines: [{ name: 'Degen #1', uri: 'https://example.com/degen/1' }],
    guards: {
      gatekeeper: some({
        gatekeeperNetwork: gatekeeperNetwork.publicKey,
        expireOnUse: false,
      }),
    },
  });

  // When the payer tries to mint from it with the wrong token.
  const mint = generateSigner(umi);
  const promise = transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      mintV2(umi, {
        candyMachine,
        nftMint: mint,
        collectionMint,
        collectionUpdateAuthority: umi.identity.publicKey,
        mintArgs: {
          gatekeeper: some({
            gatekeeperNetwork: gatekeeperNetwork.publicKey,
            expireOnUse: false,
          }),
        },
      })
    )
    .sendAndConfirm(umi);

  // Then we expect an error.
  await t.throwsAsync(promise, { message: /GatewayTokenInvalid/ });
});

test('it allows minting using gateway tokens that expire when they are still valid', async (t) => {
  // Given a Gatekeeper Network.
  const umi = await createUmi();
  const { gatekeeperNetwork, gatekeeperAuthority } =
    await createGatekeeperNetwork(umi);

  // And given the identity has a valid gateway Token Account
  // from that network that has not yet expired.
  const gatewayTokenAccount = await issueGatewayToken(
    umi,
    gatekeeperNetwork.publicKey,
    gatekeeperAuthority,
    umi.identity,
    umi.identity.publicKey,
    tomorrow()
  );

  // And a loaded Candy Machine with a gatekeeper guard on that network.
  const collectionMint = (await createCollectionNft(umi)).publicKey;
  const { publicKey: candyMachine } = await createV2(umi, {
    collectionMint,
    configLines: [{ name: 'Degen #1', uri: 'https://example.com/degen/1' }],
    guards: {
      gatekeeper: some({
        gatekeeperNetwork: gatekeeperNetwork.publicKey,
        expireOnUse: false,
      }),
    },
  });

  // When that identity mints from the Candy Machine using its non-expired token.
  const mint = generateSigner(umi);
  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      mintV2(umi, {
        candyMachine,
        nftMint: mint,
        collectionMint,
        collectionUpdateAuthority: umi.identity.publicKey,
        mintArgs: {
          gatekeeper: some({
            gatekeeperNetwork: gatekeeperNetwork.publicKey,
            expireOnUse: false,
            tokenAccount: gatewayTokenAccount,
          }),
        },
      })
    )
    .sendAndConfirm(umi);

  // Then minting was successful.
  await assertSuccessfulMint(t, umi, { mint, owner: umi.identity });
});

test('it forbids minting using gateway tokens that have expired', async (t) => {
  // Given a Gatekeeper Network.
  const umi = await createUmi();
  const { gatekeeperNetwork, gatekeeperAuthority } =
    await createGatekeeperNetwork(umi);

  // And given the identity has a gateway Token Account from that network that has expired.
  const expiredGatewayTokenAccount = await issueGatewayToken(
    umi,
    gatekeeperNetwork.publicKey,
    gatekeeperAuthority,
    umi.identity,
    umi.identity.publicKey,
    yesterday()
  );

  // And a loaded Candy Machine with a gatekeeper guard on that network.
  const collectionMint = (await createCollectionNft(umi)).publicKey;
  const { publicKey: candyMachine } = await createV2(umi, {
    collectionMint,
    configLines: [{ name: 'Degen #1', uri: 'https://example.com/degen/1' }],
    guards: {
      gatekeeper: some({
        gatekeeperNetwork: gatekeeperNetwork.publicKey,
        expireOnUse: false,
      }),
    },
  });

  // When the payer tries to mint from the Candy Machine using its expired token.
  const mint = generateSigner(umi);
  const promise = transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      mintV2(umi, {
        candyMachine,
        nftMint: mint,
        collectionMint,
        collectionUpdateAuthority: umi.identity.publicKey,
        mintArgs: {
          gatekeeper: some({
            gatekeeperNetwork: gatekeeperNetwork.publicKey,
            expireOnUse: false,
            tokenAccount: expiredGatewayTokenAccount,
          }),
        },
      })
    )
    .sendAndConfirm(umi);

  // Then we expect an error.
  await t.throwsAsync(promise, { message: /GatewayTokenInvalid/ });
});

test('it may immediately mark gateway tokens as expired after using them', async (t) => {
  // Given a Gatekeeper Network.
  const umi = await createUmi();
  const { gatekeeperNetwork, gatekeeperAuthority } =
    await createGatekeeperNetwork(umi);

  // And given the identity has a valid gateway Token Account
  // from that network that is set to expire tomorrow.
  const tomorrowDateTime = tomorrow();
  const gatewayTokenAccount = await issueGatewayToken(
    umi,
    gatekeeperNetwork.publicKey,
    gatekeeperAuthority,
    umi.identity,
    umi.identity.publicKey,
    tomorrowDateTime
  );
  const gatewayTokenData = await getGatewayTokenData(umi, gatewayTokenAccount);
  t.true(!!gatewayTokenData.expiry, 'Gateway token expires');
  t.is(gatewayTokenData.expiry?.toNumber(), Number(tomorrowDateTime));

  // And a loaded Candy Machine with a gatekeeper guard
  // that mark tokens as expire after using them.
  const collectionMint = (await createCollectionNft(umi)).publicKey;
  const { publicKey: candyMachine } = await createV2(umi, {
    collectionMint,
    configLines: [{ name: 'Degen #1', uri: 'https://example.com/degen/1' }],
    guards: {
      gatekeeper: some({
        gatekeeperNetwork: gatekeeperNetwork.publicKey,
        expireOnUse: true,
      }),
    },
  });

  // When the identity mints from the Candy Machine using its token.
  const mint = generateSigner(umi);
  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      mintV2(umi, {
        candyMachine,
        nftMint: mint,
        collectionMint,
        collectionUpdateAuthority: umi.identity.publicKey,
        mintArgs: {
          gatekeeper: some({
            gatekeeperNetwork: gatekeeperNetwork.publicKey,
            expireOnUse: true,
            tokenAccount: gatewayTokenAccount,
          }),
        },
      })
    )
    .sendAndConfirm(umi);

  // Then minting was successful.
  await assertSuccessfulMint(t, umi, { mint, owner: umi.identity });

  // And the gateway token is now expired.
  const updatedGatewayTokenData = await getGatewayTokenData(
    umi,
    gatewayTokenAccount
  );
  t.true(!!updatedGatewayTokenData.expiry, 'Gateway token expires');
  const updateExpiry = updatedGatewayTokenData.expiry?.toNumber() as number;
  t.true(
    updateExpiry < tomorrowDateTime,
    'Gateway token expiry date was shortened'
  );
});

test('it charges a bot tax when trying to mint using the wrong token', async (t) => {
  // Given a Gatekeeper Network such that the identity doesn't
  // have a valid gateway Token Account from that network.
  const umi = await createUmi();
  const { gatekeeperNetwork } = await createGatekeeperNetwork(umi);

  // Given a loaded Candy Machine with a gatekeeper guard and a botTax guard.
  const collectionMint = (await createCollectionNft(umi)).publicKey;
  const { publicKey: candyMachine } = await createV2(umi, {
    collectionMint,
    configLines: [{ name: 'Degen #1', uri: 'https://example.com/degen/1' }],
    guards: {
      botTax: some({ lamports: sol(0.1), lastInstruction: true }),
      gatekeeper: some({
        gatekeeperNetwork: gatekeeperNetwork.publicKey,
        expireOnUse: false,
      }),
    },
  });

  // When the identity tries to mint from it with no valid token.
  const mint = generateSigner(umi);
  const { signature } = await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      mintV2(umi, {
        candyMachine,
        nftMint: mint,
        collectionMint,
        collectionUpdateAuthority: umi.identity.publicKey,
        mintArgs: {
          gatekeeper: some({
            gatekeeperNetwork: gatekeeperNetwork.publicKey,
            expireOnUse: false,
          }),
        },
      })
    )
    .sendAndConfirm(umi);

  // Then we expect a bot tax error.
  await assertBotTax(t, umi, mint, signature, /GatewayTokenInvalid/);
});

const createGatekeeperNetwork = async (
  umi: Umi
): Promise<{
  gatekeeperNetwork: Signer;
  gatekeeperAuthority: Signer;
}> => {
  // Prepare the accounts.
  const gatekeeperAuthority = await generateSignerWithSol(umi, sol(10));
  const gatekeeperNetwork = generateSigner(umi);
  const s = umi.serializer;
  const gatewayProgram = umi.programs.getPublicKey('civicGateway');
  const [gatekeeperAccount] = umi.eddsa.findPda(gatewayProgram, [
    s.publicKey().serialize(gatekeeperAuthority),
    s.publicKey().serialize(gatekeeperNetwork),
    s.string({ size: 'variable' }).serialize('gatekeeper'),
  ]);

  // Create the gatekeeper network.
  await transactionBuilder()
    .add({
      instruction: fromWeb3JsInstruction(
        addGatekeeper(
          toWeb3JsPublicKey(gatekeeperAuthority.publicKey),
          toWeb3JsPublicKey(gatekeeperAccount),
          toWeb3JsPublicKey(gatekeeperAuthority.publicKey),
          toWeb3JsPublicKey(gatekeeperNetwork.publicKey)
        )
      ),
      signers: [gatekeeperAuthority, gatekeeperNetwork],
      bytesCreatedOnChain: 0,
    })
    .sendAndConfirm(umi);

  // Add the expire feature to the gatekeeper network.
  await transactionBuilder()
    .add({
      instruction: fromWeb3JsInstruction(
        await addFeatureToNetwork(
          toWeb3JsPublicKey(gatekeeperAuthority.publicKey),
          toWeb3JsPublicKey(gatekeeperNetwork.publicKey),
          new NetworkFeature({ userTokenExpiry: new UserTokenExpiry({}) })
        )
      ),
      signers: [gatekeeperAuthority, gatekeeperNetwork],
      bytesCreatedOnChain: 0,
    })
    .sendAndConfirm(umi);

  return { gatekeeperNetwork, gatekeeperAuthority };
};

const issueGatewayToken = async (
  umi: Umi,
  gatekeeperNetwork: PublicKey,
  gatekeeperAuthority: Signer,
  payer: Signer,
  owner?: PublicKey,
  expiryDate?: DateTimeInput,
  seeds = [0, 0, 0, 0, 0, 0, 0, 0]
): Promise<PublicKey> => {
  owner = owner ?? payer.publicKey;
  const s = umi.serializer;
  const gatewayProgram = umi.programs.getPublicKey('civicGateway');
  const [gatekeeperAccount] = umi.eddsa.findPda(gatewayProgram, [
    s.publicKey().serialize(gatekeeperAuthority),
    s.publicKey().serialize(gatekeeperNetwork),
    s.string({ size: 'variable' }).serialize('gatekeeper'),
  ]);
  const [gatewayTokenAccount] = umi.eddsa.findPda(gatewayProgram, [
    s.publicKey().serialize(owner),
    s.string({ size: 'variable' }).serialize('gateway'),
    s.array(s.u8(), { size: 8 }).serialize(seeds),
    s.publicKey().serialize(gatekeeperNetwork),
  ]);

  await transactionBuilder()
    .add({
      instruction: fromWeb3JsInstruction(
        issue(
          toWeb3JsPublicKey(gatewayTokenAccount),
          toWeb3JsPublicKey(payer.publicKey),
          toWeb3JsPublicKey(gatekeeperAccount),
          toWeb3JsPublicKey(owner),
          toWeb3JsPublicKey(gatekeeperAuthority.publicKey),
          toWeb3JsPublicKey(gatekeeperNetwork),
          new Uint8Array(seeds),
          expiryDate ? Number(dateTime(expiryDate)) : undefined
        )
      ),
      signers: [payer, gatekeeperAuthority],
      bytesCreatedOnChain: 0,
    })
    .sendAndConfirm(umi);

  return gatewayTokenAccount;
};

const getGatewayTokenData = async (
  umi: Umi,
  gatewayTokenAccount: PublicKey
): Promise<GatewayTokenData> => {
  const account = await umi.rpc.getAccount(gatewayTokenAccount);
  assertAccountExists(account);

  return GatewayTokenData.fromAccount(Buffer.from(account.data));
};
