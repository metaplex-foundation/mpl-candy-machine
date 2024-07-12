/**
 * This code was AUTOGENERATED using the kinobi library.
 * Please DO NOT EDIT THIS FILE, instead use visitors
 * to add features, then rerun kinobi to update it.
 *
 * @see https://github.com/metaplex-foundation/kinobi
 */

import { Option, OptionOrNullable } from '@metaplex-foundation/umi';
import {
  bool,
  bytes,
  option,
  Serializer,
  string,
  struct,
  u16,
  u64,
} from '@metaplex-foundation/umi/serializers';

export type GumballSettings = {
  /** Uri of off-chain metadata, max length 196 */
  uri: string;
  /** Number of assets that can be added. */
  itemCapacity: bigint;
  /** Max number of items that can be added by a single seller. */
  itemsPerSeller: number;
  /** Merkle root hash for sellers who can add items to the machine. */
  sellersMerkleRoot: Option<Uint8Array>;
  /** Fee basis points paid to the machine authority. */
  curatorFeeBps: number;
  /** True if the front end should hide items that have been sold. */
  hideSoldItems: boolean;
};

export type GumballSettingsArgs = {
  /** Uri of off-chain metadata, max length 196 */
  uri: string;
  /** Number of assets that can be added. */
  itemCapacity: number | bigint;
  /** Max number of items that can be added by a single seller. */
  itemsPerSeller: number;
  /** Merkle root hash for sellers who can add items to the machine. */
  sellersMerkleRoot: OptionOrNullable<Uint8Array>;
  /** Fee basis points paid to the machine authority. */
  curatorFeeBps: number;
  /** True if the front end should hide items that have been sold. */
  hideSoldItems: boolean;
};

export function getGumballSettingsSerializer(): Serializer<
  GumballSettingsArgs,
  GumballSettings
> {
  return struct<GumballSettings>(
    [
      ['uri', string()],
      ['itemCapacity', u64()],
      ['itemsPerSeller', u16()],
      ['sellersMerkleRoot', option(bytes({ size: 32 }))],
      ['curatorFeeBps', u16()],
      ['hideSoldItems', bool()],
    ],
    { description: 'GumballSettings' }
  ) as Serializer<GumballSettingsArgs, GumballSettings>;
}
