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
import { GUMBALL_MACHINE_HIDDEN_SECTION } from '../constants';
import { TokenStandard } from '../generated';
import {
  getGumballMachineAccountDataSerializer as baseGetGumballMachineAccountDataSerializer,
  GumballMachineAccountData as BaseGumballMachineAccountData,
  GumballMachineAccountDataArgs as BaseGumballMachineAccountDataArgs,
} from '../generated/types/gumballMachineAccountData';

export type GumballMachineAccountData = BaseGumballMachineAccountData & {
  itemsLoaded: number;
  items: GumballMachineItem[];
};

export type GumballMachineAccountDataArgs = BaseGumballMachineAccountDataArgs;

/**
 * Represent an item inside a Gumball Machine that has been or
 * will eventually be minted into an NFT.
 *
 * It only contains the name and the URI of the NFT to be as
 * the rest of the data is shared by all NFTs and lives
 * in the Gumball Machine configurations (e.g. `symbol`, `creators`, etc).
 */
export type GumballMachineItem = {
  /** The index of the config line. */
  readonly index: number;

  /** Whether the item has been drawn or not. */
  readonly isDrawn: boolean;

  /** Whether the item has been claimed or not. */
  readonly isClaimed: boolean;

  /** Whether the item has been settled or not. */
  readonly isSettled: boolean;

  /** The name of the NFT to be. */
  readonly mint: string;

  /** The URI of the NFT to be, pointing to some off-chain JSON Metadata. */
  readonly seller: string;

  readonly buyer?: string;

  readonly tokenStandard: TokenStandard;
};

type GumballMachineHiddenSection = {
  itemsLoaded: number;
  rawConfigLines: {
    mint: PublicKey;
    seller: PublicKey;
    buyer: PublicKey;
    tokenStandard: TokenStandard;
  }[];
  itemsClaimedMap: boolean[];
  itemsSettledMap: boolean[];
  itemsLeftToMint: number[];
};

export function getGumballMachineAccountDataSerializer(): Serializer<
  GumballMachineAccountDataArgs,
  GumballMachineAccountData
> {
  return mapSerializer<
    GumballMachineAccountDataArgs,
    BaseGumballMachineAccountDataArgs,
    GumballMachineAccountData,
    BaseGumballMachineAccountData
  >(
    baseGetGumballMachineAccountDataSerializer(),
    (args) => args,
    (base, bytes, offset) => {
      const slice = bytes.slice(offset + GUMBALL_MACHINE_HIDDEN_SECTION);
      const itemCapacity = Number(base.settings.itemCapacity);

      const hiddenSectionSerializer: Serializer<GumballMachineHiddenSection> =
        struct<GumballMachineHiddenSection>([
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
              { size: itemCapacity }
            ),
          ],
          ['itemsClaimedMap', bitArray(Math.floor(itemCapacity / 8) + 1)],
          ['itemsSettledMap', bitArray(Math.floor(itemCapacity / 8) + 1)],
          ['itemsLeftToMint', array(u32(), { size: itemCapacity })],
        ]);

      const [hiddenSection] = hiddenSectionSerializer.deserialize(slice);

      const itemsMinted = Number(base.itemsRedeemed);
      const itemsRemaining = hiddenSection.itemsLoaded - itemsMinted;

      const itemsLeftToMint = hiddenSection.itemsLeftToMint.slice(
        0,
        itemsRemaining
      );

      const items: GumballMachineItem[] = [];
      hiddenSection.itemsClaimedMap.forEach((isClaimed, index) => {
        if (index >= hiddenSection.itemsLoaded) {
          return;
        }

        const rawItem = hiddenSection.rawConfigLines[index];
        const item = {
          index,
          isDrawn: !itemsLeftToMint.includes(index),
          isClaimed,
          isSettled: hiddenSection.itemsSettledMap[index],
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
