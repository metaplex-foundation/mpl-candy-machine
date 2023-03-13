import {
  createMintWithAssociatedToken,
  fetchToken,
  findAssociatedTokenPda,
  setComputeUnitLimit,
  TokenState,
} from '@metaplex-foundation/mpl-essentials';
import {
  generateSigner,
  Option,
  PublicKey,
  sol,
  some,
  transactionBuilder,
  Umi,
} from '@metaplex-foundation/umi';
import test from 'ava';
import { mintV2, route } from '../../src';
import {
  assertSuccessfulMint,
  createCollectionNft,
  createUmi,
  createV2,
} from '../_setup';

test.skip('it transfers SOL to an escrow account and freezes the NFT', async (t) => {
  // Given a loaded Candy Machine with a freezeSolPayment guard.
  const umi = await createUmi();
  const destination = generateSigner(umi).publicKey;
  const collectionMint = (await createCollectionNft(umi)).publicKey;
  const { publicKey: candyMachine } = await createV2(umi, {
    collectionMint,
    configLines: [
      { name: 'Degen #1', uri: 'https://example.com/degen/1' },
      { name: 'Degen #2', uri: 'https://example.com/degen/2' },
    ],
    guards: {
      freezeSolPayment: some({ lamports: sol(1), destination }),
    },
  });

  // And given the freezeSolPayment guard is initialized.
  await transactionBuilder(umi)
    .add(
      route(umi, {
        candyMachine,
        guard: 'freezeSolPayment',
        routeArgs: {
          path: 'initialize',
          period: 15 * 24 * 3600, // 15 days.
          candyGuardAuthority: umi.identity,
          destination,
        },
      })
    )
    .sendAndConfirm();

  // When we mint from that candy machine.
  const mint = generateSigner(umi);
  await transactionBuilder(umi)
    .add(
      mintV2(umi, {
        candyMachine,
        nftMint: mint,
        collectionMint,
        collectionUpdateAuthority: umi.identity.publicKey,
        mintArgs: { freezeSolPayment: some({ destination }) },
      })
    )
    .sendAndConfirm();

  // Then minting was successful.
  await assertSuccessfulMint(t, umi, { mint, owner: umi.identity });

  // And the NFT is frozen.
  const ata = findAssociatedTokenPda(umi, {
    mint: mint.publicKey,
    owner: umi.identity.publicKey,
  });
  const tokenAccount = await fetchToken(umi, ata);
  t.is(tokenAccount.state, TokenState.Frozen);

  // And cannot be thawed since not all NFTs have been minted.
  const promise = thawNft(
    umi,
    candyMachine,
    destination,
    mint.publicKey,
    umi.identity.publicKey
  );
  await t.throwsAsync(promise, { message: /Thaw is not enabled TODO/ });

  // // And the treasury escrow received SOLs.
  // const treasuryEscrow = getFreezeEscrow(umi, candyMachine, treasury);
  // const treasuryEscrowBalance = await umi.rpc.getBalance(treasuryEscrow);
  // t.true(
  //   isEqualToAmount(treasuryEscrowBalance, sol(1), sol(0.1)),
  //   'treasury escrow received SOLs'
  // );

  // // And was assigned the right data.
  // const freezeEscrowAccount = await FreezeEscrow.fromAccountAddress(
  //   umi.connection,
  //   treasuryEscrow
  // );
  // t.like(freezeEscrowAccount, {
  //   $topic: 'freeze escrow account',
  //   candyMachine: spokSamePubkey(candyMachine.address),
  //   candyGuard: spokSamePubkey(candyMachine.candyGuard!.address),
  //   frozenCount: spokSameBignum(1),
  //   firstMintTime: spok.definedObject,
  //   freezePeriod: spokSameBignum(15 * 24 * 3600),
  //   destination: spokSamePubkey(treasury.publicKey),
  //   authority: spokSamePubkey(candyMachine.candyGuard!.authorityAddress),
  // });

  // // And the payer lost SOLs.
  // const payerBalance = await umi.rpc.getBalance(payer.publicKey);
  // t.true(isEqualToAmount(payerBalance, sol(9), sol(0.1)), 'payer lost SOLs');
});

// TODO: it allows minting even when the payer is different from the minter

