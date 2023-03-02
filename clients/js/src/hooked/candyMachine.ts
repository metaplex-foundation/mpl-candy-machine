import { isNone, Option } from '@metaplex-foundation/umi';
import { CANDY_MACHINE_HIDDEN_SECTION } from '../constants';
import { ConfigLineSettingsArgs } from '../generated/types/configLineSettings';

export function getCandyMachineSize(
  itemsAvailable: number | bigint,
  configLineSettings: Option<
    Pick<ConfigLineSettingsArgs, 'nameLength' | 'uriLength'>
  >
): number {
  if (isNone(configLineSettings)) {
    return CANDY_MACHINE_HIDDEN_SECTION;
  }

  const items = Number(itemsAvailable);
  const configLineSize =
    configLineSettings.value.nameLength + configLineSettings.value.uriLength;

  return Math.ceil(
    CANDY_MACHINE_HIDDEN_SECTION +
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
