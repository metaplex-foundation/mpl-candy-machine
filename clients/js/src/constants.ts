import { publicKey } from '@metaplex-foundation/umi';

export const FEE_CONFIG_SIZE =
  32 + // fee account
  2; // fee bps

export const GUMBALL_MACHINE_HIDDEN_SECTION =
  8 + // discriminator
  1 + // version
  32 + // authority
  32 + // mint authority
  FEE_CONFIG_SIZE +
  1 + // marketplace fee config (optional)
  8 + // items redeemed
  8 + // finalized items count
  8 + // items settled
  8 + // total revenue
  1 + // state
  200 + // uri
  8 + // item capacity
  2 + // items per seller
  33 + // add items merkle root
  2 + // curator fee bps
  1 + // hide sold items
  32; // payment token

export const GUMBALL_MACHINE_SIZE = GUMBALL_MACHINE_HIDDEN_SECTION;

export const CONFIG_LINE_SIZE =
  32 + // mint
  32 + // seller
  32 + // buyer
  1; // token standard

export const GUMBALL_GUARD_LABEL_SIZE = 6;
export const GUMBALL_GUARD_DATA =
  8 + // discriminator
  32 + // base
  1 + // bump
  32; // authority

export const METADATA_SIZE: number = 679;

export const MASTER_EDITION_SIZE: number = 282;

export const NATIVE_MINT = publicKey(
  'So11111111111111111111111111111111111111112'
);