test('it allows minting when the mint and token accounts are created beforehand', async (t) => {
  // Given a loaded Candy Machine with a freezeSolPayment guard.
  const umi = await createUmi();
  const destination = generateSigner(umi).publicKey;
  const collectionMint = (await createCollectionNft(umi)).publicKey;
  const { publicKey: candyMachine } = await createV2(umi, {
    collectionMint,
    configLines: [
      { name: 'Degen #1', uri: 'https://example.com/degen/1' },
      { name: 'Degen #2', uri: 'https://example.com/degen/2' },
    ],
    guards: {
      freezeSolPayment: some({ lamports: sol(1), destination }),
    },
  });

  // And given the freezeSolPayment guard is initialized.
  await initFreezeEscrow(umi, candyMachine, destination);

  // When we mint from that candy machine using a separate minter.
  const mint = generateSigner(umi);
  await transactionBuilder(umi)
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      createMintWithAssociatedToken(umi, {
        mint,
        owner: umi.identity.publicKey,
      })
    )
    .add(
      mintV2(umi, {
        candyMachine,
        nftMint: mint.publicKey,
        collectionMint,
        collectionUpdateAuthority: umi.identity.publicKey,
        mintArgs: { freezeSolPayment: some({ destination }) },
      })
    )
    .sendAndConfirm();

  // Then minting was successful.
  await assertSuccessfulMint(t, umi, { mint, owner: umi.identity });
});

// test('it can thaw an NFT once all NFTs are minted', async (t) => {
//   // Given a loaded Candy Machine with an initialized
//   // freezeSolPayment guard with only one item.
//   const umi = await createUmi();
//   const treasury = generateSigner(umi);
//   const collectionMint = (await createCollectionNft(umi)).publicKey;
//   const { publicKey: candyMachine } = await createV2(umi, {
//     collectionMint,

//     configLines: [{ name: 'Degen #1', uri: 'https://example.com/degen/1' }],
//     guards: {
//       freezeSolPayment: {
//         amount: sol(1),
//         destination: treasury.publicKey,
//       },
//     },
//   });
//   await initFreezeEscrow(umi, candyMachine);

//   // And given we minted the only frozen NFT from that candy machine.
//   const payer = await generateSignerWithSol(umi, sol(10));
//   const nft = await mintNft(umi, candyMachine, collection, payer);
//   t.is(nft.token.state, AccountState.Frozen, 'NFT is frozen');

//   // When we thaw the NFT.
//   await thawNft(umi, candyMachine, nft.address, payer.publicKey);

//   // Then the NFT is thawed.
//   const refreshedNft = await umi.nfts().refresh(nft);
//   t.is(refreshedNft.token.state, AccountState.Initialized, 'NFT is Thawed');
// });

// test('it can unlock funds once all NFTs have been thawed', async (t) => {
//   // Given a loaded Candy Machine with an initialized freezeSolPayment guard.
//   const umi = await createUmi();
//   const treasury = generateSigner(umi);
//   const collectionMint = (await createCollectionNft(umi)).publicKey;
//   const { publicKey: candyMachine } = await createV2(umi, {
//     collectionMint,

//     configLines: [{ name: 'Degen #1', uri: 'https://example.com/degen/1' }],
//     guards: {
//       freezeSolPayment: {
//         amount: sol(1),
//         destination: treasury.publicKey,
//       },
//     },
//   });
//   await initFreezeEscrow(umi, candyMachine);

//   // And given all NFTs have been minted and thawed.
//   const payer = await generateSignerWithSol(umi, sol(10));
//   const nft = await mintNft(umi, candyMachine, collection, payer);
//   await thawNft(umi, candyMachine, nft.address, payer.publicKey);

//   // When the authority unlocks the funds.
//   await transactionBuilder(umi).add().sendAndConfirm();
//   route(umi, {
//     candyMachine,
//     guard: 'freezeSolPayment',
//     routeArgs: {
//       path: 'unlockFunds',
//       candyGuardAuthority: umi.identity(),
//     },
//   });

//   // Then the destination wallet received the funds.
//   const treasuryBalance = await umi.rpc.getBalance(treasury.publicKey);
//   t.true(
//     isEqualToAmount(treasuryBalance, sol(1), sol(0.1)),
//     'treasury received SOLs'
//   );

//   // And the treasury escrow has been emptied.
//   const treasuryEscrow = getFreezeEscrow(umi, candyMachine, treasury);
//   const treasuryEscrowBalance = await umi.rpc.getBalance(treasuryEscrow);
//   t.true(
//     isEqualToAmount(treasuryEscrowBalance, sol(0)),
//     'treasury escrow received SOLs'
//   );
// });

