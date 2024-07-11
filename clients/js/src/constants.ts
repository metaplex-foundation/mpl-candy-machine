export const CANDY_MACHINE_HIDDEN_SECTION =
  8 + // discriminator
  1 + // version
  32 + // authority
  32 + // mint authority
  8 + // items redeemed
  1 + // state
  200 + // uri
  8 + // item capacity
  2 + // items per seller
  33 + // add items merkle root
  2 + // curator fee bps
  1; // hide sold items

export const CANDY_MACHINE_SIZE = CANDY_MACHINE_HIDDEN_SECTION;

export const CONFIG_LINE_SIZE =
  32 + // mint
  32 + // seller
  32 + // buyer
  1; // token standard

export const CANDY_GUARD_LABEL_SIZE = 6;
export const CANDY_GUARD_DATA =
  8 + // discriminator
  32 + // base
  1 + // bump
  32; // authority

export const METADATA_SIZE: number = 679;

export const MASTER_EDITION_SIZE: number = 282;
