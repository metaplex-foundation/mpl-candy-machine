import {
  generateSigner,
  Option,
  publicKey,
  PublicKey,
  Signer,
  some,
  transactionBuilder,
  Umi,
} from '@metaplex-foundation/umi';
import test, { Assertions } from 'ava';
import {
  createMintWithAssociatedToken,
  setComputeUnitLimit,
} from '@metaplex-foundation/mpl-essentials';
import {
  assertSuccessfulMint,
  createCollectionNft,
  createMintWithHolders,
  createUmi,
  createV2,
} from '../_setup';
import {
  fetchFreezeEscrow,
  findCandyGuardPda,
  findFreezeEscrowPda,
  mintV2,
  route,
} from '../../src';

test.skip('it transfers tokens to an escrow account and freezes the NFT', async (t) => {
  // Given a token mint with holders such that the identity has 10 tokens.
  const umi = await createUmi();
  const destination = generateSigner(umi);
  const [tokenMint, destinationAta] = await createMintWithHolders(umi, {
    holders: [
      { owner: destination, amount: 0 },
      { owner: umi.identity, amount: 10 },
    ],
  });

  // And a loaded Candy Machine with a freezeTokenPayment guard.
  const collectionMint = (await createCollectionNft(umi)).publicKey;
  const { publicKey: candyMachine } = await createV2(umi, {
    collectionMint,
    configLines: [
      { name: 'Degen #1', uri: 'https://example.com/degen/1' },
      { name: 'Degen #2', uri: 'https://example.com/degen/2' },
    ],
    guards: {
      freezeTokenPayment: some({
        mint: tokenMint.publicKey,
        destinationAta,
        amount: 1,
      }),
    },
  });

  // And given the freezeTokenPayment guard is initialized.
  await transactionBuilder(umi)
    .add(
      route(umi, {
        candyMachine,
        guard: 'freezeTokenPayment',
        routeArgs: {
          path: 'initialize',
          period: 15 * 24 * 3600, // 15 days.
          candyGuardAuthority: umi.identity,
          mint: publicKey(tokenMint),
          destinationAta,
        },
      })
    )
    .sendAndConfirm();

  // When we mint from that candy machine.
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
          freezeTokenPayment: some({
            mint: publicKey(tokenMint),
            destinationAta,
          }),
        },
      })
    )
    .sendAndConfirm();

  // Then minting was successful.
  await assertSuccessfulMint(t, umi, { mint, owner: umi.identity });

  // // And the NFT is frozen.
  // t.is(nft.token.state, AccountState.Frozen, 'NFT is frozen');

  // // And cannot be thawed since not all NFTs have been minted.
  // const promise = thawNft(umi, candyMachine, nft.address, payer.publicKey);
  // await t.throwsAsync(promise, { message: /Thaw is not enabled/ });

  // // And the treasury escrow received SOLs.
  // const freezeEscrow = getFreezeEscrow(umi, candyMachine, treasuryAta);
  // const escrowTokens = await getTokenBalance(umi, mint, freezeEscrow);
  // t.true(
  //   isEqualToAmount(escrowTokens, token(1)),
  //   'treasury escrow received tokens'
  // );

  // // And was assigned the right data.
  // const freezeEscrowAccount = await FreezeEscrow.fromAccountAddress(
  //   umi.connection,
  //   freezeEscrow
  // );
  // t.like(freezeEscrowAccount, {
  //   $topic: 'freeze escrow account',
  //   candyMachine: spokSamePubkey(candyMachine.address),
  //   candyGuard: spokSamePubkey(candyMachine.candyGuard!.address),
  //   frozenCount: spokSameBignum(1),
  //   firstMintTime: spok.definedObject,
  //   freezePeriod: spokSameBignum(15 * 24 * 3600),
  //   destination: spokSamePubkey(treasuryAta.address),
  //   authority: spokSamePubkey(candyMachine.candyGuard!.authorityAddress),
  // });

  // // And the payer lost tokens.
  // const payerBalance = await getTokenBalance(umi, mint, payer.publicKey);
  // t.true(isEqualToAmount(payerBalance, token(9)), 'payer lost tokens');
});