// test('it cannot unlock funds if not all NFTs have been thawed', async (t) => {
//   // Given a loaded Candy Machine with an initialized freezeSolPayment guard.
//   const umi = await createUmi();
//   const treasury = generateSigner(umi);
//   const collectionMint = (await createCollectionNft(umi)).publicKey;
//   const { publicKey: candyMachine } = await createV2(umi, {
//     collectionMint,

//     configLines: [{ name: 'Degen #1', uri: 'https://example.com/degen/1' }],
//     guards: {
//       freezeSolPayment: {
//         amount: sol(1),
//         destination: treasury.publicKey,
//       },
//     },
//   });
//   await initFreezeEscrow(umi, candyMachine);

//   // And given all NFTs have been minted but not thawed.
//   const payer = await generateSignerWithSol(umi, sol(10));
//   await mintNft(umi, candyMachine, collection, payer);

//   // When the authority tries to unlock the funds.
//   const promise = umi.candyMachines().callGuardRoute({
//     candyMachine,
//     guard: 'freezeSolPayment',
//     routeArgs: {
//       path: 'unlockFunds',
//       candyGuardAuthority: umi.identity(),
//     },
//   });

//   // Then we expect an error.
//   await assertThrows(
//     t,
//     promise,
//     /Unlock is not enabled \(not all NFTs are thawed\)/
//   );

//   // And the destination wallet did not receive any funds.
//   const treasuryBalance = await umi.rpc.getBalance(treasury.publicKey);
//   t.true(isEqualToAmount(treasuryBalance, sol(0)), 'treasury received no SOLs');
// });

// test('it can have multiple freeze escrow and reuse the same ones', async (t) => {
//   // Given a loaded Candy Machine with 4 groups
//   // containing freezeSolPayment guards such that:
//   // - Group A and Group B use the same destination (and thus freeze escrow).
//   // - Group C uses a different destination than group A and B.
//   // - Group D does not use a freezeSolPayment guard at all.
//   const umi = await createUmi();
//   const treasuryAB = generateSigner(umi);
//   const treasuryC = generateSigner(umi);
//   const treasuryD = generateSigner(umi);
//   const collectionMint = (await createCollectionNft(umi)).publicKey;
//   const { publicKey: candyMachine } = await createV2(umi, {
//     collectionMint,

//     configLines: [
//       { name: 'Degen #1', uri: 'https://example.com/degen/1' },
//       { name: 'Degen #2', uri: 'https://example.com/degen/2' },
//       { name: 'Degen #3', uri: 'https://example.com/degen/3' },
//       { name: 'Degen #4', uri: 'https://example.com/degen/4' },
//     ],
//     guards: {},
//     groups: [
//       {
//         label: 'GROUPA',
//         guards: {
//           freezeSolPayment: {
//             amount: sol(0.5),
//             destination: treasuryAB.publicKey,
//           },
//         },
//       },
//       {
//         label: 'GROUPB',
//         guards: {
//           freezeSolPayment: {
//             amount: sol(1),
//             destination: treasuryAB.publicKey,
//           },
//         },
//       },
//       {
//         label: 'GROUPC',
//         guards: {
//           freezeSolPayment: {
//             amount: sol(2),
//             destination: treasuryC.publicKey,
//           },
//         },
//       },
//       {
//         label: 'GROUPD',
//         guards: {
//           solPayment: {
//             amount: sol(3),
//             destination: treasuryD.publicKey,
//           },
//         },
//       },
//     ],
//   });

//   // And given all freeze escrows have been initialized.
//   await initFreezeEscrow(umi, candyMachine, 'GROUPA');
//   await initFreezeEscrow(umi, candyMachine, 'GROUPC');

//   // Note that trying to initialize the escrow for group B will fail
//   // because it has already been initialized via group A.
//   await assertThrows(
//     t,
//     initFreezeEscrow(umi, candyMachine, 'GROUPB'),
//     /The freeze escrow account already exists/
//   );

//   // When we mint all 4 NFTs via each group.
//   const payer = await generateSignerWithSol(umi, sol(10));
//   const nftA = await mintNft(umi, candyMachine, collection, payer, 'GROUPA'); // 0.5 SOL
//   const nftB = await mintNft(umi, candyMachine, collection, payer, 'GROUPB'); // 1 SOL
//   const nftC = await mintNft(umi, candyMachine, collection, payer, 'GROUPC'); // 2 SOL
//   const nftD = await mintNft(umi, candyMachine, collection, payer, 'GROUPD'); // 3 SOL

