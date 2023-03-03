/* eslint-disable no-bitwise */
/* eslint-disable no-restricted-syntax */
import {
  Context,
  isNone,
  mapSerializer,
  SdkError,
  Serializer,
} from '@metaplex-foundation/umi';
import { CANDY_MACHINE_HIDDEN_SECTION } from '../constants';
import {
  CandyMachineAccountData as BaseCandyMachineAccountData,
  CandyMachineAccountDataArgs as BaseCandyMachineAccountDataArgs,
  getCandyMachineAccountDataSerializer as baseGetCandyMachineAccountDataSerializer,
} from '../generated/types/candyMachineAccountData';

export type CandyMachineAccountData = BaseCandyMachineAccountData & {
  itemsLoaded: number;
  items: CandyMachineItem[];
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

export function getCandyMachineAccountDataSerializer(
  context: Pick<Context, 'serializer'>
): Serializer<CandyMachineAccountDataArgs, CandyMachineAccountData> {
  const s = context.serializer;
  return mapSerializer<
    CandyMachineAccountDataArgs,
    BaseCandyMachineAccountDataArgs,
    CandyMachineAccountData,
    BaseCandyMachineAccountData
  >(
    baseGetCandyMachineAccountDataSerializer(context),
    (args) => args,
    (base, bytes, offset) => {
      if (isNone(base.data.configLineSettings)) {
        return { ...base, items: [], itemsLoaded: 0 };
      }

      const slice = bytes.slice(offset + CANDY_MACHINE_HIDDEN_SECTION);
      const itemsAvailable = Number(base.data.itemsAvailable);
      const itemsMinted = Number(base.itemsRedeemed);
      const itemsRemaining = itemsAvailable - itemsMinted;
      const { isSequential, nameLength, uriLength, prefixName, prefixUri } =
        base.data.configLineSettings.value;

      const hiddenSectionSerializer: Serializer<CandyMachineHiddenSection> =
        s.struct<CandyMachineHiddenSection>([
          ['itemsLoaded', s.u32()],
          [
            'rawConfigLines',
            s.array(
              s.struct<{ name: string; uri: string }>([
                ['name', s.string({ size: nameLength })],
                ['uri', s.string({ size: uriLength })],
              ]),
              { size: itemsAvailable }
            ),
          ],
          [
            'itemsLoadedMap',
            featureFlagSerializer(Math.floor(itemsAvailable / 8) + 1),
          ],
          ['itemsLeftToMint', s.array(s.u32(), { size: itemsRemaining })],
        ]);

      const [hiddenSection] = hiddenSectionSerializer.deserialize(slice);

      const items: CandyMachineItem[] = [];
      hiddenSection.itemsLoadedMap.forEach((loaded, index) => {
        if (!loaded) return;
        const rawItem = hiddenSection.rawConfigLines[index];
        items.push({
          index,
          minted: isSequential
            ? index < itemsMinted
            : !hiddenSection.itemsLeftToMint.includes(index),
          name: replaceItemPattern(prefixName, index) + rawItem.name,
          uri: replaceItemPattern(prefixUri, index) + rawItem.uri,
        });
      });

      return { ...base, items, itemsLoaded: hiddenSection.itemsLoaded };
    }
  );
}

function replaceItemPattern(value: string, index: number): string {
  return value.replace('$ID+1$', `${index + 1}`).replace('$ID$', `${index}`);
}

function featureFlagSerializer(
  size: number,
  backward = false
): Serializer<boolean[]> {
  return {
    description: `featureFlags(${size})`,
    fixedSize: size,
    maxSize: size,
    serialize: (value) => {
      const bytes: number[] = [];

      for (let i = 0; i < size; i += 1) {
        let byte = 0;
        for (let j = 0; j < 8; j += 1) {
          const feature = Number(value[i * 8 + j] ?? 0);
          byte |= feature << (backward ? j : 7 - j);
        }
        if (backward) {
          bytes.unshift(byte);
        } else {
          bytes.push(byte);
        }
      }

      return new Uint8Array(bytes);
    },
    deserialize: (bytes, offset = 0) => {
      const booleans: boolean[] = [];
      let slice = bytes.slice(offset, offset + size);
      slice = backward ? slice.reverse() : slice;
      if (slice.length !== size) {
        throw new SdkError(
          `Serializer [featureFlag] expected ${size} bytes, got ${slice.length}.`
        );
      }

      for (let byte of slice) {
        for (let i = 0; i < 8; i += 1) {
          if (backward) {
            booleans.push(Boolean(byte & 1));
            byte >>= 1;
          } else {
            booleans.push(Boolean(byte & 0b1000_0000));
            byte <<= 1;
          }
        }
      }

      return [booleans, offset + size];
    },
  };
}
