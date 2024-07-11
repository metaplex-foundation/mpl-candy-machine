/* eslint-disable import/no-extraneous-dependencies */
import {
  DigitalAssetWithToken,
  TokenStandard as MplTokenStandard,
  createNft as baseCreateNft,
  createProgrammableNft as baseCreateProgrammableNft,
  fetchDigitalAssetWithAssociatedToken,
  findMasterEditionPda,
  findMetadataPda,
  verifyCollectionV1,
} from '@metaplex-foundation/mpl-token-metadata';
import { create as baseCreateCoreAsset } from '@metaplex-foundation/mpl-core';
import {
  createAssociatedToken,
  createMint,
  findAssociatedTokenPda,
  mintTokensTo,
} from '@metaplex-foundation/mpl-toolbox';
import {
  Context,
  DateTime,
  PublicKey,
  PublicKeyInput,
  Signer,
  TransactionSignature,
  Umi,
  assertAccountExists,
  defaultPublicKey,
  generateSigner,
  now,
  percentAmount,
  publicKey,
  some,
  transactionBuilder,
} from '@metaplex-foundation/umi';
import { createUmi as basecreateUmi } from '@metaplex-foundation/umi-bundle-tests';
import { Keypair } from '@solana/web3.js';
import { Assertions } from 'ava';
import {
  CandyGuardDataArgs,
  ConfigLine,
  ConfigLineInput,
  CreateCandyGuardInstructionAccounts,
  CreateCandyGuardInstructionDataArgs,
  DefaultGuardSetArgs,
  GuardSetArgs,
  TokenStandard,
  addNft,
  createCandyGuard as baseCreateCandyGuard,
  createCandyMachineV2 as baseCreateCandyMachineV2,
  fetchCandyMachine,
  findCandyGuardPda,
  mplCandyMachine,
  wrap,
} from '../src';

export const METAPLEX_DEFAULT_RULESET = publicKey(
  'eBJLFYPxJmMGKuFwpDWkzxZeUrad92kZRC5BJLpzyT9'
);

export const createUmi = async () =>
  (await basecreateUmi()).use(mplCandyMachine());

export const createNft = async (
  umi: Umi,
  input: Partial<Parameters<typeof baseCreateNft>[1]> = {}
): Promise<Signer> => {
  const mint = generateSigner(umi);
  await baseCreateNft(umi, {
    mint,
    ...defaultAssetData(),
    ...input,
  }).sendAndConfirm(umi);

  return mint;
};

export const createCoreAsset = async (
  umi: Umi,
  input: Partial<Parameters<typeof baseCreateCoreAsset>[1]> = {}
): Promise<Signer> => {
  const asset = generateSigner(umi);
  await baseCreateCoreAsset(umi, {
    asset,
    ...defaultAssetData(),
    ...input,
  }).sendAndConfirm(umi);

  return asset;
};

export const createProgrammableNft = async (
  umi: Umi,
  input: Partial<Parameters<typeof baseCreateProgrammableNft>[1]> = {}
): Promise<Signer> => {
  const mint = generateSigner(umi);
  await baseCreateProgrammableNft(umi, {
    mint,
    ...defaultAssetData(),
    ...input,
  }).sendAndConfirm(umi);

  return mint;
};

export const createCollectionNft = async (
  umi: Umi,
  input: Partial<Parameters<typeof baseCreateNft>[1]> = {}
): Promise<Signer> => createNft(umi, { ...input, isCollection: true });

export const createVerifiedNft = async (
  umi: Umi,
  input: Partial<Parameters<typeof baseCreateNft>[1]> & {
    collectionMint: PublicKey;
    collectionAuthority?: Signer;
  }
): Promise<Signer> => {
  const { collectionMint, collectionAuthority = umi.identity, ...rest } = input;
  const mint = await createNft(umi, {
    ...rest,
    collection: some({ verified: false, key: collectionMint }),
  });
  const effectiveMint = publicKey(rest.mint ?? mint.publicKey);

  await transactionBuilder()
    .add(
      verifyCollectionV1(umi, {
        authority: collectionAuthority,
        collectionMint,
        metadata: findMetadataPda(umi, { mint: effectiveMint })[0],
      })
    )
    .sendAndConfirm(umi);

  return mint;
};

