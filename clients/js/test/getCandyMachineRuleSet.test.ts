import { TokenStandard } from '@metaplex-foundation/mpl-token-metadata';
import { generateSigner, isNone, none, some } from '@metaplex-foundation/umi';
import test from 'ava';
import { getCandyMachineRuleSet } from '../src';
import {
  createProgrammableNft,
  createUmi,
  createV2,
  METAPLEX_DEFAULT_RULESET,
} from './_setup';

test('it returns the ruleset stored on the candy machine if any', async (t) => {
  // Given an existing PNFT candy machine with a ruleset
  // such that its collection is a PNFT with no ruleset.
  const umi = await createUmi();
  const { publicKey: collectionMint } = await createProgrammableNft(umi, {
    ruleSet: none(),
  });
  const { publicKey: candyMachine } = await createV2(umi, {
    collectionMint,
    tokenStandard: TokenStandard.ProgrammableNonFungible,
    ruleSet: METAPLEX_DEFAULT_RULESET,
  });

  // When we fetch the candy machine ruleset.
  const ruleSet = await getCandyMachineRuleSet(umi, candyMachine);

  // Then we expect the ruleset to be the one stored on the candy machine.
  t.deepEqual(ruleSet, some(METAPLEX_DEFAULT_RULESET));
});

test('it returns the ruleset stored on the collection PNFT if any', async (t) => {
  // Given an existing PNFT candy machine with no ruleset
  // such that its collection is a PNFT with a ruleset.
  const umi = await createUmi();
  const { publicKey: collectionMint } = await createProgrammableNft(umi, {
    ruleSet: some(METAPLEX_DEFAULT_RULESET),
  });
  const { publicKey: candyMachine } = await createV2(umi, {
    collectionMint,
    tokenStandard: TokenStandard.ProgrammableNonFungible,
    ruleSet: undefined,
  });

  // When we fetch the candy machine ruleset.
  const ruleSet = await getCandyMachineRuleSet(umi, candyMachine);

  // Then we expect the ruleset to be the one stored on the collection.
  t.deepEqual(ruleSet, some(METAPLEX_DEFAULT_RULESET));
});

test('it returns the ruleset stored on the candy machine even if a ruleset is stored on the collection PNFT', async (t) => {
  // Given an existing PNFT candy machine with a ruleset
  // such that its collection is a PNFT also with a ruleset.
  const umi = await createUmi();
  const unusedRuleSet = generateSigner(umi).publicKey;
  const { publicKey: collectionMint } = await createProgrammableNft(umi, {
    ruleSet: some(unusedRuleSet),
  });
  const { publicKey: candyMachine } = await createV2(umi, {
    collectionMint,
    tokenStandard: TokenStandard.ProgrammableNonFungible,
    ruleSet: METAPLEX_DEFAULT_RULESET,
  });

  // When we fetch the candy machine ruleset.
  const ruleSet = await getCandyMachineRuleSet(umi, candyMachine);

  // Then we expect the ruleset to be the one stored on the candy machine.
  t.deepEqual(ruleSet, some(METAPLEX_DEFAULT_RULESET));
});

test('it returns none if the collection is a non-programmable NFT', async (t) => {
  // Given an existing candy machine with no ruleset.
  const umi = await createUmi();
  const { publicKey: candyMachine } = await createV2(umi);

  // When we fetch the candy machine ruleset.
  const ruleSet = await getCandyMachineRuleSet(umi, candyMachine);

  // Then we expect the ruleset to be none.
  t.true(isNone(ruleSet));
});

test('it returns none if the collection is a programmable NFT with no ruleset', async (t) => {
  // Given an existing candy machine with a collection NFT that has no ruleset.
  const umi = await createUmi();
  const { publicKey: collectionMint } = await createProgrammableNft(umi, {
    ruleSet: none(),
  });
  const { publicKey: candyMachine } = await createV2(umi, { collectionMint });

  // When we fetch the candy machine ruleset.
  const ruleSet = await getCandyMachineRuleSet(umi, candyMachine);

  // Then we expect the ruleset to be none.
  t.true(isNone(ruleSet));
});
