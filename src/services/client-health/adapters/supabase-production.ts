import 'server-only';

import { createEicSupabaseClient } from '../../../lib/spartaco-supabase-server.ts';
import { createServerSupabaseClient } from '../../../lib/supabase-server.ts';
import {
  createDeterministicSupabaseRelationAdapter,
  defineApprovedSupabaseRelationContract,
  type ApprovedSupabaseRelationContract,
  type SupabaseLikeClient,
} from './supabase.ts';
import type { AdapterContext, SourceAdapterResult, SupabaseProject } from './types.ts';

const ratio = (
  clientKey: string,
  relation: string,
  uniqueOrderColumn: string,
  spendColumn: string,
  resultsColumn: string,
): ApprovedSupabaseRelationContract => defineApprovedSupabaseRelationContract({
  sourceKey: 'performance', clientKey, project: 'eic', relation, dateColumn: 'date', uniqueOrderColumn,
  filters: [], mapping: { kind: 'ratio', spendColumn, resultsColumn },
});

/** Complete reviewed production service-role allowlist. No request input selects SQL identifiers. */
const APPROVED_PRODUCTION_ADAPTERS: Readonly<Record<string, ApprovedSupabaseRelationContract>> = Object.freeze({
  'bloom.performance': ratio('bloom', 'bloom_meta_ads', 'id', 'cost', 'website_chats'),
  'bridgeway.performance': ratio('bridgeway', 'client_health_bridgeway_daily', 'row_key', 'spend', 'results'),
  'cba.performance': ratio('cba', 'client_health_cba_daily', 'row_key', 'spend', 'results'),
  'ihh.performance': ratio('ihh', 'client_health_ihh_daily', 'row_key', 'spend', 'results'),
  'state48.performance': ratio('state48', 'state48_google', 'id', 'cost', 'revenue'),
});

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
