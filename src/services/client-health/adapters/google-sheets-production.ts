import 'server-only';

import type { AdapterContext, SourceAdapterResult } from './types.ts';

/**
 * Intentionally empty until Dustin approves exact finance aliases, spreadsheet IDs, and ranges.
 * This private module exposes no contract registry, credentials, injected client, or transport.
 */
const APPROVED_PRODUCTION_GOOGLE_SHEETS_ADAPTER_KEYS = Object.freeze({});

/** Production callers may select only a reviewed private key; currently every key fails closed. */
export function createApprovedProductionGoogleSheetsAdapter(
  key: string,
): (context: AdapterContext) => Promise<SourceAdapterResult> {
  if (!Object.prototype.hasOwnProperty.call(APPROVED_PRODUCTION_GOOGLE_SHEETS_ADAPTER_KEYS, key)) {
    throw new Error(`Unsupported production Google Sheets adapter key: ${String(key)}`);
  }
  throw new Error('Production Google Sheets client implementation is not configured');
}
