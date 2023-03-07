import {
  bitArray,
  Context,
  isSome,
  mergeBytes,
  none,
  Option,
  reverseSerializer,
  Serializer,
  some,
} from '@metaplex-foundation/umi';
import { CandyGuardProgram, GuardRepository } from './guardRepository';

export type GuardSetArgs = {
  [name: string]: Option<object>;
};

export type GuardSet = {
  [name: string]: Option<object>;
};

export type GuardSetMintArgs = {
  [name: string]: Option<object>;
};

export type GuardSetRouteArgs = {
  [name: string]: object;
};

export function getGuardSetSerializer<
  DA extends GuardSetArgs,
  D extends DA & GuardSet = DA
>(
  context: Pick<Context, 'serializer'> & { guards: GuardRepository },
  program: CandyGuardProgram
): Serializer<Partial<DA>, D> {
  const manifests = context.guards.forProgram(program);
  const featuresSerializer = reverseSerializer(bitArray(8, true));
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
      return mergeBytes([featuresSerializer.serialize(features), ...bytes]);
    },
    deserialize: (bytes: Uint8Array, offset = 0): [D, number] => {
      const [features, featuresOffset] = featuresSerializer.deserialize(
        bytes,
        offset
      );
      offset = featuresOffset;
      const guardSet = manifests.reduce((acc, manifest, index) => {
        acc[manifest.name] = none();
        if (!(features[index] ?? false)) return acc;
        const serializer = manifest.serializer(context);
        const [value, newOffset] = serializer.deserialize(bytes, offset);
        offset = newOffset;
        acc[manifest.name] = some(value);
        return acc;
      }, {} as GuardSet);
      return [guardSet as D, offset];
    },
  };
}
