import { isProgrammable } from '@metaplex-foundation/mpl-token-metadata';
import { isNone, none, Option, PublicKey } from '@metaplex-foundation/umi';
import {
  array,
  bitArray,
  mapSerializer,
  option,
  publicKey,
  Serializer,
  string,
  struct,
  u32,
} from '@metaplex-foundation/umi/serializers';
import { CANDY_MACHINE_HIDDEN_SECTION } from '../constants';
import {
  CandyMachineAccountData as BaseCandyMachineAccountData,
  CandyMachineAccountDataArgs as BaseCandyMachineAccountDataArgs,
  getCandyMachineAccountDataSerializer as baseGetCandyMachineAccountDataSerializer,
} from '../generated/types/candyMachineAccountData';

export type CandyMachineAccountData = BaseCandyMachineAccountData & {
  itemsLoaded: number;
  items: CandyMachineItem[];
  ruleSet: Option<PublicKey>;
};

export type CandyMachineAccountDataArgs = BaseCandyMachineAccountDataArgs;

/**
 * Represent an item inside a Candy Machine that has been or
 * will eventually be minted into an NFT.
 *
 * It only contains the name and the URI of the NFT to be as
 * the rest of the data is shared by all NFTs and lives
 * in the Candy Machine configurations (e.g. `symbol`, `creators`, etc).
 */
export type CandyMachineItem = {
  /** The index of the config line. */
  readonly index: number;

  /** Whether the item has been minted or not. */
  readonly minted: boolean;

  /** The name of the NFT to be. */
  readonly name: string;

  /** The URI of the NFT to be, pointing to some off-chain JSON Metadata. */
  readonly uri: string;
};

type CandyMachineHiddenSection = {
  itemsLoaded: number;
  rawConfigLines: { name: string; uri: string }[];
  itemsLoadedMap: boolean[];
  itemsLeftToMint: number[];
};

export function getCandyMachineAccountDataSerializer(): Serializer<
  CandyMachineAccountDataArgs,
  CandyMachineAccountData
> {
  return mapSerializer<
    CandyMachineAccountDataArgs,
    BaseCandyMachineAccountDataArgs,
    CandyMachineAccountData,
    BaseCandyMachineAccountData
  >(
    baseGetCandyMachineAccountDataSerializer(),
    (args) => args,
    (base, bytes, offset) => {
      const slice = bytes.slice(offset + CANDY_MACHINE_HIDDEN_SECTION);

      const deserializeRuleSet = (
        ruleBytes: Uint8Array,
        ruleOffset = 0
      ): [Option<PublicKey>, number] => {
        if (!isProgrammable(base.tokenStandard)) return [none(), ruleOffset];
        return option(publicKey(), { fixed: true }).deserialize(
          ruleBytes,
          ruleOffset
        );
      };

      if (isNone(base.data.configLineSettings)) {
        return {
          ...base,
          items: [],
          itemsLoaded: 0,
          ruleSet: deserializeRuleSet(slice)[0],
        };
      }

      const itemsAvailable = Number(base.data.itemsAvailable);
      const itemsMinted = Number(base.itemsRedeemed);
      const itemsRemaining = itemsAvailable - itemsMinted;
      const { isSequential, nameLength, uriLength, prefixName, prefixUri } =
        base.data.configLineSettings.value;

      const hiddenSectionSerializer: Serializer<CandyMachineHiddenSection> =
        struct<CandyMachineHiddenSection>([
          ['itemsLoaded', u32()],
          [
            'rawConfigLines',
            array(
              struct<{ name: string; uri: string }>([
                ['name', string({ size: nameLength })],
                ['uri', string({ size: uriLength })],
              ]),
              { size: itemsAvailable }
            ),
          ],
          ['itemsLoadedMap', bitArray(Math.floor(itemsAvailable / 8) + 1)],
          ['itemsLeftToMint', array(u32(), { size: itemsAvailable })],
        ]);

      const [hiddenSection, hiddenSectionOffset] =
        hiddenSectionSerializer.deserialize(slice);

      const itemsLeftToMint = hiddenSection.itemsLeftToMint.slice(
        0,
        itemsRemaining
      );
      const items: CandyMachineItem[] = [];
      hiddenSection.itemsLoadedMap.forEach((loaded, index) => {
        if (!loaded) return;
        const rawItem = hiddenSection.rawConfigLines[index];
        items.push({
          index,
          minted: isSequential
            ? index < itemsMinted
            : !itemsLeftToMint.includes(index),
          name: replaceItemPattern(prefixName, index) + rawItem.name,
          uri: replaceItemPattern(prefixUri, index) + rawItem.uri,
        });
      });

      return {
        ...base,
        items,
        itemsLoaded: hiddenSection.itemsLoaded,
        ruleSet: deserializeRuleSet(slice, hiddenSectionOffset)[0],
      };
    }
  );
}

function replaceItemPattern(value: string, index: number): string {
  return value.replace('$ID+1$', `${index + 1}`).replace('$ID$', `${index}`);
}
