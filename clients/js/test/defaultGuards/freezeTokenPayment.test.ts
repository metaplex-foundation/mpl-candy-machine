import {
  createMintWithAssociatedToken,
  fetchToken,
  findAssociatedTokenPda,
  setComputeUnitLimit,
  Token,
  TokenState,
} from '@metaplex-foundation/mpl-toolbox';
import {
  fetchTokenRecord,
  findTokenRecordPda,
  TokenStandard,
  TokenState as MetadataTokenState,
} from '@metaplex-foundation/mpl-token-metadata';
import {
  generateSigner,
  isSome,
  none,
  Pda,
  publicKey,
  PublicKey,
  Signer,
  sol,
  some,
  transactionBuilder,
  Umi,
} from '@metaplex-foundation/umi';
import test, { Assertions } from 'ava';
import {
  addConfigLines,
  fetchCandyMachine,
  fetchFreezeEscrow,
  findCandyGuardPda,
  findFreezeEscrowPda,
  FreezeEscrow,
  getMplTokenAuthRulesProgramId,
  mintV2,
  route,
} from '../../src';
import {
  assertBotTax,
  assertSuccessfulMint,
  createCollectionNft,
  createMintWithHolders,
  createUmi,
  createV2,
  METAPLEX_DEFAULT_RULESET,
} from '../_setup';

test('it transfers tokens to an escrow account and freezes the NFT', async (t) => {
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
  await transactionBuilder()
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
    .sendAndConfirm(umi);

  // When we mint from that candy machine.
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
          freezeTokenPayment: some({
            mint: publicKey(tokenMint),
            destinationAta,
          }),
        },
      })
    )
    .sendAndConfirm(umi);

  // Then minting was successful.
  await assertSuccessfulMint(t, umi, { mint, owner: umi.identity });

  // And the NFT is frozen.
  const ata = findAssociatedTokenPda(umi, {
    mint: mint.publicKey,
    owner: umi.identity.publicKey,
  });
  const tokenAccount = await fetchToken(umi, ata);
  t.is(tokenAccount.state, TokenState.Frozen, 'NFT is frozen');

  // And cannot be thawed since not all NFTs have been minted.
  const cm = candyMachine;
  const promise = thawNft(umi, cm, tokenMint, destinationAta, mint.publicKey);
  await t.throwsAsync(promise, { message: /ThawNotEnabled/ });

  // And the treasury escrow received tokens.
  const freezeEscrow = getFreezeEscrow(umi, candyMachine, destinationAta);
  const escrowTokens = await getTokenBalance(umi, tokenMint, freezeEscrow);
  t.is(escrowTokens, 1, 'treasury escrow received tokens');

  // And was assigned the right data.
  const freezeEscrowAccount = await fetchFreezeEscrow(umi, freezeEscrow);
  t.true(isSome(freezeEscrowAccount.firstMintTime));
  t.like(freezeEscrowAccount, <FreezeEscrow>{
    candyMachine: publicKey(candyMachine),
    candyGuard: publicKey(findCandyGuardPda(umi, { base: candyMachine })),
    frozenCount: 1n,
    freezePeriod: BigInt(15 * 24 * 3600),
    destination: publicKey(destinationAta),
    authority: publicKey(umi.identity),
  });

  // And the payer lost tokens.
  const payerBalance = await getTokenBalance(umi, tokenMint, umi.identity);
  t.is(payerBalance, 9, 'payer lost tokens');
});

test('it allows minting even when the payer is different from the minter', async (t) => {
  // Given a token mint with holders such that an explicit minter has 10 tokens.
  const umi = await createUmi();
  const minter = generateSigner(umi);
  const destination = generateSigner(umi);
  const [tokenMint, destinationAta] = await createMintWithHolders(umi, {
    holders: [
      { owner: destination, amount: 0 },
      { owner: minter, amount: 10 },
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

  // When we mint from that candy machine using an explicit minter.
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
          freezeTokenPayment: some({
            mint: publicKey(tokenMint),
            destinationAta,
          }),
        },
      })
    )
    .sendAndConfirm(umi);

  // Then minting was successful.
  await assertSuccessfulMint(t, umi, { mint, owner: minter });
});

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
  await transactionBuilder()
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
    .sendAndConfirm(umi);

  // Then minting was successful.
  await assertSuccessfulMint(t, umi, { mint, owner: umi.identity });
});

