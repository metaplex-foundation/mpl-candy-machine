import { defaultPublicKey, PublicKey } from '@metaplex-foundation/umi';
import {
  array,
  bitArray,
  mapSerializer,
  publicKey,
  Serializer,
  struct,
  u32,
  u8,
} from '@metaplex-foundation/umi/serializers';
import { CANDY_MACHINE_HIDDEN_SECTION } from '../constants';
import { TokenStandard } from '../generated';
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
  readonly mint: string;

  /** The URI of the NFT to be, pointing to some off-chain JSON Metadata. */
  readonly seller: string;

  readonly buyer?: string;

  readonly tokenStandard: TokenStandard;
};

type CandyMachineHiddenSection = {
  itemsLoaded: number;
  rawConfigLines: {
    mint: PublicKey;
    seller: PublicKey;
    buyer: PublicKey;
    tokenStandard: TokenStandard;
  }[];
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

      const itemsAvailable = Number(base.settings.itemCapacity);
      const itemsMinted = Number(base.itemsRedeemed);
      const itemsRemaining = itemsAvailable - itemsMinted;

      const hiddenSectionSerializer: Serializer<CandyMachineHiddenSection> =
        struct<CandyMachineHiddenSection>([
          ['itemsLoaded', u32()],
          [
            'rawConfigLines',
            array(
              struct<{
                mint: PublicKey;
                seller: PublicKey;
                buyer: PublicKey;
                tokenStandard: TokenStandard;
              }>([
                ['mint', publicKey()],
                ['seller', publicKey()],
                ['buyer', publicKey()],
                ['tokenStandard', u8()],
              ]),
              { size: itemsAvailable }
            ),
          ],
          ['itemsLoadedMap', bitArray(Math.floor(itemsAvailable / 8) + 1)],
          ['itemsLeftToMint', array(u32(), { size: itemsAvailable })],
        ]);

      const [hiddenSection] = hiddenSectionSerializer.deserialize(slice);

      const itemsLeftToMint = hiddenSection.itemsLeftToMint.slice(
        0,
        itemsRemaining
      );
      const items: CandyMachineItem[] = [];
      hiddenSection.itemsLoadedMap.forEach((loaded, index) => {
        if (!loaded) return;
        const rawItem = hiddenSection.rawConfigLines[index];
        const item = {
          index,
          minted: !itemsLeftToMint.includes(index),
          mint: rawItem.mint,
          seller: rawItem.seller,
          buyer:
            rawItem.buyer === defaultPublicKey() ? undefined : rawItem.buyer,
          tokenStandard: rawItem.tokenStandard,
        };
        items.push(item);
      });

      return {
        ...base,
        items,
        itemsLoaded: hiddenSection.itemsLoaded,
      };
    }
  );
}
