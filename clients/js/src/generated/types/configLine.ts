/**
 * This code was AUTOGENERATED using the kinobi library.
 * Please DO NOT EDIT THIS FILE, instead use visitors
 * to add features, then rerun kinobi to update it.
 *
 * @see https://github.com/metaplex-foundation/kinobi
 */

import { PublicKey } from '@metaplex-foundation/umi';
import {
  Serializer,
  publicKey as publicKeySerializer,
  struct,
} from '@metaplex-foundation/umi/serializers';

/** Config line struct for storing asset (NFT) data pre-mint. */
export type ConfigLine = {
  /** Mint account of the asset. */
  mint: PublicKey;
  /** Wallet that submitted the asset for sale. */
  seller: PublicKey;
  /** Wallet that will receive the asset upon sale. Empty until drawn. */
  buyer: PublicKey;
};

export type ConfigLineArgs = ConfigLine;

export function getConfigLineSerializer(): Serializer<
  ConfigLineArgs,
  ConfigLine
> {
  return struct<ConfigLine>(
    [
      ['mint', publicKeySerializer()],
      ['seller', publicKeySerializer()],
      ['buyer', publicKeySerializer()],
    ],
    { description: 'ConfigLine' }
  ) as Serializer<ConfigLineArgs, ConfigLine>;
}