//   // Then all NFTs except for group D have been frozen.
//   t.is(nftA.token.state, AccountState.Frozen, 'NFT A is frozen');
//   t.is(nftB.token.state, AccountState.Frozen, 'NFT B is frozen');
//   t.is(nftC.token.state, AccountState.Frozen, 'NFT C is frozen');
//   t.is(nftD.token.state, AccountState.Initialized, 'NFT D is not frozen');

//   // And the treasury escrow received SOLs.
//   const treasuryEscrowAB = getFreezeEscrow(umi, candyMachine, treasuryAB);
//   const treasuryEscrowC = getFreezeEscrow(umi, candyMachine, treasuryC);
//   const treasuryEscrowBalanceAB = await umi.rpc.getBalance(treasuryEscrowAB);
//   const treasuryEscrowBalanceC = await umi.rpc.getBalance(treasuryEscrowC);
//   t.true(
//     isEqualToAmount(treasuryEscrowBalanceAB, sol(1.5), sol(0.1)),
//     'treasury AB escrow received SOLs'
//   );
//   t.true(
//     isEqualToAmount(treasuryEscrowBalanceC, sol(2), sol(0.1)),
//     'treasury C escrow received SOLs'
//   );

//   // And the payer lost SOLs.
//   const payerBalance = await umi.rpc.getBalance(payer.publicKey);
//   t.true(
//     isEqualToAmount(payerBalance, sol(10 - 6.5), sol(0.1)),
//     'payer lost SOLs'
//   );

//   // And the frozen counters securely decrease as we thaw all frozen NFTs.
//   const assertFrozenCounts = async (ab: number, c: number) => {
//     await Promise.all([
//       assertFrozenCount(t, umi, candyMachine, treasuryAB, ab),
//       assertFrozenCount(t, umi, candyMachine, treasuryC, c),
//     ]);
//   };
//   await assertFrozenCounts(2, 1);
//   await thawNft(umi, candyMachine, nftD.address, payer.publicKey, 'GROUPA'); // Not frozen.
//   await assertFrozenCounts(2, 1); // No change.
//   await thawNft(umi, candyMachine, nftA.address, payer.publicKey, 'GROUPA');
//   await assertFrozenCounts(1, 1); // AB decreased.
//   await thawNft(umi, candyMachine, nftA.address, payer.publicKey, 'GROUPA'); // Already thawed.
//   await assertFrozenCounts(1, 1); // No change.
//   await thawNft(umi, candyMachine, nftB.address, payer.publicKey, 'GROUPB');
//   await assertFrozenCounts(0, 1); // AB decreased.
//   await thawNft(umi, candyMachine, nftC.address, payer.publicKey, 'GROUPC');
//   await assertFrozenCounts(0, 0); // C decreased.

//   // And when the authority unlocks the funds of both freeze escrows.
//   await unlockFunds(umi, candyMachine, 'GROUPA');
//   await unlockFunds(umi, candyMachine, 'GROUPC');

//   // Note that trying to unlock the funds of group B will fail
//   // because it has already been unlocked via group A.
//   await assertThrows(
//     t,
//     unlockFunds(umi, candyMachine, 'GROUPB'),
//     /The program expected this account to be already initialized/
//   );

//   // Then the treasuries received the funds.
//   const treasuryBalanceAB = await umi.rpc.getBalance(treasuryAB.publicKey);
//   const treasuryBalanceC = await umi.rpc.getBalance(treasuryC.publicKey);
//   const treasuryBalanceD = await umi.rpc.getBalance(treasuryD.publicKey);
//   t.true(
//     isEqualToAmount(treasuryBalanceAB, sol(1.5), sol(0.1)),
//     'treasury AB received the funds'
//   );
//   t.true(
//     isEqualToAmount(treasuryBalanceC, sol(2), sol(0.1)),
//     'treasury C  received the funds'
//   );
//   t.true(
//     isEqualToAmount(treasuryBalanceD, sol(3), sol(0.1)),
//     'treasury D  received the funds'
//   );