test('it can thaw an NFT once all NFTs are minted', async (t) => {
  // Given a token mint with holders such that the identity has 10 tokens.
  const umi = await createUmi();
  const destination = generateSigner(umi);
  const [tokenMint, destinationAta] = await createMintWithHolders(umi, {
    holders: [
      { owner: destination, amount: 0 },
      { owner: umi.identity, amount: 10 },
    ],
  });

  // And a loaded Candy Machine with an initialized
  // freezeTokenPayment guard with only one item.
  const collectionMint = (await createCollectionNft(umi)).publicKey;
  const { publicKey: candyMachine } = await createV2(umi, {
    collectionMint,
    configLines: [{ name: 'Degen #1', uri: 'https://example.com/degen/1' }],
    guards: {
      freezeTokenPayment: some({
        mint: tokenMint.publicKey,
        destinationAta,
        amount: 1,
      }),
    },
  });
  await initFreezeEscrow(umi, candyMachine, tokenMint, destinationAta);

  // And given we minted the only frozen NFT from that candy machine.
  const mint = await mintNft(
    umi,
    candyMachine,
    tokenMint,
    destinationAta,
    collectionMint
  );
  t.is(await getTokenState(umi, mint, umi.identity), TokenState.Frozen);

  // When we thaw the NFT.
  await thawNft(umi, candyMachine, tokenMint, destinationAta, mint.publicKey);

  // Then the NFT is thawed.
  t.is(await getTokenState(umi, mint, umi.identity), TokenState.Initialized);
});

test('it can unlock funds once all NFTs have been thawed', async (t) => {
  // Given a token mint with holders such that the identity has 10 tokens.
  const umi = await createUmi();
  const destination = generateSigner(umi);
  const [tokenMint, destinationAta] = await createMintWithHolders(umi, {
    holders: [
      { owner: destination, amount: 0 },
      { owner: umi.identity, amount: 10 },
    ],
  });

  // And a loaded Candy Machine with an initialized freezeTokenPayment guard.
  const collectionMint = (await createCollectionNft(umi)).publicKey;
  const { publicKey: candyMachine } = await createV2(umi, {
    collectionMint,
    configLines: [{ name: 'Degen #1', uri: 'https://example.com/degen/1' }],
    guards: {
      freezeTokenPayment: some({
        mint: tokenMint.publicKey,
        destinationAta,
        amount: 1,
      }),
    },
  });
  await initFreezeEscrow(umi, candyMachine, tokenMint, destinationAta);

  // And given all NFTs have been minted and thawed.
  const mint = await mintNft(
    umi,
    candyMachine,
    tokenMint,
    destinationAta,
    collectionMint
  );
  await thawNft(umi, candyMachine, tokenMint, destinationAta, mint.publicKey);

  // When the authority unlocks the funds.
  await transactionBuilder()
    .add(
      route(umi, {
        candyMachine,
        guard: 'freezeTokenPayment',
        routeArgs: {
          path: 'unlockFunds',
          candyGuardAuthority: umi.identity,
          mint: publicKey(tokenMint),
          destinationAta,
        },
      })
    )
    .sendAndConfirm(umi);

  // Then the destination wallet received the token.
  const treasuryBalance = await getTokenBalance(umi, tokenMint, destination);
  t.is(treasuryBalance, 1, 'treasury received tokens');

  // And the treasury escrow ATA no longer exists.
  const [treasuryEscrow] = getFreezeEscrow(umi, candyMachine, destinationAta);
  const [treasuryEscrowAta] = findAssociatedTokenPda(umi, {
    mint: mint.publicKey,
    owner: treasuryEscrow,
  });
  t.false(
    await umi.rpc.accountExists(treasuryEscrowAta),
    'treasury escrow ATA no longer exists'
  );
});

