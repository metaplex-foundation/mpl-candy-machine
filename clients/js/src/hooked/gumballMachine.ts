import { CONFIG_LINE_SIZE, GUMBALL_MACHINE_SIZE } from '../constants';

export function getGumballMachineSizeForItemCount(
  itemCount: number | bigint
): number {
  const items = Number(itemCount);

  return Math.ceil(
    GUMBALL_MACHINE_SIZE +
      // Number of currently items inserted.
      4 +
      // Config line data.
      items * CONFIG_LINE_SIZE +
      // Bit mask to keep track of which items have been claimed.
      (4 + Math.floor(items / 8) + 1) +
      // Bit mask to keep track of which items have been settled.
      (4 + Math.floor(items / 8) + 1) +
      // Mint indices.
      (4 + items * 4)
  );
}
