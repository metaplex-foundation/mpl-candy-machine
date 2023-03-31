export * from './CandyGuard';
export * from './FreezeEscrow';

import { FreezeEscrow } from './FreezeEscrow';
import { CandyGuard } from './CandyGuard';

export const accountProviders = { FreezeEscrow, CandyGuard };