export const createVerifiedProgrammableNft = async (
  umi: Umi,
  input: Partial<Parameters<typeof baseCreateNft>[1]> & {
    collectionMint: PublicKey;
    collectionAuthority?: Signer;
  }
): Promise<Signer> => {
  const { collectionMint, collectionAuthority = umi.identity, ...rest } = input;
  const mint = await createProgrammableNft(umi, {
    ...rest,
    collection: some({ verified: false, key: collectionMint }),
  });
  const effectiveMint = publicKey(rest.mint ?? mint.publicKey);

  await transactionBuilder()
    .add(
      verifyCollectionV1(umi, {
        authority: collectionAuthority,
        collectionMint,
        metadata: findMetadataPda(umi, { mint: effectiveMint })[0],
      })
    )
    .sendAndConfirm(umi);

  return mint;
};

export const createMintWithHolders = async (
  umi: Umi,
  input: Partial<Omit<Parameters<typeof createMint>[1], 'mintAuthority'>> & {
    mintAuthority?: Signer;
    holders: { owner: PublicKeyInput; amount: number | bigint }[];
  }
): Promise<[Signer, ...PublicKey[]]> => {
  const atas = [] as PublicKey[];
  const mint = input.mint ?? generateSigner(umi);
  const mintAuthority = input.mintAuthority ?? umi.identity;
  let builder = transactionBuilder().add(
    createMint(umi, {
      ...input,
      mint,
      mintAuthority: mintAuthority.publicKey,
    })
  );
  input.holders.forEach((holder) => {
    const owner = publicKey(holder.owner);
    const [token] = findAssociatedTokenPda(umi, {
      mint: mint.publicKey,
      owner,
    });
    atas.push(token);
    builder = builder.add(
      createAssociatedToken(umi, { mint: mint.publicKey, owner })
    );
    if (holder.amount > 0) {
      builder = builder.add(
        mintTokensTo(umi, {
          mint: mint.publicKey,
          token,
          amount: holder.amount,
          mintAuthority,
        })
      );
    }
  });
  await builder.sendAndConfirm(umi);

  return [mint, ...atas];
};

export const createV2 = async <DA extends GuardSetArgs = DefaultGuardSetArgs>(
  umi: Umi,
  input: Partial<Parameters<typeof baseCreateCandyMachineV2>[1]> &
    Partial<
      CandyGuardDataArgs<DA extends undefined ? DefaultGuardSetArgs : DA>
    > & { configLineIndex?: number; configLines?: ConfigLine[] } = {}
) => {
  const candyMachine = input.candyMachine ?? generateSigner(umi);
  let builder = await baseCreateCandyMachineV2(umi, {
    ...defaultCandyMachineData(umi),
    ...input,
    itemCount: input.itemCount ?? input.configLines?.length ?? 100,
    candyMachine,
  });

  if (input.configLines !== undefined) {
    builder = builder.add(
      addNft(umi, {
        candyMachine: candyMachine.publicKey,
        index: input.configLineIndex ?? 0,
        configLines: input.configLines,
      })
    );
  }

  if (input.guards !== undefined || input.groups !== undefined) {
    const candyGuard = findCandyGuardPda(umi, { base: candyMachine.publicKey });
    builder = builder
      .add(baseCreateCandyGuard<DA>(umi, { ...input, base: candyMachine }))
      .add(
        wrap(umi, {
          candyMachine: candyMachine.publicKey,
          candyGuard,
        })
      );
  }

  await builder.sendAndConfirm(umi);
  return candyMachine;
};

export const defaultAssetData = () => ({
  name: 'My Asset',
  sellerFeeBasisPoints: percentAmount(10, 2),
  uri: 'https://example.com/my-asset.json',
});

export const defaultCandyMachineData = (
  context: Pick<Context, 'identity'>
) => ({
  tokenStandard: MplTokenStandard.NonFungible,
  collectionUpdateAuthority: context.identity,
  itemCount: 100,
  sellerFeeBasisPoints: percentAmount(10, 2),
  creators: [
    {
      address: context.identity.publicKey,
      verified: true,
      percentageShare: 100,
    },
  ],
  configLineSettings: some({
    prefixName: '',
    nameLength: 32,
    prefixUri: '',
    uriLength: 200,
    isSequential: false,
  }),
});

export const createCandyGuard = async <
  DA extends GuardSetArgs = DefaultGuardSetArgs