//   // And the treasury escrows are empty.
//   const newEscrowBalanceAB = await umi.rpc.getBalance(treasuryEscrowAB);
//   const newEscrowBalanceC = await umi.rpc.getBalance(treasuryEscrowC);
//   t.true(
//     isEqualToAmount(newEscrowBalanceAB, sol(0)),
//     'treasury AB escrow is empty'
//   );
//   t.true(
//     isEqualToAmount(newEscrowBalanceC, sol(0)),
//     'treasury C escrow is empty'
//   );
// });

// test('it fails to mint if the freeze escrow was not initialized', async (t) => {
//   // Given a loaded Candy Machine with a freezeSolPayment guard.
//   const umi = await createUmi();
//   const treasury = generateSigner(umi);
//   const collectionMint = (await createCollectionNft(umi)).publicKey;
//   const { publicKey: candyMachine } = await createV2(umi, {
//     collectionMint,

//     configLines: [{ name: 'Degen #1', uri: 'https://example.com/degen/1' }],
//     guards: {
//       freezeSolPayment: {
//         amount: sol(1),
//         destination: treasury.publicKey,
//       },
//     },
//   });

//   // When we try to mint without initializing the freeze escrow.
//   const payer = await generateSignerWithSol(umi, sol(10));
//   const mint = generateSigner(umi);
//   const promise = transactionBuilder(umi).add().sendAndConfirm();
//   mintV2(
//     umi,
//     {
//       candyMachine,
//       collectionUpdateAuthority: collection.updateAuthority.publicKey,
//     },
//     { payer }
//   );

//   // Then we expect an error.
//   await t.throwsAsync(promise, { message: /Freeze must be initialized/ });

//   // And the payer didn't loose any SOL.
//   const payerBalance = await umi.rpc.getBalance(payer.publicKey);
//   t.true(isEqualToAmount(payerBalance, sol(10)), 'payer did not lose SOLs');
// });

// test('it fails to mint if the payer does not have enough funds', async (t) => {
//   // Given a loaded Candy Machine with an initialized
//   // freezeSolPayment guard costing 5 SOLs.
//   const umi = await createUmi();
//   const treasury = generateSigner(umi);
//   const collectionMint = (await createCollectionNft(umi)).publicKey;
//   const { publicKey: candyMachine } = await createV2(umi, {
//     collectionMint,

//     configLines: [{ name: 'Degen #1', uri: 'https://example.com/degen/1' }],
//     guards: {
//       freezeSolPayment: {
//         amount: sol(5),
//         destination: treasury.publicKey,
//       },
//     },
//   });
//   await initFreezeEscrow(umi, candyMachine);

//   // When we mint from it using a payer that only has 4 SOL.
//   const payer = await generateSignerWithSol(umi, 4);
//   const mint = generateSigner(umi);
//   const promise = transactionBuilder(umi).add().sendAndConfirm();
//   mintV2(
//     umi,
//     {
//       candyMachine,
//       collectionUpdateAuthority: collection.updateAuthority.publicKey,
//     },
//     { payer }
//   );

//   // Then we expect an error.
//   await t.throwsAsync(promise, {
//     message: /Not enough SOL to pay for the mint/,
//   });

//   // And the payer didn't loose any SOL.
//   const payerBalance = await umi.rpc.getBalance(payer.publicKey);
//   t.true(isEqualToAmount(payerBalance, sol(4)), 'payer did not lose SOLs');
// });

// test('it fails to mint if the owner is not the payer', async (t) => {
//   // Given a loaded Candy Machine with an initialized freezeSolPayment guard.
//   const umi = await createUmi();
//   const treasury = generateSigner(umi);
//   const collectionMint = (await createCollectionNft(umi)).publicKey;
//   const { publicKey: candyMachine } = await createV2(umi, {
//     collectionMint,

//     configLines: [{ name: 'Degen #1', uri: 'https://example.com/degen/1' }],
//     guards: {
//       freezeSolPayment: {
//         amount: sol(1),
//         destination: treasury.publicKey,
//       },
//     },
//   });
//   await initFreezeEscrow(umi, candyMachine);

//   // When we mint using an owner that is not the payer.
//   const payer = await generateSignerWithSol(umi, sol(10));
//   const owner = generateSigner(umi).publicKey;
//   const mint = generateSigner(umi);
//   const promise = transactionBuilder(umi).add().sendAndConfirm();
//   mintV2(
//     umi,
//     {
//       candyMachine,
//       collectionUpdateAuthority: collection.updateAuthority.publicKey,
//       owner,
//     },
//     { payer }
//   );