// TODO: it allows minting when the mint and token accounts are created beforehand

test('it allows minting when the mint and token accounts are created beforehand', async (t) => {
  // Given a token mint with holders such that the identity has 10 tokens.
  const umi = await createUmi();
  const destination = generateSigner(umi);
  const [tokenMint, destinationAta] = await createMintWithHolders(umi, {
    holders: [
      { owner: destination, amount: 0 },
      { owner: umi.identity, amount: 10 },
    ],
  });

  // And a loaded Candy Machine with a freezeTokenPayment guard.
  const collectionMint = (await createCollectionNft(umi)).publicKey;
  const { publicKey: candyMachine } = await createV2(umi, {
    collectionMint,
    configLines: [
      { name: 'Degen #1', uri: 'https://example.com/degen/1' },
      { name: 'Degen #2', uri: 'https://example.com/degen/2' },
    ],
    guards: {
      freezeTokenPayment: some({
        mint: tokenMint.publicKey,
        destinationAta,
        amount: 1,
      }),
    },
  });

  // And given the freezeTokenPayment guard is initialized.
  await initFreezeEscrow(umi, candyMachine, tokenMint, destinationAta);

  // When we mint from that candy machine by creating
  // the mint and token accounts beforehand.
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
        nftMint: mint,
        collectionMint,
        collectionUpdateAuthority: umi.identity.publicKey,
        mintArgs: {
          freezeTokenPayment: some({
            mint: publicKey(tokenMint),
            destinationAta,
          }),
        },
      })
    )
    .sendAndConfirm();

  // Then minting was successful.
  await assertSuccessfulMint(t, umi, { mint, owner: umi.identity });
});

// test('it can thaw an NFT once all NFTs are minted', async (t) => {
//   // Given a loaded Candy Machine with an initialized
//   // freezeTokenPayment guard with only one item.
//   const umi = await createUmi();
//   const treasury = generateSigner(umi);
//   const [mint, treasuryAta] = await createMint(umi, treasury);
//   const collectionMint = (await createCollectionNft(umi)).publicKey;
//   const { publicKey: candyMachine } = await createV2(umi, {
//     collectionMint,

//     configLines: [{ name: 'Degen #1', uri: 'https://example.com/degen/1' }],
//     guards: {
//       freezeTokenPayment: {
//         amount: token(1),
//         destinationAta: treasuryAta.address,
//         mint: mint.address,
//       },
//     },
//   });
//   await initFreezeEscrow(umi, candyMachine);

//   // And given we minted the only frozen NFT from that candy machine.
//   const payer = await createTokenPayer(umi, mint, treasury, 10);
//   const nft = await mintNft(umi, candyMachine, collection, payer);
//   t.is(nft.token.state, AccountState.Frozen, 'NFT is frozen');

//   // When we thaw the NFT.
//   await thawNft(umi, candyMachine, nft.address, payer.publicKey);

//   // Then the NFT is thawed.
//   const refreshedNft = await umi.nfts().refresh(nft);
//   t.is(refreshedNft.token.state, AccountState.Initialized, 'NFT is Thawed');
// });

// test('it can unlock funds once all NFTs have been thawed', async (t) => {
//   // Given a loaded Candy Machine with an initialized freezeTokenPayment guard.
//   const umi = await createUmi();
//   const treasury = generateSigner(umi);
//   const [mint, treasuryAta] = await createMint(umi, treasury);
//   const collectionMint = (await createCollectionNft(umi)).publicKey;
//   const { publicKey: candyMachine } = await createV2(umi, {
//     collectionMint,

//     configLines: [{ name: 'Degen #1', uri: 'https://example.com/degen/1' }],
//     guards: {
//       freezeTokenPayment: {
//         amount: token(1),
//         destinationAta: treasuryAta.address,
//         mint: mint.address,
//       },
//     },
//   });
//   await initFreezeEscrow(umi, candyMachine);

//   // And given all NFTs have been minted and thawed.
//   const payer = await createTokenPayer(umi, mint, treasury, 10);
//   const nft = await mintNft(umi, candyMachine, collection, payer);
//   await thawNft(umi, candyMachine, nft.address, payer.publicKey);

