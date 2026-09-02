import 'server-only';

import type { AdapterContext, ClickUpAdapterResult } from './types.ts';

/**
 * Sole production authorization boundary: private approved client/team/list mappings and
 * credential-owning ClickUp transports may exist only in this module. The generic adapter's
 * injected contract is test/integration plumbing and grants no production authorization.
 * This allowlist remains deliberately empty until Dustin approves every mapping.
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