//   // Then we expect an error.
//   await assertThrows(
//     t,
//     promise,
//     /The payer must be the owner when using the \[freezeSolPayment\] guard/
//   );
// });

// test('it charges a bot tax if something goes wrong', async (t) => {
//   // Given a loaded Candy Machine with a freezeSolPayment guard and a botTax guard.
//   const umi = await createUmi();
//   const treasury = generateSigner(umi);
//   const collectionMint = (await createCollectionNft(umi)).publicKey;
//   const { publicKey: candyMachine } = await createV2(umi, {
//     collectionMint,

//     configLines: [{ name: 'Degen #1', uri: 'https://example.com/degen/1' }],
//     guards: {
//       botTax: {
//         lamports: sol(0.1),
//         lastInstruction: true,
//       },
//       freezeSolPayment: {
//         amount: sol(1),
//         destination: treasury.publicKey,
//       },
//     },
//   });

//   // When we try to mint without initializing the freeze escrow.
//   const payer = await generateSignerWithSol(umi, sol(10));
//   const mint = generateSigner(umi);
//   const promise = transactionBuilder(umi).add().sendAndConfirm();
//   mintV2(
//     umi,
//     {
//       candyMachine,
//       collectionUpdateAuthority: collection.updateAuthority.publicKey,
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

// const getFreezeEscrow = (
//   umi: Metaplex,
//   candyMachine: CandyMachine,
//   destination: Signer
// ) =>
//   umi.candyMachines().pdas().freezeEscrow({
//     destination: destination.publicKey,
//     candyMachine: candyMachine.address,
//     candyGuard: candyMachine.candyGuard!.address,
//   });

// const getFrozenCount = async (
//   umi: Metaplex,
//   candyMachine: CandyMachine,
//   destination: Signer
// ) => {
//   const account = await FreezeEscrow.fromAccountAddress(
//     umi.connection,
//     getFreezeEscrow(umi, candyMachine, destination)
//   );

//   return toBigNumber(account.frozenCount).toNumber();
// };

// const assertFrozenCount = async (
//   t: Test,
//   umi: Metaplex,
//   candyMachine: CandyMachine,
//   destination: Signer,
//   expected: number
// ): Promise<void> => {
//   const frozenCount = await getFrozenCount(umi, candyMachine, destination);
//   t.is(frozenCount, expected, 'frozen count is correct');
// };

const initFreezeEscrow = async (
  umi: Umi,
  candyMachine: PublicKey,
  destination: PublicKey,
  group?: Option<string>
) => {
  await transactionBuilder(umi)
    .add(
      route(umi, {
        candyMachine,
        guard: 'freezeSolPayment',
        group,
        routeArgs: {
          path: 'initialize',
          period: 15 * 24 * 3600, // 15 days.
          candyGuardAuthority: umi.identity,
          destination,
        },
      })
    )
    .sendAndConfirm();
};

// const mintNft = async (
//   umi: Metaplex,
//   candyMachine: CandyMachine,
//   collection: { updateAuthority: Signer },
//   payer?: Signer,
//   group?: string
// ) => {
//   const mint = generateSigner(umi);
//   await transactionBuilder(umi).add().sendAndConfirm();
//   mintV2(
//     umi,
//     {
//       candyMachine,
//       collectionUpdateAuthority: collection.updateAuthority.publicKey,
//       group,
//     },
//     { payer }
//   );
//   return nft;
// };

const thawNft = async (
  umi: Umi,
  candyMachine: PublicKey,
  destination: PublicKey,
  nftMint: PublicKey,
  nftOwner: PublicKey,
  group?: Option<string>
) => {
  await transactionBuilder(umi)
    .add(
      route(umi, {
        candyMachine,
        guard: 'freezeSolPayment',
        group,
        routeArgs: {
          path: 'thaw',
          nftMint,
          nftOwner,
          destination,
        },
      })
    )
    .sendAndConfirm();
};

// const unlockFunds = async (
//   umi: Metaplex,
//   candyMachine: CandyMachine,
//   group?: string
// ) => {
//   await transactionBuilder(umi).add().sendAndConfirm();
//   route(umi, {
//     candyMachine,
//     guard: 'freezeSolPayment',
//     group,
//     routeArgs: {
//       path: 'unlockFunds',
//       candyGuardAuthority: umi.identity(),
//     },
//   });
// };
