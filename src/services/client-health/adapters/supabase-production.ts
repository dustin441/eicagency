import 'server-only';

import { createEicSupabaseClient } from '../../../lib/spartaco-supabase-server.ts';
import { createServerSupabaseClient } from '../../../lib/supabase-server.ts';
import {
  createDeterministicSupabaseRelationAdapter,
  type ApprovedSupabaseRelationContract,
  type SupabaseLikeClient,
} from './supabase.ts';
import type { AdapterContext, SourceAdapterResult, SupabaseProject } from './types.ts';

/**
 * This is the complete production service-role allowlist. It is intentionally empty
 * until Dustin approves each client source, north-star scope, filters, and stable-key
 * contract. PrePass and EIC technical adapters can still be tested with injected
 * clients, but no arbitrary or inferred relation can reach a production credential.
 */
const APPROVED_PRODUCTION_ADAPTERS: Readonly<Record<string, ApprovedSupabaseRelationContract>> = Object.freeze({});

type ProductionAdapterOptions = {
  pageSize?: number;
  maxPages?: number;
};

function productionClient(project: SupabaseProject): SupabaseLikeClient {
  switch (project) {
    case 'prepass':
      return createServerSupabaseClient() as unknown as SupabaseLikeClient;
    case 'eic':
      return createEicSupabaseClient() as unknown as SupabaseLikeClient;
    default:
      throw new Error(`Unsupported production Supabase project: ${String(project)}`);
  }
}

/** Production callers can select only a reviewed static key, never SQL identifiers or filters. */
export function createApprovedProductionSupabaseAdapter(
  key: string,
  options: ProductionAdapterOptions = {},
): (context: AdapterContext) => Promise<SourceAdapterResult> {
  if (!Object.prototype.hasOwnProperty.call(APPROVED_PRODUCTION_ADAPTERS, key)) {
    throw new Error(`Unsupported production Supabase adapter key: ${String(key)}`);
  }
  const contract = APPROVED_PRODUCTION_ADAPTERS[key];
  return createDeterministicSupabaseRelationAdapter(contract, {
    ...options,
    client: productionClient(contract.project),
  });
}