//   // When the authority unlocks the funds.
//   await transactionBuilder(umi).add().sendAndConfirm();
//   route(umi, {
//     candyMachine,
//     guard: 'freezeTokenPayment',
//     routeArgs: {
//       path: 'unlockFunds',
//       candyGuardAuthority: umi.identity(),
//     },
//   });

//   // Then the destination wallet received the funds.
//   const treasuryBalance = await getTokenBalance(umi, mint, treasury.publicKey);
//   t.true(
//     isEqualToAmount(treasuryBalance, token(1)),
//     'treasury received tokens'
//   );

//   // And the treasury escrow ATA no longer exists.
//   const treasuryEscrow = getFreezeEscrow(umi, candyMachine, treasuryAta);
//   const treasuryEscrowAta = umi.tokens().pdas().associatedTokenAccount({
//     mint: mint.address,
//     owner: treasuryEscrow,
//   });
//   t.false(
//     await umi.rpc().accountExists(treasuryEscrowAta),
//     'treasury escrow ATA no longer exists'
//   );
// });

// test('it cannot unlock funds if not all NFTs have been thawed', async (t) => {
//   // Given a loaded Candy Machine with an initialized freezeTokenPayment guard.
//   const umi = await createUmi();
//   const treasury = generateSigner(umi);
//   const [mint, treasuryAta] = await createMint(umi, treasury);
//   const collectionMint = (await createCollectionNft(umi)).publicKey;
//   const { publicKey: candyMachine } = await createV2(umi, {
//     collectionMint,

//     configLines: [{ name: 'Degen #1', uri: 'https://example.com/degen/1' }],
//     guards: {
//       freezeTokenPayment: {
//         amount: token(1),
//         destinationAta: treasuryAta.address,
//         mint: mint.address,
//       },
//     },
//   });
//   await initFreezeEscrow(umi, candyMachine);

//   // And given all NFTs have been minted but not thawed.
//   const payer = await createTokenPayer(umi, mint, treasury, 10);
//   await mintNft(umi, candyMachine, collection, payer);

//   // When the authority tries to unlock the funds.
//   const promise = umi.candyMachines().callGuardRoute({
//     candyMachine,
//     guard: 'freezeTokenPayment',
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
//   const treasuryBalance = await getTokenBalance(umi, mint, treasury.publicKey);
//   t.true(
//     isEqualToAmount(treasuryBalance, token(0)),
//     'treasury received no tokens'
//   );
// });

// test('it can have multiple freeze escrow and reuse the same ones', async (t) => {
//   // Given a loaded Candy Machine with 4 groups
//   // containing freezeTokenPayment guards such that:
//   // - Group A and Group B use the same destination (and thus freeze escrow).
//   // - Group C uses a different destination than group A and B.
//   // - Group D does not use a freezeTokenPayment guard at all.
//   const umi = await createUmi();
//   const treasuryAB = generateSigner(umi);
//   const [mintAB, treasuryAtaAB] = await createMint(umi, treasuryAB);
//   const treasuryC = generateSigner(umi);
//   const [mintC, treasuryAtaC] = await createMint(umi, treasuryC);
//   const treasuryD = generateSigner(umi);
//   const [mintD, treasuryAtaD] = await createMint(umi, treasuryD);
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
//           freezeTokenPayment: {
//             amount: token(1),
//             destinationAta: treasuryAtaAB.address,
//             mint: mintAB.address,
//           },
//         },
//       },
//       {
//         label: 'GROUPB',
//         guards: {
//           freezeTokenPayment: {
//             amount: token(3),
//             destinationAta: treasuryAtaAB.address,
//             mint: mintAB.address,
//           },
//         },
//       },
//       {
//         label: 'GROUPC',
//         guards: {
//           freezeTokenPayment: {
//             amount: token(5),
//             destinationAta: treasuryAtaC.address,
//             mint: mintC.address,
//           },
//         },
//       },
//       {
//         label: 'GROUPD',
//         guards: {
//           tokenPayment: {
//             amount: token(7),
//             destinationAta: treasuryAtaD.address,
//             mint: mintD.address,
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

