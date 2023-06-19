import {
  isProgrammable,
  TokenStandard,
} from '@metaplex-foundation/mpl-token-metadata';
import {
  isNone,
  isOption,
  OptionOrNullable,
  wrapNullable,
} from '@metaplex-foundation/umi';
import { CANDY_MACHINE_HIDDEN_SECTION } from '../constants';
import { ConfigLineSettingsArgs } from '../generated/types/configLineSettings';

export function getCandyMachineSize(
  itemsAvailable: number | bigint,
  configLineSettings: OptionOrNullable<
    Pick<ConfigLineSettingsArgs, 'nameLength' | 'uriLength'>
  >,
  tokenStandard = TokenStandard.NonFungible
): number {
  configLineSettings = isOption(configLineSettings)
    ? configLineSettings
    : wrapNullable(configLineSettings);
  const base = isProgrammable(tokenStandard)
    ? CANDY_MACHINE_HIDDEN_SECTION + 33
    : CANDY_MACHINE_HIDDEN_SECTION;

  if (isNone(configLineSettings)) {
    return base;
  }

  const items = Number(itemsAvailable);
  const configLineSize =
    configLineSettings.value.nameLength + configLineSettings.value.uriLength;

  return Math.ceil(
    base +
      // Number of currently items inserted.
      4 +
      // Config line data.
      items * configLineSize +
      // Bit mask to keep track of which ConfigLines have been added.
      (4 + Math.floor(items / 8) + 1) +
      // Mint indices.
      (4 + items * 4)
  );
}
