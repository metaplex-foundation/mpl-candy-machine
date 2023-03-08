/* eslint-disable import/no-extraneous-dependencies */
import { createNft } from '@metaplex-foundation/mpl-token-metadata';
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
  ConfigLine,
  createCandyGuard as baseCreateCandyGuard,
  CreateCandyGuardInstructionAccounts,
  CreateCandyGuardInstructionDataArgs,
  createCandyMachine as baseCreateCandyMachine,
  DefaultGuardSetArgs,
  findCandyGuardPda,
  GuardSetArgs,
  mplCandyMachine,
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

export const createCandyMachine = async (
  umi: Umi,
  input: Partial<Parameters<typeof baseCreateCandyMachine>[1]> = {}
) => {
  const candyMachine = input.candyMachine ?? generateSigner(umi);
  const collectionMint =
    input.collectionMint ?? (await createCollectionNft(umi)).publicKey;
  await transactionBuilder(umi)
    .add(
      await baseCreateCandyMachine(umi, {
        ...defaultCandyMachineData(umi),
        ...input,
        candyMachine,
        collectionMint,
      })
    )
    .sendAndConfirm();

  return candyMachine;
};

export const createCandyMachineWithItems = async (
  umi: Umi,
  input: Partial<Parameters<typeof baseCreateCandyMachine>[1]> & {
    index?: number;
    items: ConfigLine[];
  }
) => {
  const candyMachine = input.candyMachine ?? generateSigner(umi);
  const collectionMint =
    input.collectionMint ?? (await createCollectionNft(umi)).publicKey;
  await transactionBuilder(umi)
    .add(
      await baseCreateCandyMachine(umi, {
        ...defaultCandyMachineData(umi),
        ...input,
        itemsAvailable: input.itemsAvailable ?? input.items.length,
        candyMachine,
        collectionMint,
      })
    )
    .add(
      addConfigLines(umi, {
        candyMachine: candyMachine.publicKey,
        index: input.index ?? 0,
        configLines: input.items,
      })
    )
    .sendAndConfirm();

  return candyMachine;
};

export const defaultCandyMachineData = (
  context: Pick<Context, 'identity'>
) => ({
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
