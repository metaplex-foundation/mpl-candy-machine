/* eslint-disable import/no-extraneous-dependencies */
import {
  createNft,
  TokenStandard,
} from '@metaplex-foundation/mpl-token-metadata';
import {
  Context,
  generateSigner,
  percentAmount,
  Signer,
  some,
  transactionBuilder,
  Umi,
} from '@metaplex-foundation/umi';
import { createUmi as basecreateUmi } from '@metaplex-foundation/umi-bundle-tests';
import {
  addConfigLines,
  CandyGuardDataArgs,
  ConfigLine,
  createCandyGuard as baseCreateCandyGuard,
  CreateCandyGuardInstructionAccounts,
  CreateCandyGuardInstructionDataArgs,
  createCandyMachine as baseCreateCandyMachine,
  createV2CandyMachine as baseCreateV2CandyMachine,
  DefaultGuardSetArgs,
  findCandyGuardPda,
  GuardSetArgs,
  mplCandyMachine,
  wrap,
} from '../src';

export const createUmi = async () =>
  (await basecreateUmi()).use(mplCandyMachine());

export const createCollectionNft = async (
  umi: Umi,
  input: Partial<Parameters<typeof createNft>[1]> = {}
): Promise<Signer> => {
  const collectionMint = generateSigner(umi);
  await transactionBuilder(umi)
    .add(
      createNft(umi, {
        mint: collectionMint,
        name: 'My collection NFT',
        sellerFeeBasisPoints: percentAmount(10),
        uri: 'https://example.com/my-collection-nft.json',
        isCollection: true,
        ...input,
      })
    )
    .sendAndConfirm();

  return collectionMint;
};

export const createV1 = async <DA extends GuardSetArgs = DefaultGuardSetArgs>(
  umi: Umi,
  input: Partial<Parameters<typeof baseCreateCandyMachine>[1]> &
    Partial<
      CandyGuardDataArgs<DA extends undefined ? DefaultGuardSetArgs : DA>
    > & { configLineIndex?: number; configLines?: ConfigLine[] } = {}
) => {
  const candyMachine = input.candyMachine ?? generateSigner(umi);
  const collectionMint =
    input.collectionMint ?? (await createCollectionNft(umi)).publicKey;
  let builder = transactionBuilder(umi).add(
    await baseCreateCandyMachine(umi, {
      ...defaultCandyMachineData(umi),
      ...input,
      itemsAvailable: input.itemsAvailable ?? input.configLines?.length ?? 100,
      candyMachine,
      collectionMint,
    })
  );

  if (input.configLines !== undefined) {
    builder = builder.add(
      addConfigLines(umi, {
        authority: input.collectionUpdateAuthority ?? umi.identity,
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
      .add(wrap(umi, { candyMachine: candyMachine.publicKey, candyGuard }));
  }

  await builder.sendAndConfirm();
  return candyMachine;
};

export const createV2 = async <DA extends GuardSetArgs = DefaultGuardSetArgs>(
  umi: Umi,
  input: Partial<Parameters<typeof baseCreateV2CandyMachine>[1]> &
    Partial<
      CandyGuardDataArgs<DA extends undefined ? DefaultGuardSetArgs : DA>
    > & { configLineIndex?: number; configLines?: ConfigLine[] } = {}
) => {
  const candyMachine = input.candyMachine ?? generateSigner(umi);
  const collectionMint =
    input.collectionMint ?? (await createCollectionNft(umi)).publicKey;
  let builder = transactionBuilder(umi).add(
    await baseCreateV2CandyMachine(umi, {
      ...defaultCandyMachineData(umi),
      ...input,
      itemsAvailable: input.itemsAvailable ?? input.configLines?.length ?? 100,
      candyMachine,
      collectionMint,
    })
  );

  if (input.configLines !== undefined) {
    builder = builder.add(
      addConfigLines(umi, {
        authority: input.collectionUpdateAuthority ?? umi.identity,
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
      .add(wrap(umi, { candyMachine: candyMachine.publicKey, candyGuard }));
  }

  await builder.sendAndConfirm();
  return candyMachine;
};

export const defaultCandyMachineData = (
  context: Pick<Context, 'identity'>
) => ({
  tokenStandard: TokenStandard.NonFungible,
  collectionUpdateAuthority: context.identity,
  itemsAvailable: 100,
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
  await transactionBuilder(umi)
    .add(baseCreateCandyGuard<DA>(umi, { ...input, base }))
    .sendAndConfirm();

  return findCandyGuardPda(umi, { base: base.publicKey });
};
