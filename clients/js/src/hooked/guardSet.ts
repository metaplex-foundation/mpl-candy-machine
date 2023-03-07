import {
  bitArray,
  Context,
  isSome,
  mergeBytes,
  none,
  Serializer,
} from '@metaplex-foundation/umi';
import { GuardManifest, GuardSetData, GuardSetDataArgs } from '../guards/core';

export type GuardSet = GuardSetData;

export type GuardSetArgs = GuardSetDataArgs;

export function getGuardSetSerializer<
  DA extends GuardSetDataArgs,
  D extends DA & GuardSetData = DA
>(context: Pick<Context, 'serializer'>): Serializer<Partial<DA>, D> {
  const manifests = [] as GuardManifest<any, any, any, any>[];
  return {
    description: 'guardSet',
    fixedSize: null,
    maxSize: null,
    serialize: (set: Partial<DA>): Uint8Array => {
      const features = [] as boolean[];
      const bytes = [] as Uint8Array[];
      manifests.forEach((manifest) => {
        const value = set[manifest.name] ?? none();
        features.push(isSome(value));
        bytes.push(
          isSome(value)
            ? manifest.serializer(context).serialize(value.value)
            : new Uint8Array()
        );
      });
      return mergeBytes([bitArray(8).serialize(features), ...bytes]);
    },
    deserialize: (bytes: Uint8Array, offset = 0): [D, number] => {
      const [features, featuresOffset] = bitArray(8).deserialize(bytes, offset);
      offset = featuresOffset;
      const guardSet = manifests.reduce((acc, manifest, index) => {
        acc[manifest.name] = none();
        if (!(features[index] ?? false)) return acc;
        const serializer = manifest.serializer(context);
        const [value, newOffset] = serializer.deserialize(bytes, offset);
        offset = newOffset;
        acc[manifest.name] = value;
        return acc;
      }, {} as GuardSetData);
      return [guardSet as D, offset];
    },
  };
}