//   // And given a payer with enough tokens to buy all 4 NFTs.
//   const payer = await generateSignerWithSol(umi, sol(10));
//   await mintTokens(umi, mintAB, treasuryAB, payer, 10);
//   await mintTokens(umi, mintC, treasuryC, payer, 10);
//   await mintTokens(umi, mintD, treasuryD, payer, 10);

//   // When we mint all 4 NFTs via each group.
//   const nftA = await mintNft(umi, candyMachine, collection, payer, 'GROUPA'); // 1 AB token.
//   const nftB = await mintNft(umi, candyMachine, collection, payer, 'GROUPB'); // 3 AB tokens.
//   const nftC = await mintNft(umi, candyMachine, collection, payer, 'GROUPC'); // 5 C tokens.
//   const nftD = await mintNft(umi, candyMachine, collection, payer, 'GROUPD'); // 7 D tokens.

//   // Then all NFTs except for group D have been frozen.
//   t.is(nftA.token.state, AccountState.Frozen, 'NFT A is frozen');
//   t.is(nftB.token.state, AccountState.Frozen, 'NFT B is frozen');
//   t.is(nftC.token.state, AccountState.Frozen, 'NFT C is frozen');
//   t.is(nftD.token.state, AccountState.Initialized, 'NFT D is not frozen');

//   // And the treasury escrow received tokens.
//   const escrowAB = getFreezeEscrow(umi, candyMachine, treasuryAtaAB);
//   const escrowC = getFreezeEscrow(umi, candyMachine, treasuryAtaC);
//   const escrowBalanceAB = await getTokenBalance(umi, mintAB, escrowAB);
//   const escrowBalanceC = await getTokenBalance(umi, mintC, escrowC);
//   t.true(
//     isEqualToAmount(escrowBalanceAB, token(4)),
//     'treasury AB escrow ATA received tokens'
//   );
//   t.true(
//     isEqualToAmount(escrowBalanceC, token(5)),
//     'treasury C escrow ATA received tokens'
//   );

//   // And the payer lost tokens.
//   const payerTokensAB = await getTokenBalance(umi, mintAB, payer.publicKey);
//   const payerTokensC = await getTokenBalance(umi, mintC, payer.publicKey);
//   const payerTokensD = await getTokenBalance(umi, mintD, payer.publicKey);
//   t.true(isEqualToAmount(payerTokensAB, token(10 - 4)), 'payer lost AB tokens');
//   t.true(isEqualToAmount(payerTokensC, token(10 - 5)), 'payer lost C tokens');
//   t.true(isEqualToAmount(payerTokensD, token(10 - 7)), 'payer lost D tokens');

//   // And the frozen counters securely decrease as we thaw all frozen NFTs.
//   const assertFrozenCounts = async (ab: number, c: number) => {
//     await Promise.all([
//       assertFrozenCount(t, umi, candyMachine, treasuryAtaAB, ab),
//       assertFrozenCount(t, umi, candyMachine, treasuryAtaC, c),
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
//   t.true(
//     isEqualToAmount(
//       await getTokenBalance(umi, mintAB, treasuryAB.publicKey),
//       token(4)
//     ),
//     'treasury AB received the funds'
//   );
//   t.true(
//     isEqualToAmount(
//       await getTokenBalance(umi, mintC, treasuryC.publicKey),
//       token(5)
//     ),
//     'treasury C received the funds'
//   );
//   t.true(
//     isEqualToAmount(
//       await getTokenBalance(umi, mintD, treasuryD.publicKey),
//       token(7)
//     ),
//     'treasury D received the funds'
//   );

//   // And the treasury escrows ATA no longer exist.
//   const escrowAtaAB = umi
//     .tokens()
//     .pdas()
//     .associatedTokenAccount({
//       mint: mintAB.address,
//       owner: getFreezeEscrow(umi, candyMachine, treasuryAtaAB),
//     });
//   const escrowAtaC = umi
//     .tokens()
//     .pdas()
//     .associatedTokenAccount({
//       mint: mintC.address,
//       owner: getFreezeEscrow(umi, candyMachine, treasuryAtaC),
//     });
//   t.false(
//     await umi.rpc().accountExists(escrowAtaAB),
//     'treasury AB escrow ATA no longer exists'
//   );
//   t.false(
//     await umi.rpc().accountExists(escrowAtaC),
//     'treasury C escrow ATA no longer exists'
//   );
// });

