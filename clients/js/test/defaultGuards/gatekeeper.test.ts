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
import test from 'ava';
import { Buffer } from 'buffer';
import {
  addGatekeeper,
  issueVanilla,
  addFeatureToNetwork,
  NetworkFeature,
  UserTokenExpiry,
  GatewayTokenData,
} from '@identity.com/solana-gateway-ts';
import {
  fromWeb3JsInstruction,
  toWeb3JsPublicKey,
} from '@metaplex-foundation/umi-web3js-adapters';
import { generateSignerWithSol } from '@metaplex-foundation/umi-bundle-tests';
import { setComputeUnitLimit } from '@metaplex-foundation/mpl-essentials';
import {
  assertSuccessfulMint,
  createCollectionNft,
  createUmi,
  createV2,
} from '../_setup';
import { mintV2 } from '../../src';

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
  await transactionBuilder(umi)
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
    .sendAndConfirm();

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
  await transactionBuilder(umi)
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
    .sendAndConfirm();

  // Then minting was still successful.
  await assertSuccessfulMint(t, umi, { mint, owner: umi.identity });
});

// test('it forbids minting when providing the wrong token', async (t) => {
//   // Given a Gatekeeper Network.
//   const umi = await createUmi();
//   const { gatekeeperNetwork } = await createGatekeeperNetwork(umi);

//   // And a payer without a valid gateway Token Account from that network.
//   const payer = await generateSignerWithSol(umi, sol(10));
//   const wrongToken = generateSigner(umi).publicKey;

//   // Given a loaded Candy Machine with a gatekeeper guard.
//   const collectionMint = (await createCollectionNft(umi)).publicKey;
//   const { publicKey: candyMachine } = await createV2(umi, {
//     collectionMint,

//     configLines: [{ name: 'Degen #1', uri: 'https://example.com/degen/1' }],
//     guards: {
//       gatekeeper: {
//         network: gatekeeperNetwork.publicKey,
//         expireOnUse: false,
//       },
//     },
//   });

//   // When the payer tries to mint from it with the wrong token.
//   const mint = generateSigner(umi);
//   const promise = transactionBuilder(umi).add().sendAndConfirm();
//   mintV2(
//     umi,
//     {
//       candyMachine,
//       collectionUpdateAuthority: collection.updateAuthority.publicKey,
//       guards: {
//         gatekeeper: {
//           tokenAccount: wrongToken,
//         },
//       },
//     },
//     { payer }
//   );

//   // Then we expect an error.
//   await t.throwsAsync(promise, { message: /Gateway token is not valid/ });
// });

// test('it allows minting using gateway tokens that expire when they are still valid', async (t) => {
//   // Given a Gatekeeper Network.
//   const umi = await createUmi();
//   const { gatekeeperNetwork, gatekeeperAuthority } =
//     await createGatekeeperNetwork(umi);

//   // And a payer with a valid gateway Token Account from that network
//   // that has not yet expired.
//   const payer = await generateSignerWithSol(umi, sol(10));
//   const gatewayTokenAccount = await issueGatewayToken(
//     umi,
//     gatekeeperNetwork.publicKey,
//     gatekeeperAuthority,
//     payer,
//     toDateTime(now().addn(SECONDS_IN_A_DAY)) // Tomorrow.
//   );

//   // And a loaded Candy Machine with a gatekeeper guard on that network.
//   const collectionMint = (await createCollectionNft(umi)).publicKey;
//   const { publicKey: candyMachine } = await createV2(umi, {
//     collectionMint,

//     configLines: [{ name: 'Degen #1', uri: 'https://example.com/degen/1' }],
//     guards: {
//       gatekeeper: {
//         network: gatekeeperNetwork.publicKey,
//         expireOnUse: false,
//       },
//     },
//   });

//   // When that payer mints from the Candy Machine using its non-expired token.
//   const mint = generateSigner(umi);
//   await transactionBuilder(umi).add().sendAndConfirm();
//   mintV2(
//     umi,
//     {
//       candyMachine,
//       collectionUpdateAuthority: collection.updateAuthority.publicKey,
//       guards: {
//         gatekeeper: {
//           tokenAccount: gatewayTokenAccount,
//         },
//       },
//     },
//     { payer }
//   );

//   // Then minting was successful.
//   await assertSuccessfulMint(
//     t,
//     umi,
//     { mint, owner: minter },
//     {
//       candyMachine,
//       collectionUpdateAuthority: collection.updateAuthority.publicKey,
//       nft,
//       owner: payer.publicKey,
//     }
//   );
// });