test('it cannot unlock funds if not all NFTs have been thawed', async (t) => {
  // Given a token mint with holders such that the identity has 10 tokens.
  const umi = await createUmi();
  const destination = generateSigner(umi);
  const [tokenMint, destinationAta] = await createMintWithHolders(umi, {
    holders: [
      { owner: destination, amount: 0 },
      { owner: umi.identity, amount: 10 },
    ],
  });

  // And a loaded Candy Machine with an initialized freezeTokenPayment guard.
  const collectionMint = (await createCollectionNft(umi)).publicKey;
  const { publicKey: candyMachine } = await createV2(umi, {
    collectionMint,
    configLines: [{ name: 'Degen #1', uri: 'https://example.com/degen/1' }],
    guards: {
      freezeTokenPayment: some({
        mint: tokenMint.publicKey,
        destinationAta,
        amount: 1,
      }),
    },
  });
  await initFreezeEscrow(umi, candyMachine, tokenMint, destinationAta);

  // And given all NFTs have been minted but not thawed.
  await mintNft(umi, candyMachine, tokenMint, destinationAta, collectionMint);

  // When the authority tries to unlock the funds.
  const promise = transactionBuilder()
    .add(
      route(umi, {
        candyMachine,
        guard: 'freezeTokenPayment',
        routeArgs: {
          path: 'unlockFunds',
          candyGuardAuthority: umi.identity,
          mint: publicKey(tokenMint),
          destinationAta,
        },
      })
    )
    .sendAndConfirm(umi);

  // Then we expect an error.
  await t.throwsAsync(promise, { message: /UnlockNotEnabled/ });

  // And the destination wallet did not receive any tokens.
  const treasuryBalance = await getTokenBalance(umi, tokenMint, destination);
  t.is(treasuryBalance, 0, 'treasury received no tokens');
});