// test('it fails to mint if the freeze escrow was not initialized', async (t) => {
//   // Given a loaded Candy Machine with a freezeTokenPayment guard.
//   const umi = await createUmi();
//   const treasury = generateSigner(umi);
//   const [mint, treasuryAta] = await createMint(umi, treasury);
//   const collectionMint = (await createCollectionNft(umi)).publicKey;
//   const { publicKey: candyMachine } = await createV2(umi, {
//     collectionMint,

//     configLines: [{ name: 'Degen #1', uri: 'https://example.com/degen/1' }],
//     guards: {
//       freezeTokenPayment: {
//         amount: token(1),
//         destinationAta: treasuryAta.address,
//         mint: mint.address,
//       },
//     },
//   });

//   // When we try to mint without initializing the freeze escrow.
//   const payer = await createTokenPayer(umi, mint, treasury, 10);
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
//   const payerBalance = await getTokenBalance(umi, mint, payer.publicKey);
//   t.true(isEqualToAmount(payerBalance, token(10)), 'payer did not lose tokens');
// });

// test('it fails to mint if the payer does not have enough funds', async (t) => {
//   // Given a loaded Candy Machine with an initialized
//   // freezeTokenPayment guard costing 5 tokens.
//   const umi = await createUmi();
//   const treasury = generateSigner(umi);
//   const [mint, treasuryAta] = await createMint(umi, treasury);
//   const collectionMint = (await createCollectionNft(umi)).publicKey;
//   const { publicKey: candyMachine } = await createV2(umi, {
//     collectionMint,

//     configLines: [{ name: 'Degen #1', uri: 'https://example.com/degen/1' }],
//     guards: {
//       freezeTokenPayment: {
//         amount: token(5),
//         destinationAta: treasuryAta.address,
//         mint: mint.address,
//       },
//     },
//   });
//   await initFreezeEscrow(umi, candyMachine);

//   // When we mint from it using a payer that only has 4 tokens.
//   const payer = await createTokenPayer(umi, mint, treasury, 4);
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
//   await t.throwsAsync(promise, { message: /Not enough tokens on the account/ });

//   // And the payer didn't loose any tokens.
//   const payerBalance = await getTokenBalance(umi, mint, payer.publicKey);
//   t.true(isEqualToAmount(payerBalance, token(4)), 'payer did not lose tokens');
// });

// test('it fails to mint if the owner is not the payer', async (t) => {
//   // Given a loaded Candy Machine with an initialized freezeTokenPayment guard.
//   const umi = await createUmi();
//   const treasury = generateSigner(umi);
//   const [mint, treasuryAta] = await createMint(umi, treasury);
//   const collectionMint = (await createCollectionNft(umi)).publicKey;
//   const { publicKey: candyMachine } = await createV2(umi, {
//     collectionMint,

//     configLines: [{ name: 'Degen #1', uri: 'https://example.com/degen/1' }],
//     guards: {
//       freezeTokenPayment: {
//         amount: token(1),
//         destinationAta: treasuryAta.address,
//         mint: mint.address,
//       },
//     },
//   });
//   await initFreezeEscrow(umi, candyMachine);

//   // When we mint using an owner that is not the payer.
//   const payer = await createTokenPayer(umi, mint, treasury, 10);
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
//     /The payer must be the owner when using the \[freezeTokenPayment\] guard/
//   );
// });

// test('it charges a bot tax if something goes wrong', async (t) => {
//   // Given a loaded Candy Machine with a freezeTokenPayment guard and a botTax guard.
//   const umi = await createUmi();
//   const treasury = generateSigner(umi);
//   const [mint, treasuryAta] = await createMint(umi, treasury);
//   const collectionMint = (await createCollectionNft(umi)).publicKey;
//   const { publicKey: candyMachine } = await createV2(umi, {
//     collectionMint,