// test('it forbids minting using gateway tokens that have expired', async (t) => {
//   // Given a Gatekeeper Network.
//   const umi = await createUmi();
//   const { gatekeeperNetwork, gatekeeperAuthority } =
//     await createGatekeeperNetwork(umi);

//   // And a payer with a gateway Token Account from that network that has expired.
//   const payer = await generateSignerWithSol(umi, sol(10));
//   const expiredGatewayTokenAccount = await issueGatewayToken(
//     umi,
//     gatekeeperNetwork.publicKey,
//     gatekeeperAuthority,
//     payer,
//     toDateTime(now().subn(SECONDS_IN_A_DAY)) // Yesterday.
//   );

//   // And a loaded Candy Machine with a gatekeeper guard on that network.
//   const collectionMint = (await createCollectionNft(umi)).publicKey;
//   const { publicKey: candyMachine } = await createV2(umi, {
//     collectionMint,

//     configLines: [{ name: 'Degen #1', uri: 'https://example.com/degen/1' }],
//     guards: {
//       gatekeeper: {
//         network: gatekeeperNetwork.publicKey,
//         expireOnUse: false,
//       },
//     },
//   });

//   // When the payer tries to mint from the Candy Machine using its expired token.
//   const mint = generateSigner(umi);
//   const promise = transactionBuilder(umi).add().sendAndConfirm();
//   mintV2(
//     umi,
//     {
//       candyMachine,
//       collectionUpdateAuthority: collection.updateAuthority.publicKey,
//       guards: {
//         gatekeeper: {
//           tokenAccount: expiredGatewayTokenAccount,
//         },
//       },
//     },
//     { payer }
//   );

//   // Then we expect an error.
//   await t.throwsAsync(promise, { message: /Gateway token is not valid/ });
// });

// test('it may immediately mark gateway tokens as expired after using them', async (t) => {
//   // Given a Gatekeeper Network.
//   const umi = await createUmi();
//   const { gatekeeperNetwork, gatekeeperAuthority } =
//     await createGatekeeperNetwork(umi);

//   // And a payer with a valid gateway Token Account from that network
//   // that is set to expire tomorrow.
//   const payer = await generateSignerWithSol(umi, sol(10));
//   const tomorrowDateTime = toDateTime(now().addn(SECONDS_IN_A_DAY));
//   const gatewayTokenAccount = await issueGatewayToken(
//     umi,
//     gatekeeperNetwork.publicKey,
//     gatekeeperAuthority,
//     payer,
//     tomorrowDateTime
//   );
//   const gatewayTokenData = await getGatewayTokenData(umi, gatewayTokenAccount);
//   t.true(!!gatewayTokenData.expiry, 'Gateway token expires');
//   t.iss(gatewayTokenData.expiry?.toNumber(), tomorrowDateTime.toNumber());

//   // And a loaded Candy Machine with a gatekeeper guard
//   // that mark tokens as expire after using them.
//   const collectionMint = (await createCollectionNft(umi)).publicKey;
//   const { publicKey: candyMachine } = await createV2(umi, {
//     collectionMint,

//     configLines: [{ name: 'Degen #1', uri: 'https://example.com/degen/1' }],
//     guards: {
//       gatekeeper: {
//         network: gatekeeperNetwork.publicKey,
//         expireOnUse: true,
//       },
//     },
//   });

//   // When that payer mints from the Candy Machine using its token.
//   const mint = generateSigner(umi);
//   await transactionBuilder(umi).add().sendAndConfirm();
//   mintV2(
//     umi,
//     {
//       candyMachine,
//       collectionUpdateAuthority: collection.updateAuthority.publicKey,
//       guards: {
//         gatekeeper: {
//           tokenAccount: gatewayTokenAccount,
//         },
//       },
//     },
//     { payer }
//   );

//   // Then minting was successful.
//   await assertSuccessfulMint(
//     t,
//     umi,
//     { mint, owner: minter },
//     {
//       candyMachine,
//       collectionUpdateAuthority: collection.updateAuthority.publicKey,
//       nft,
//       owner: payer.publicKey,
//     }
//   );

//   // And the gateway token is now expired.
//   const updatedGatewayTokenData = await getGatewayTokenData(
//     umi,
//     gatewayTokenAccount
//   );
//   t.true(!!updatedGatewayTokenData.expiry, 'Gateway token expires');
//   const updateExpiry = updatedGatewayTokenData.expiry?.toNumber() as number;
//   t.true(
//     updateExpiry < tomorrowDateTime.toNumber(),
//     'Gateway token expiry date was shortened'
//   );
// });