test('it can have multiple freeze escrow and reuse the same ones', async (t) => {
  // Increase the timeout of this long test to 20 seconds.
  t.timeout(20_000);

  // Given a loaded Candy Machine with 4 groups
  // containing freezeTokenPayment guards such that:
  // - Group A and Group B use the same destination (and thus freeze escrow).
  // - Group C uses a different destination than group A and B.
  // - Group D does not use a freezeTokenPayment guard at all.
  // And such that the identity has 10 tokens of each mint.
  const umi = await createUmi();
  const destinationAB = generateSigner(umi);
  const destinationC = generateSigner(umi);
  const destinationD = generateSigner(umi);
  const [mintAB, destinationAtaAB] = await createMintWithHolders(umi, {
    holders: [
      { owner: destinationAB, amount: 0 },
      { owner: umi.identity, amount: 10 },
    ],
  });
  const [mintC, destinationAtaC] = await createMintWithHolders(umi, {
    holders: [
      { owner: destinationC, amount: 0 },
      { owner: umi.identity, amount: 10 },
    ],
  });
  const [mintD, destinationAtaD] = await createMintWithHolders(umi, {
    holders: [
      { owner: destinationD, amount: 0 },
      { owner: umi.identity, amount: 10 },
    ],
  });
  const collectionMint = (await createCollectionNft(umi)).publicKey;
  const { publicKey: candyMachine } = await createV2(umi, {
    collectionMint,
    itemsAvailable: 4,
    guards: {},
    groups: [
      {
        label: 'GROUPA',
        guards: {
          freezeTokenPayment: some({
            amount: 1,
            destinationAta: destinationAtaAB,
            mint: mintAB.publicKey,
          }),
        },
      },
      {
        label: 'GROUPB',
        guards: {
          freezeTokenPayment: some({
            amount: 3,
            destinationAta: destinationAtaAB,
            mint: mintAB.publicKey,
          }),
        },
      },
      {
        label: 'GROUPC',
        guards: {
          freezeTokenPayment: some({
            amount: 5,
            destinationAta: destinationAtaC,
            mint: mintC.publicKey,
          }),
        },
      },
      {
        label: 'GROUPD',
        guards: {
          tokenPayment: some({
            amount: 7,
            destinationAta: destinationAtaD,
            mint: mintD.publicKey,
          }),
        },
      },
    ],
  });
  await transactionBuilder()
    .add(
      addConfigLines(umi, {
        candyMachine,
        index: 0,
        configLines: [
          { name: 'Degen #1', uri: 'https://example.com/degen/1' },
          { name: 'Degen #2', uri: 'https://example.com/degen/2' },
          { name: 'Degen #3', uri: 'https://example.com/degen/3' },
          { name: 'Degen #4', uri: 'https://example.com/degen/4' },
        ],
      })
    )
    .sendAndConfirm(umi);

  // And given all freeze escrows have been initialized.
  const cm = candyMachine;
  await initFreezeEscrow(umi, cm, mintAB, destinationAtaAB, 'GROUPA');
  await initFreezeEscrow(umi, cm, mintC, destinationAtaC, 'GROUPC');

  // Note that trying to initialize the escrow for group B will fail
  // because it has already been initialized via group A.
  await t.throwsAsync(
    initFreezeEscrow(umi, cm, mintAB, destinationAtaAB, 'GROUPB'),
    { message: /FreezeEscrowAlreadyExists/ }
  );

  // When we mint all 4 NFTs via each group.
  const cl = collectionMint;
  const nftA = await mintNft(umi, cm, mintAB, destinationAtaAB, cl, 'GROUPA'); // 1 AB token.
  const nftB = await mintNft(umi, cm, mintAB, destinationAtaAB, cl, 'GROUPB'); // 3 AB tokens.
  const nftC = await mintNft(umi, cm, mintC, destinationAtaC, cl, 'GROUPC'); // 5 C tokens.
  const nftD = generateSigner(umi); // 7 D tokens.
  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      mintV2(umi, {
        candyMachine,
        nftMint: nftD,
        collectionMint,
        collectionUpdateAuthority: umi.identity.publicKey,
        group: some('GROUPD'),
        mintArgs: {
          tokenPayment: some({
            mint: mintD.publicKey,
            destinationAta: destinationAtaD,
          }),
        },
      })
    )
    .sendAndConfirm(umi);

  // Then all NFTs except for group D have been frozen.
  const [tokenA, tokenB, tokenC, tokenD] = await Promise.all(
    [nftA, nftB, nftC, nftD].map(
      ({ publicKey: mint }): Promise<Token> =>
        fetchToken(
          umi,
          findAssociatedTokenPda(umi, { mint, owner: umi.identity.publicKey })
        )
    )
  );
  t.is(tokenA.state, TokenState.Frozen, 'NFT A is frozen');
  t.is(tokenB.state, TokenState.Frozen, 'NFT B is frozen');
  t.is(tokenC.state, TokenState.Frozen, 'NFT C is frozen');
  t.is(tokenD.state, TokenState.Initialized, 'NFT D is not frozen');

  // And the treasury escrow received tokens.
  const escrowAB = getFreezeEscrow(umi, candyMachine, destinationAtaAB);
  const escrowC = getFreezeEscrow(umi, candyMachine, destinationAtaC);
  const escrowBalanceAB = await getTokenBalance(umi, mintAB, escrowAB);
  const escrowBalanceC = await getTokenBalance(umi, mintC, escrowC);
  t.is(escrowBalanceAB, 4, 'treasury AB escrow ATA received tokens');
  t.is(escrowBalanceC, 5, 'treasury C escrow ATA received tokens');

  // And the payer lost tokens.
  const payerTokensAB = await getTokenBalance(umi, mintAB, umi.identity);
  const payerTokensC = await getTokenBalance(umi, mintC, umi.identity);
  const payerTokensD = await getTokenBalance(umi, mintD, umi.identity);
  t.is(payerTokensAB, 10 - 4, 'payer lost AB tokens');
  t.is(payerTokensC, 10 - 5, 'payer lost C tokens');
  t.is(payerTokensD, 10 - 7, 'payer lost D tokens');

  // And the frozen counters securely decrease as we thaw all frozen NFTs.
  const assertFrozenCounts = async (ab: number, c: number) => {
    await Promise.all([
      assertFrozenCount(t, umi, candyMachine, destinationAtaAB, ab),
      assertFrozenCount(t, umi, candyMachine, destinationAtaC, c),
    ]);
  };
  await assertFrozenCounts(2, 1);
  await thawNft(umi, cm, mintAB, destinationAtaAB, nftD.publicKey, 'GROUPA'); // Not frozen.
  await assertFrozenCounts(2, 1); // No change.
  await thawNft(umi, cm, mintAB, destinationAtaAB, nftA.publicKey, 'GROUPA');
  await assertFrozenCounts(1, 1); // AB decreased.
  await thawNft(umi, cm, mintAB, destinationAtaAB, nftA.publicKey, 'GROUPA'); // Already thawed.
  await assertFrozenCounts(1, 1); // No change.
  await thawNft(umi, cm, mintAB, destinationAtaAB, nftB.publicKey, 'GROUPB');
  await assertFrozenCounts(0, 1); // AB decreased.
  await thawNft(umi, cm, mintC, destinationAtaC, nftC.publicKey, 'GROUPC');
  await assertFrozenCounts(0, 0); // C decreased.

  // And when the authority unlocks the funds of both freeze escrows.
  await unlockFunds(umi, cm, mintAB, destinationAtaAB, 'GROUPA');
  await unlockFunds(umi, cm, mintC, destinationAtaC, 'GROUPC');

  // Note that trying to unlock the funds of group B will fail
  // because it has already been unlocked via group A.
  await t.throwsAsync(
    unlockFunds(umi, cm, mintAB, destinationAtaAB, 'GROUPB'),
    { message: /AccountNotInitialized/ }
  );

  // Then the treasuries received the funds.
  t.is(await getTokenBalance(umi, mintAB, destinationAB.publicKey), 4);
  t.is(await getTokenBalance(umi, mintC, destinationC.publicKey), 5);
  t.is(await getTokenBalance(umi, mintD, destinationD.publicKey), 7);

  // And the treasury escrows ATA no longer exist.
  const [escrowAtaAB] = findAssociatedTokenPda(umi, {
    mint: mintAB.publicKey,
    owner: getFreezeEscrow(umi, candyMachine, destinationAtaAB)[0],
  });
  const [escrowAtaC] = findAssociatedTokenPda(umi, {
    mint: mintC.publicKey,
    owner: getFreezeEscrow(umi, candyMachine, destinationAtaC)[0],
  });
  t.false(
    await umi.rpc.accountExists(escrowAtaAB),
    'treasury AB escrow ATA no longer exists'
  );
  t.false(
    await umi.rpc.accountExists(escrowAtaC),
    'treasury C escrow ATA no longer exists'
  );
});

