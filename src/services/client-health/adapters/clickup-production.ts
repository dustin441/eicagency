import 'server-only';

import type { AdapterContext, ClickUpAdapterResult } from './types.ts';

/**
 * Complete production token allowlist. Deliberately empty until Dustin approves every
 * team/list-to-client mapping. This module therefore cannot route arbitrary IDs to a token.
 */
const APPROVED_PRODUCTION_CLICKUP_ADAPTERS: Readonly<Record<string, never>> = Object.freeze({});

/** Production callers may select only a reviewed private key; currently every key fails closed. */
export function createApprovedProductionClickUpAdapter(
  key: string,
): (context: AdapterContext) => Promise<ClickUpAdapterResult> {
  if (!Object.prototype.hasOwnProperty.call(APPROVED_PRODUCTION_CLICKUP_ADAPTERS, key)) {
    throw new Error(`Unsupported production ClickUp adapter key: ${String(key)}`);
  }
  // The private allowlist's value type is `never` while empty. When the first mapping is
  // approved, replace it with a private contract + credential-owning client factory.
  throw new Error('No production ClickUp adapters are approved');
}
