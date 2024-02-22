import { CANDY_MACHINE_SIZE, CONFIG_LINE_SIZE } from '../constants';

export function getCandyMachineSizeForItemCount(
  itemCount: number | bigint
): number {
  const items = Number(itemCount);

  return Math.ceil(
    CANDY_MACHINE_SIZE +
      // Number of currently items inserted.
      4 +
      // Config line data.
      items * CONFIG_LINE_SIZE +
      // Bit mask to keep track of which ConfigLines have been added.
      (4 + Math.floor(items / 8) + 1) +
      // Mint indices.
      (4 + items * 4)
  );
}