test('it fails to mint if the freeze escrow was not initialized', async (t) => {
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
    configLines: [{ name: 'Degen #1', uri: 'https://example.com/degen/1' }],
    guards: {
      freezeTokenPayment: some({
        mint: tokenMint.publicKey,
        destinationAta,
        amount: 1,
      }),
    },
  });

  // When we try to mint without initializing the freeze escrow.
  const mint = generateSigner(umi);
  const promise = transactionBuilder()
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
    .sendAndConfirm(umi);

  // Then we expect an error.
  await t.throwsAsync(promise, { message: /FreezeNotInitialized/ });
});

test('it fails to mint if the payer does not have enough tokens', async (t) => {
  // Given a token mint with holders such that the identity has 4 tokens.
  const umi = await createUmi();
  const destination = generateSigner(umi);
  const [tokenMint, destinationAta] = await createMintWithHolders(umi, {
    holders: [
      { owner: destination, amount: 0 },
      { owner: umi.identity, amount: 4 },
    ],
  });

  // And a loaded Candy Machine with an initialized
  // freezeTokenPayment guard costing 5 tokens.
  const collectionMint = (await createCollectionNft(umi)).publicKey;
  const { publicKey: candyMachine } = await createV2(umi, {
    collectionMint,
    configLines: [{ name: 'Degen #1', uri: 'https://example.com/degen/1' }],
    guards: {
      freezeTokenPayment: some({
        mint: tokenMint.publicKey,
        destinationAta,
        amount: 5,
      }),
    },
  });
  await initFreezeEscrow(umi, candyMachine, tokenMint, destinationAta);

  // When the identity tries to mint from it.
  const mint = generateSigner(umi);
  const promise = transactionBuilder()
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
    .sendAndConfirm(umi);

  // Then we expect an error.
  await t.throwsAsync(promise, { message: /NotEnoughTokens/ });
});

