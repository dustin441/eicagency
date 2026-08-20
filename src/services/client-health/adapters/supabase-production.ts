import 'server-only';

import { createEicSupabaseClient } from '../../../lib/spartaco-supabase-server.ts';
import { createServerSupabaseClient } from '../../../lib/supabase-server.ts';
import {
  createDeterministicSupabaseRelationAdapter,
  defineApprovedSupabaseRelationContract,
  type SupabaseLikeClient,
} from './supabase.ts';
import type { AdapterContext, SourceAdapterResult, SupabaseProject } from './types.ts';

const NsiCampaignDailyContract = defineApprovedSupabaseRelationContract({
  sourceKey: 'paid_media',
  clientKey: 'nsi',
  project: 'eic',
  relation: 'nsi_master_campaign_daily',
  dateColumn: 'date',
  uniqueOrderColumn: 'id',
  filters: [],
  mapping: { kind: 'ratio', spendColumn: 'cost', resultsColumn: 'conversions' },
});

/**
 * This is the complete production service-role allowlist. PrePass deliberately has
 * no relation adapter yet: its current high-volume materialized source has no stable
 * row key and must first expose an approved aggregate view/RPC.
 */
const APPROVED_PRODUCTION_ADAPTERS = Object.freeze({
  'eic:nsi-campaign-daily': NsiCampaignDailyContract,
});

type ApprovedProductionAdapterKey = keyof typeof APPROVED_PRODUCTION_ADAPTERS;

type ProductionAdapterOptions = {
  pageSize?: number;
  maxPages?: number;
};

function productionClient(project: SupabaseProject): SupabaseLikeClient {
  if (project === 'prepass') return createServerSupabaseClient() as unknown as SupabaseLikeClient;
  return createEicSupabaseClient() as unknown as SupabaseLikeClient;
}

/** Production callers can select only a reviewed static key, never SQL identifiers or filters. */
export function createApprovedProductionSupabaseAdapter(
  key: ApprovedProductionAdapterKey,
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
