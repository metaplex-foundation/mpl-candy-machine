/**
 * This code was AUTOGENERATED using the kinobi library.
 * Please DO NOT EDIT THIS FILE, instead use visitors
 * to add features, then rerun kinobi to update it.
 *
 * @see https://github.com/metaplex-foundation/kinobi
 */

import { PublicKey } from '@metaplex-foundation/umi';
import {
  publicKey as publicKeySerializer,
  Serializer,
  struct,
} from '@metaplex-foundation/umi/serializers';

/** Guard that restricts access to a specific address. */
export type AddressGate = { address: PublicKey };

export type AddressGateArgs = AddressGate;

export function getAddressGateSerializer(): Serializer<
  AddressGateArgs,
  AddressGate
> {
  return struct<AddressGate>([['address', publicKeySerializer()]], {
    description: 'AddressGate',
  }) as Serializer<AddressGateArgs, AddressGate>;
}