test('it charges a bot tax if something goes wrong', async (t) => {
  // Given a token mint with holders such that the identity has 10 tokens.
  const umi = await createUmi();
  const destination = generateSigner(umi);
  const [tokenMint, destinationAta] = await createMintWithHolders(umi, {
    holders: [
      { owner: destination, amount: 0 },
      { owner: umi.identity, amount: 10 },
    ],
  });

  // And a loaded Candy Machine with a freezeTokenPayment guard and a bot tax guard.
  const collectionMint = (await createCollectionNft(umi)).publicKey;
  const { publicKey: candyMachine } = await createV2(umi, {
    collectionMint,
    configLines: [{ name: 'Degen #1', uri: 'https://example.com/degen/1' }],
    guards: {
      botTax: some({ lamports: sol(0.1), lastInstruction: true }),
      freezeTokenPayment: some({
        mint: tokenMint.publicKey,
        destinationAta,
        amount: 1,
      }),
    },
  });

  // When we try to mint without initializing the freeze escrow.
  const mint = generateSigner(umi);
  const { signature } = await transactionBuilder()
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
    .sendAndConfirm(umi);

  // Then we expect a silent bot tax error.
  await assertBotTax(t, umi, mint, signature, /FreezeNotInitialized/);
});

test('it transfers tokens to an escrow account and locks the Programmable NFT', async (t) => {
  // Given a token mint with holders such that the identity has 10 tokens.
  const umi = await createUmi();
  const destination = generateSigner(umi);
  const [tokenMint, destinationAta] = await createMintWithHolders(umi, {
    holders: [
      { owner: destination, amount: 0 },
      { owner: umi.identity, amount: 10 },
    ],
  });

  // And a loaded PNFT Candy Machine with a freezeTokenPayment guard.
  const collectionMint = (await createCollectionNft(umi)).publicKey;
  const { publicKey: candyMachine } = await createV2(umi, {
    tokenStandard: TokenStandard.ProgrammableNonFungible,
    ruleSet: METAPLEX_DEFAULT_RULESET,
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

  // When we mint from that candy machine.
  const mint = generateSigner(umi);
  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 800_000 }))
    .add(
      mintV2(umi, {
        candyMachine,
        nftMint: mint,
        collectionMint,
        collectionUpdateAuthority: umi.identity.publicKey,
        mintArgs: {
          freezeTokenPayment: some({
            mint: tokenMint.publicKey,
            destinationAta,
            nftRuleSet: METAPLEX_DEFAULT_RULESET,
          }),
        },
        tokenStandard: TokenStandard.ProgrammableNonFungible,
        authorizationRulesProgram: getMplTokenAuthRulesProgramId(umi),
      })
    )
    .sendAndConfirm(umi);

  // Then minting was successful.
  await assertSuccessfulMint(t, umi, { mint, owner: umi.identity });

  // And the pNFT is frozen.
  const [ata] = findAssociatedTokenPda(umi, {
    mint: mint.publicKey,
    owner: umi.identity.publicKey,
  });
  const tokenAccount = await fetchToken(umi, ata);
  t.is(tokenAccount.state, TokenState.Frozen);

  // And the token record is locked.
  const [tokenRecord] = findTokenRecordPda(umi, {
    mint: mint.publicKey,
    token: ata,
  });
  const tokenRecodAccount = await fetchTokenRecord(umi, tokenRecord);
  t.is(tokenRecodAccount.state, MetadataTokenState.Locked);

  // And cannot be thawed since not all NFTs have been minted.
  const promise = thawNft(
    umi,
    candyMachine,
    tokenMint,
    destinationAta,
    mint.publicKey
  );
  await t.throwsAsync(promise, { message: /ThawNotEnabled/ });

  // And the treasury escrow received tokens.
  const freezeEscrow = getFreezeEscrow(umi, candyMachine, destinationAta);
  const escrowTokens = await getTokenBalance(umi, tokenMint, freezeEscrow);
  t.is(escrowTokens, 1, 'treasury escrow received tokens');

  // And was assigned the right data.
  const freezeEscrowAccount = await fetchFreezeEscrow(umi, freezeEscrow);
  t.true(isSome(freezeEscrowAccount.firstMintTime));
  t.like(freezeEscrowAccount, <FreezeEscrow>{
    candyMachine: publicKey(candyMachine),
    candyGuard: publicKey(findCandyGuardPda(umi, { base: candyMachine })),
    frozenCount: 1n,
    freezePeriod: BigInt(15 * 24 * 3600),
    destination: publicKey(destinationAta),
    authority: publicKey(umi.identity),
  });

  // And the payer lost tokens.
  const payerBalance = await getTokenBalance(umi, tokenMint, umi.identity);
  t.is(payerBalance, 9, 'payer lost tokens');
});