>(
  umi: Umi,
  input: Partial<
    CreateCandyGuardInstructionAccounts &
      CreateCandyGuardInstructionDataArgs<
        DA extends undefined ? DefaultGuardSetArgs : DA
      >
  > = {}
) => {
  const base = input.base ?? generateSigner(umi);
  await transactionBuilder()
    .add(baseCreateCandyGuard<DA>(umi, { ...input, base }))
    .sendAndConfirm(umi);

  return findCandyGuardPda(umi, { base: base.publicKey });
};

export const assertSuccessfulMint = async (
  t: Assertions,
  umi: Umi,
  input: {
    mint: PublicKey | Signer;
    owner: PublicKey | Signer;
    token?: PublicKey;
    tokenStandard?: MplTokenStandard;
    name?: string | RegExp;
    uri?: string | RegExp;
  }
) => {
  const mint = publicKey(input.mint);
  const owner = publicKey(input.owner);
  const {
    token = findAssociatedTokenPda(umi, { mint, owner }),
    tokenStandard,
    name,
    uri,
  } = input;

  // Nft.
  const nft = await fetchDigitalAssetWithAssociatedToken(umi, mint, owner);
  t.like(nft, <DigitalAssetWithToken>{
    publicKey: publicKey(mint),
    mint: {
      publicKey: publicKey(mint),
      supply: 1n,
    },
    token: {
      publicKey: publicKey(token),
      mint: publicKey(mint),
      owner: publicKey(owner),
      amount: 1n,
    },
    edition: {
      isOriginal: true,
    },
    metadata: {
      tokenStandard: { __option: 'Some' },
      primarySaleHappened: true,
    },
  });

  // Token Stardard.
  if (tokenStandard !== undefined) {
    t.deepEqual(nft.metadata.tokenStandard, some(tokenStandard));
  }

  // Name.
  if (typeof name === 'string') t.is(nft.metadata.name, name);
  else if (name !== undefined) t.regex(nft.metadata.name, name);

  // Uri.
  if (typeof uri === 'string') t.is(nft.metadata.uri, uri);
  else if (uri !== undefined) t.regex(nft.metadata.uri, uri);
};

export const assertItemBought = async (
  t: Assertions,
  umi: Umi,
  input: {
    candyMachine: PublicKey;
    buyer?: PublicKey;
    count?: number;
  }
) => {
  const candyMachineAccount = await fetchCandyMachine(umi, input.candyMachine);

  const buyerCount = candyMachineAccount.items.filter(
    (item) => item.buyer === (input.buyer ?? umi.identity.publicKey)
  ).length;

  t.is(buyerCount, input.count ?? 1);
};

export const assertBotTax = async (
  t: Assertions,
  umi: Umi,
  signature: TransactionSignature,
  extraRegex?: RegExp
) => {
  const transaction = await umi.rpc.getTransaction(signature);
  t.true(transaction !== null);
  const logs = transaction!.meta.logs.join('');
  t.regex(logs, /Candy Guard Botting is taxed/);
  if (extraRegex !== undefined) t.regex(logs, extraRegex);
};

export const assertBurnedNft = async (
  t: Assertions,
  umi: Umi,
  mint: Signer | PublicKey,
  owner?: Signer | PublicKey
) => {
  owner = owner ?? umi.identity;
  const [tokenAccount] = findAssociatedTokenPda(umi, {
    mint: publicKey(mint),
    owner: publicKey(owner),
  });
  const [metadataAccount] = findMetadataPda(umi, { mint: publicKey(mint) });
  const [editionAccount] = findMasterEditionPda(umi, { mint: publicKey(mint) });

  const metadata = await umi.rpc.getAccount(metadataAccount);
  // Metadata accounts is not closed since it contains fees but
  // the data length should be 1.
  t.true(metadata.exists);
  assertAccountExists(metadata);
  t.true(metadata.data.length === 1);

  t.false(await umi.rpc.accountExists(tokenAccount));
  t.false(await umi.rpc.accountExists(editionAccount));
};

export const yesterday = (): DateTime => now() - 3600n * 24n;
export const tomorrow = (): DateTime => now() + 3600n * 24n;

export const getNewConfigLine = async (
  umi: Umi,
  overrides?: Partial<ConfigLineInput>
): Promise<ConfigLineInput> => ({
  mint: (await createNft(umi)).publicKey,
  seller: publicKey(Keypair.generate().publicKey),
  ...overrides,
});
