import {
  Context,
  generateSigner,
  percentAmount,
  PublicKey,
  publicKey,
  sol,
  some,
  transactionBuilder,
} from '@metaplex-foundation/umi';
import test from 'ava';
import {
  CandyGuard,
  CandyMachine,
  create,
  Creator,
  emptyDefaultGuardSetArgs,
  fetchCandyGuard,
  fetchCandyMachine,
  findCandyGuardPda,
  GuardGroup,
  GuardSet,
} from '../src';
import { createCollectionNft, createUmi } from './_setup';

test('it can create a candy machine with an associated candy guard', async (t) => {
  // Given an existing collection NFT.
  const umi = await createUmi();
  const collectionMint = (await createCollectionNft(umi)).publicKey;

  // When we create a new candy machine with an associated candy guard.
  const candyMachine = generateSigner(umi);
  const destination = generateSigner(umi).publicKey;
  const createInstructions = await create(umi, {
    candyMachine,
    guards: {
      botTax: some({ lamports: sol(0.01), lastInstruction: true }),
      solPayment: some({ lamports: sol(2), destination }),
    },
    ...defaultCandyMachineData(umi, collectionMint),
  });
  await transactionBuilder(umi).add(createInstructions).sendAndConfirm();

  // Then we created a new candy guard derived from the candy machine's address.
  const candyGuard = findCandyGuardPda(umi, { base: candyMachine.publicKey });
  const candyGuardAccount = await fetchCandyGuard(umi, candyGuard);
  t.like(candyGuardAccount, <CandyGuard>{
    publicKey: publicKey(candyGuard),
    base: publicKey(candyMachine),
    authority: publicKey(umi.identity),
    guards: {
      ...emptyDefaultGuardSetArgs,
      botTax: some({ lamports: sol(0.01), lastInstruction: true }),
      solPayment: some({ lamports: sol(2), destination }),
    },
    groups: [] as GuardGroup<GuardSet>[],
  });

  // And the created candy machine uses it as a mint authority.
  const candyMachineAccount = await fetchCandyMachine(
    umi,
    candyMachine.publicKey
  );
  t.like(candyMachineAccount, <CandyMachine>{
    publicKey: publicKey(candyMachine),
    authority: publicKey(umi.identity),
    mintAuthority: publicKey(candyGuard),
  });
});

function defaultCandyMachineData(
  context: Pick<Context, 'identity'>,
  collectionMint: PublicKey
) {
  return {
    collectionMint,
    collectionUpdateAuthority: context.identity,
    itemsAvailable: 100,
    sellerFeeBasisPoints: percentAmount(1.23, 2),
    creators: [] as Creator[],
    configLineSettings: some({
      prefixName: 'My NFT #',
      nameLength: 8,
      prefixUri: 'https://example.com/',
      uriLength: 20,
      isSequential: false,
    }),
  };
}