test('it can thaw a Programmable NFT once all NFTs are minted', async (t) => {
  // Given a token mint with holders such that the identity has 10 tokens.
  const umi = await createUmi();
  const destination = generateSigner(umi);
  const [tokenMint, destinationAta] = await createMintWithHolders(umi, {
    holders: [
      { owner: destination, amount: 0 },
      { owner: umi.identity, amount: 10 },
    ],
  });

  // And a loaded Candy Machine with a ruleSet and an initialized
  // freezeTokenPayment guard with only one item.
  const collectionMint = (await createCollectionNft(umi)).publicKey;
  const { publicKey: candyMachine } = await createV2(umi, {
    collectionMint,
    tokenStandard: TokenStandard.ProgrammableNonFungible,
    ruleSet: METAPLEX_DEFAULT_RULESET,
    configLines: [{ name: 'Degen #1', uri: 'https://example.com/degen/1' }],
    guards: {
      freezeTokenPayment: some({
        mint: tokenMint.publicKey,
        destinationAta,
        amount: 1,
      }),
    },
  });
  await initFreezeEscrow(umi, candyMachine, tokenMint, destinationAta);

  // And given we minted the only PNFT from that candy machine.
  const mint = generateSigner(umi);
  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 800_000 }))
    .add(
      mintV2(umi, {
        candyMachine,
        nftMint: mint,
        collectionMint,
        collectionUpdateAuthority: umi.identity.publicKey,
        mintArgs: {
          freezeTokenPayment: some({
            mint: tokenMint.publicKey,
            destinationAta,
            nftRuleSet: METAPLEX_DEFAULT_RULESET,
          }),
        },
        tokenStandard: TokenStandard.ProgrammableNonFungible,
        authorizationRulesProgram: getMplTokenAuthRulesProgramId(umi),
      })
    )
    .sendAndConfirm(umi);

  // And that is it locked.
  const [tokenRecord] = findTokenRecordPda(umi, {
    mint: mint.publicKey,
    token: findAssociatedTokenPda(umi, {
      mint: mint.publicKey,
      owner: umi.identity.publicKey,
    })[0],
  });
  let tokenRecordAccount = await fetchTokenRecord(umi, tokenRecord);
  t.is(tokenRecordAccount.state, MetadataTokenState.Locked);

  // When we thaw the locked PNFT.
  await setComputeUnitLimit(umi, { units: 600_000 })
    .add(
      route(umi, {
        candyMachine,
        guard: 'freezeTokenPayment',
        routeArgs: {
          path: 'thaw',
          nftMint: mint.publicKey,
          nftOwner: umi.identity.publicKey,
          nftTokenStandard: TokenStandard.ProgrammableNonFungible,
          mint: tokenMint.publicKey,
          destinationAta,
          nftRuleSet: METAPLEX_DEFAULT_RULESET,
        },
      })
    )
    .sendAndConfirm(umi);

  // Then the PNFT is unlocked.
  tokenRecordAccount = await fetchTokenRecord(umi, tokenRecord);
  t.is(tokenRecordAccount.state, MetadataTokenState.Unlocked);

  // And the freeze escrow ATA account is closed.
  t.false(
    await umi.rpc.accountExists(
      findAssociatedTokenPda(umi, {
        mint: mint.publicKey,
        owner: findFreezeEscrowPda(umi, {
          destination: destinationAta,
          candyMachine,
          candyGuard: findCandyGuardPda(umi, { base: candyMachine })[0],
        })[0],
      })[0]
    )
  );
});

const getTokenBalance = async (
  umi: Umi,
  mint: PublicKey | Signer,
  owner: PublicKey | Pda | Signer
) => {
  const ata = findAssociatedTokenPda(umi, {
    mint: publicKey(mint, false),
    owner: publicKey(owner, false),
  });
  const tokenAccount = await fetchToken(umi, ata);
  return Number(tokenAccount.amount);
};