// test('it charges a bot tax when trying to mint using the wrong token', async (t) => {
//   // Given a Gatekeeper Network.
//   const umi = await createUmi();
//   const { gatekeeperNetwork } = await createGatekeeperNetwork(umi);

//   // And a payer without a valid gateway Token Account from that network.
//   const payer = await generateSignerWithSol(umi, sol(10));
//   const wrongToken = generateSigner(umi).publicKey;

//   // Given a loaded Candy Machine with a gatekeeper guard and a botTax guard.
//   const collectionMint = (await createCollectionNft(umi)).publicKey;
//   const { publicKey: candyMachine } = await createV2(umi, {
//     collectionMint,

//     configLines: [{ name: 'Degen #1', uri: 'https://example.com/degen/1' }],
//     guards: {
//       botTax: {
//         lamports: sol(0.1),
//         lastInstruction: true,
//       },
//       gatekeeper: {
//         network: gatekeeperNetwork.publicKey,
//         expireOnUse: false,
//       },
//     },
//   });

//   // When the payer tries to mint from it with the wrong token.
//   const mint = generateSigner(umi);
//   const promise = transactionBuilder(umi).add().sendAndConfirm();
//   mintV2(
//     umi,
//     {
//       candyMachine,
//       collectionUpdateAuthority: collection.updateAuthority.publicKey,
//       guards: {
//         gatekeeper: {
//           tokenAccount: wrongToken,
//         },
//       },
//     },
//     { payer }
//   );

//   // Then we expect a bot tax error.
//   await t.throwsAsync(promise, { message: /CandyMachineBotTaxError/ });

//   // And the payer was charged a bot tax.
//   const payerBalance = await umi.rpc.getBalance(payer.publicKey);
//   t.true(
//     isEqualToAmount(payerBalance, sol(9.9), sol(0.01)),
//     'payer was charged a bot tax'
//   );
// });

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
  const gatekeeperAccount = umi.eddsa.findPda(gatewayProgram, [
    s.publicKey().serialize(gatekeeperAuthority),
    s.publicKey().serialize(gatekeeperNetwork),
    s.string({ size: 'variable' }).serialize('gatekeeper'),
  ]);

  // Create the gatekeeper network.
  await transactionBuilder(umi)
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
    .sendAndConfirm();

  // Add the expire feature to the gatekeeper network.
  await transactionBuilder(umi)
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
    .sendAndConfirm();

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
  const s = umi.serializer;
  const gatewayProgram = umi.programs.getPublicKey('civicGateway');
  const gatekeeperAccount = umi.eddsa.findPda(gatewayProgram, [
    s.publicKey().serialize(gatekeeperAuthority),
    s.publicKey().serialize(gatekeeperNetwork),
    s.string({ size: 'variable' }).serialize('gatekeeper'),
  ]);
  const gatewayTokenAccount = umi.eddsa.findPda(gatewayProgram, [
    s.publicKey().serialize(payer),
    s.string({ size: 'variable' }).serialize('gateway'),
    s.array(s.u8(), { size: 8 }).serialize(seeds),
    s.publicKey().serialize(gatekeeperNetwork),
  ]);

  await transactionBuilder(umi)
    .add({
      instruction: fromWeb3JsInstruction(
        issueVanilla(
          toWeb3JsPublicKey(gatewayTokenAccount),
          toWeb3JsPublicKey(payer.publicKey),
          toWeb3JsPublicKey(gatekeeperAccount),
          toWeb3JsPublicKey(owner ?? payer.publicKey),
          toWeb3JsPublicKey(gatekeeperAuthority.publicKey),
          toWeb3JsPublicKey(gatekeeperNetwork),
          new Uint8Array(seeds),
          expiryDate ? Number(dateTime(expiryDate)) : undefined
        )
      ),
      signers: [payer, gatekeeperAuthority],
      bytesCreatedOnChain: 0,
    })
    .sendAndConfirm();

  return gatewayTokenAccount;
};

export const getGatewayTokenData = async (
  umi: Umi,
  gatewayTokenAccount: PublicKey
): Promise<GatewayTokenData> => {
  const account = await umi.rpc.getAccount(gatewayTokenAccount);
  assertAccountExists(account);

  return GatewayTokenData.fromAccount(Buffer.from(account.data));
};
