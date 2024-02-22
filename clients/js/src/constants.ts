export const CANDY_MACHINE_SIZE =
  8 + // discriminator
  1 + // version
  6 + // features
  32 + // authority
  32 + // mint authority
  8 + // items redeemed
  8; // items available

export const CONFIG_LINE_SIZE =
  32 + // mint
  32 + // seller
  32; // buyer

export const CANDY_GUARD_LABEL_SIZE = 6;
export const CANDY_GUARD_DATA =
  8 + // discriminator
  32 + // base
  1 + // bump
  32; // authority

export const METADATA_SIZE: number = 679;

export const MASTER_EDITION_SIZE: number = 282;