const getTokenState = async (
  umi: Umi,
  mint: PublicKey | Signer,
  owner: PublicKey | Pda | Signer
) => {
  const ata = findAssociatedTokenPda(umi, {
    mint: publicKey(mint, false),
    owner: publicKey(owner, false),
  });
  const tokenAccount = await fetchToken(umi, ata);
  return tokenAccount.state;
};

const getFreezeEscrow = (
  umi: Umi,
  candyMachine: PublicKey,
  destinationAta: PublicKey | Pda
) =>
  findFreezeEscrowPda(umi, {
    candyMachine,
    candyGuard: findCandyGuardPda(umi, { base: candyMachine })[0],
    destination: publicKey(destinationAta, false),
  });

const getFrozenCount = async (
  umi: Umi,
  candyMachine: PublicKey,
  destinationAta: PublicKey | Pda
) => {
  const pda = getFreezeEscrow(umi, candyMachine, destinationAta);
  const account = await fetchFreezeEscrow(umi, pda);
  return Number(account.frozenCount);
};

const assertFrozenCount = async (
  t: Assertions,
  umi: Umi,
  candyMachine: PublicKey,
  destinationAta: PublicKey | Pda,
  expected: number
): Promise<void> => {
  const frozenCount = await getFrozenCount(umi, candyMachine, destinationAta);
  t.is(frozenCount, expected, 'frozen count is correct');
};

const initFreezeEscrow = async (
  umi: Umi,
  candyMachine: PublicKey,
  tokenMint: PublicKey | Signer,
  destinationAta: PublicKey | Pda,
  group?: string
) => {
  await transactionBuilder()
    .add(
      route(umi, {
        candyMachine,
        guard: 'freezeTokenPayment',
        group: group ? some(group) : none(),
        routeArgs: {
          path: 'initialize',
          period: 15 * 24 * 3600, // 15 days.
          candyGuardAuthority: umi.identity,
          mint: publicKey(tokenMint),
          destinationAta: publicKey(destinationAta),
        },
      })
    )
    .sendAndConfirm(umi);
};

const mintNft = async (
  umi: Umi,
  candyMachine: PublicKey,
  tokenMint: PublicKey | Signer,
  destinationAta: PublicKey,
  collectionMint: PublicKey,
  group?: string
) => {
  const mint = generateSigner(umi);
  await transactionBuilder()
    .add(setComputeUnitLimit(umi, { units: 600_000 }))
    .add(
      mintV2(umi, {
        candyMachine,
        nftMint: mint,
        collectionMint,
        collectionUpdateAuthority: umi.identity.publicKey,
        group: group ? some(group) : none(),
        mintArgs: {
          freezeTokenPayment: some({
            mint: publicKey(tokenMint),
            destinationAta,
          }),
        },
      })
    )
    .sendAndConfirm(umi);

  return mint;
};

const thawNft = async (
  umi: Umi,
  candyMachine: PublicKey,
  tokenMint: PublicKey | Signer,
  destinationAta: PublicKey,
  nftMint: PublicKey,
  group?: string,
  nftOwner?: PublicKey
) => {
  const candyMachineAccount = await fetchCandyMachine(umi, candyMachine);
  await route(umi, {
    candyMachine,
    guard: 'freezeTokenPayment',
    group: group ? some(group) : none(),
    routeArgs: {
      path: 'thaw',
      nftMint,
      nftOwner: nftOwner ?? umi.identity.publicKey,
      nftTokenStandard: candyMachineAccount.tokenStandard,
      mint: publicKey(tokenMint),
      destinationAta,
    },
  }).sendAndConfirm(umi);
};

const unlockFunds = async (
  umi: Umi,
  candyMachine: PublicKey,
  tokenMint: PublicKey | Signer,
  destinationAta: PublicKey,
  group?: string,
  candyGuardAuthority?: Signer
) => {
  await route(umi, {
    candyMachine,
    guard: 'freezeTokenPayment',
    group: group ? some(group) : none(),
    routeArgs: {
      path: 'unlockFunds',
      candyGuardAuthority: candyGuardAuthority ?? umi.identity,
      mint: publicKey(tokenMint),
      destinationAta,
    },
  }).sendAndConfirm(umi);
};