//     configLines: [{ name: 'Degen #1', uri: 'https://example.com/degen/1' }],
//     guards: {
//       botTax: {
//         lamports: sol(0.1),
//         lastInstruction: true,
//       },
//       freezeTokenPayment: {
//         amount: token(1),
//         destinationAta: treasuryAta.address,
//         mint: mint.address,
//       },
//     },
//   });

//   // When we try to mint without initializing the freeze escrow.
//   const payer = await generateSignerWithSol(umi, sol(10)); // 10 SOL.
//   await mintTokens(umi, mint, treasury, payer, 5); // 5 tokens.
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

// const createMint = async (
//   umi: Metaplex,
//   mintAuthority: Signer
// ): Promise<[Mint, TokenWithMint]> => {
//   const { token: tokenWithMint } = await createMintAndToken(umi, {
//     owner: mintAuthority.publicKey,
//     mintAuthority,
//   });

//   return [tokenWithMint.mint, tokenWithMint];
// };

// const createTokenPayer = async (
//   umi: Metaplex,
//   mint: Mint,
//   mintAuthority: Signer,
//   amount: number
// ): Promise<Signer> => {
//   const payer = await generateSignerWithSol(umi, sol(10));
//   await mintTokens(umi, mint, mintAuthority, payer, amount);
//   return payer;
// };

// const mintTokens = async (
//   umi: Metaplex,
//   mint: Mint,
//   mintAuthority: Signer,
//   payer: Signer,
//   amount: number
// ) => {
//   await umi.tokens().mint({
//     mintAddress: mint.address,
//     mintAuthority,
//     toOwner: payer.publicKey,
//     amount: token(amount),
//   });
// };

// const getFreezeEscrow = (
//   umi: Metaplex,
//   candyMachine: CandyMachine,
//   destinationAta: { address: PublicKey }
// ) =>
//   umi.candyMachines().pdas().freezeEscrow({
//     destination: destinationAta.address,
//     candyMachine: candyMachine.address,
//     candyGuard: candyMachine.candyGuard!.address,
//   });

// const getTokenBalance = async (umi: Metaplex, mint: Mint, owner: PublicKey) => {
//   const tokenAccount = await umi.tokens().findTokenByAddress({
//     address: umi.tokens().pdas().associatedTokenAccount({
//       mint: mint.address,
//       owner,
//     }),
//   });

//   return tokenAccount.amount;
// };

// const getFrozenCount = async (
//   umi: Metaplex,
//   candyMachine: CandyMachine,
//   destinationAta: { address: PublicKey }
// ) => {
//   const account = await FreezeEscrow.fromAccountAddress(
//     umi.connection,
//     getFreezeEscrow(umi, candyMachine, destinationAta)
//   );

//   return toBigNumber(account.frozenCount).toNumber();
// };

// const assertFrozenCount = async (
//   t: Test,
//   umi: Metaplex,
//   candyMachine: CandyMachine,
//   destinationAta: { address: PublicKey },
//   expected: number
// ): Promise<void> => {
//   const frozenCount = await getFrozenCount(umi, candyMachine, destinationAta);
//   t.is(frozenCount, expected, 'frozen count is correct');
// };

// const initFreezeEscrow = async (
//   umi: Metaplex,
//   candyMachine: CandyMachine,
//   group?: string
// ) => {
//   await transactionBuilder(umi).add().sendAndConfirm();
//   route(umi, {
//     candyMachine,
//     guard: 'freezeTokenPayment',
//     group,
//     routeArgs: {
//       path: 'initialize',
//       period: 15 * 24 * 3600, // 15 days.
//       candyGuardAuthority: umi.identity(),
//     },
//   });
// };

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

// const thawNft = async (
//   umi: Metaplex,
//   candyMachine: CandyMachine,
//   nftMint: PublicKey,
//   nftOwner: PublicKey,
//   group?: string
// ) => {
//   await transactionBuilder(umi).add().sendAndConfirm();
//   route(umi, {
//     candyMachine,
//     guard: 'freezeTokenPayment',
//     group,
//     routeArgs: {
//       path: 'thaw',
//       nftMint,
//       nftOwner,
//     },
//   });
// };

// const unlockFunds = async (
//   umi: Metaplex,
//   candyMachine: CandyMachine,
//   group?: string
// ) => {
//   await transactionBuilder(umi).add().sendAndConfirm();
//   route(umi, {
//     candyMachine,
//     guard: 'freezeTokenPayment',
//     group,
//     routeArgs: {
//       path: 'unlockFunds',
//       candyGuardAuthority: umi.identity(),
//     },
//   });
// };

const getFreezeEscrow = (
  umi: Umi,
  candyMachine: PublicKey,
  destinationAta: PublicKey
) =>
  findFreezeEscrowPda(umi, {
    candyMachine,
    candyGuard: findCandyGuardPda(umi, { base: candyMachine }),
    destination: publicKey(destinationAta),
  });

const getFrozenCount = async (
  umi: Umi,
  candyMachine: PublicKey,
  destinationAta: PublicKey
) => {
  const pda = getFreezeEscrow(umi, candyMachine, destinationAta);
  const account = await fetchFreezeEscrow(umi, pda);
  return Number(account.frozenCount);
};

const assertFrozenCount = async (
  t: Assertions,
  umi: Umi,
  candyMachine: PublicKey,
  destinationAta: PublicKey,
  expected: number
): Promise<void> => {
  const frozenCount = await getFrozenCount(umi, candyMachine, destinationAta);
  t.is(frozenCount, expected, 'frozen count is correct');
};

const initFreezeEscrow = async (
  umi: Umi,
  candyMachine: PublicKey,
  tokenMint: PublicKey | Signer,
  destinationAta: PublicKey,
  group?: Option<string>
) => {
  await transactionBuilder(umi)
    .add(
      route(umi, {
        candyMachine,
        guard: 'freezeTokenPayment',
        group,
        routeArgs: {
          path: 'initialize',
          period: 15 * 24 * 3600, // 15 days.
          candyGuardAuthority: umi.identity,
          mint: publicKey(tokenMint),
          destinationAta,
        },
      })
    )
    .sendAndConfirm();
};

const mintNft = async (
  umi: Umi,
  candyMachine: PublicKey,
  tokenMint: PublicKey | Signer,
  destinationAta: PublicKey,
  collectionMint: PublicKey,
  group?: Option<string>
) => {
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
          freezeTokenPayment: some({
            mint: publicKey(tokenMint),
            destinationAta,
          }),
        },
        group,
      })
    )
    .sendAndConfirm();

  return mint;
};

const thawNft = async (
  umi: Umi,
  candyMachine: PublicKey,
  tokenMint: PublicKey | Signer,
  destinationAta: PublicKey,
  nftMint: PublicKey,
  nftOwner: PublicKey,
  group?: Option<string>
) => {
  await transactionBuilder(umi)
    .add(
      route(umi, {
        candyMachine,
        guard: 'freezeTokenPayment',
        group,
        routeArgs: {
          path: 'thaw',
          nftMint,
          nftOwner,
          mint: publicKey(tokenMint),
          destinationAta,
        },
      })
    )
    .sendAndConfirm();
};

const unlockFunds = async (
  umi: Umi,
  candyMachine: PublicKey,
  tokenMint: PublicKey | Signer,
  destinationAta: PublicKey,
  group?: Option<string>,
  candyGuardAuthority?: Signer
) => {
  await transactionBuilder(umi)
    .add(
      route(umi, {
        candyMachine,
        guard: 'freezeTokenPayment',
        group,
        routeArgs: {
          path: 'unlockFunds',
          candyGuardAuthority: candyGuardAuthority ?? umi.identity,
          mint: publicKey(tokenMint),
          destinationAta,
        },
      })
    )
    .sendAndConfirm();
};

export const deletMe = () => {
  // eslint-disable-next-line no-console
  console.log({
    getFreezeEscrow,
    getFrozenCount,
    assertFrozenCount,
    initFreezeEscrow,
    mintNft,
    thawNft,
    unlockFunds,
  });
};
