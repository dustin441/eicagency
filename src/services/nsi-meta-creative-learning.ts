// NSI — Meta creative test learning loop. Same `creative_tests` table Good Game
// uses (client_key='nsi', initiative_key='meta'), adapted for a leads business:
// no purchases/ROAS — the decision metric is leads / cost-per-lead, sourced
// from `nsi_meta_ads_creatives` (the table Good Game's version reads from
// `goodgame_meta_ads` the same way).

import { createSpartacoSupabaseClient } from '@/lib/spartaco-supabase-server';
import { dateOnly, resolveCreativeTestEvaluationEnd } from '@/lib/goodgame-creative-evaluation';

export type CreativeTestStatus =
  | 'recommended'
  | 'approved'
  | 'in_production'
  | 'launched'
  | 'evaluating'
  | 'concluded'
  | 'declined'
  | 'cancelled';

export type CreativeTestVerdict = 'expand' | 'iterate' | 'retire' | 'inconclusive';

export type CreativeTestPreview = {
  role: string;
  name: string;
  url?: string;
  imageUrl?: string;
};

export type NsiMetaTestMetrics = {
  spend: number;
  impressions: number;
  clicks: number;
  leads: number;
  ctr: number;
  costPerLead: number | null;
  daysLive: number;
};

export type NsiMetaCreativeTest = {
  id: number;
  testKey: string;
  title: string;
  hypothesis: string;
  primaryVariable: string;
  creativeFormat: string;
  controlDescription: string;
  northStarMetric: string;
  priorityScore: number | null;
  priorityReason: string;
  status: CreativeTestStatus;
  ownerName: string;
  sourcePeriodStart: string;
  sourcePeriodEnd: string;
  launchedAt: string;
  linkedAdIds: string[];
  controlAdIds: string[];
  previews: CreativeTestPreview[];
  currentMetrics: NsiMetaTestMetrics | null;
  controlMetrics: NsiMetaTestMetrics | null;
  evidenceStatus: 'not_started' | 'early' | 'directional' | 'sufficient';
  evidenceLabel: string;
  verdict: CreativeTestVerdict | null;
  learning: string;
};

type CreativeTestRow = {
  id: number;
  test_key: string;
  title: string;
  hypothesis: string | null;
  primary_variable: string | null;
  creative_format: string | null;
  control_description: string | null;
  north_star_metric: string;
  evidence_threshold: Record<string, unknown> | null;
  priority_score: number | string | null;
  priority_reason: string | null;
  status: CreativeTestStatus;
  owner_name: string | null;
  source_period_start: string | null;
  source_period_end: string | null;
  launched_at: string | null;
  concluded_at: string | null;
  linked_ad_ids: string[] | null;
  control_ad_ids: string[] | null;
  preview_urls: Array<{ role?: string; name?: string; url?: string; image_url?: string }> | null;
  verdict: CreativeTestVerdict | null;
  learning: string | null;
};

type AdMetricRow = {
  id: string | number;
  ad_id: string | number | null;
  date: string | null;
  cost: number | string | null;
  impressions: number | string | null;
  clicks: number | string | null;
  leads: number | string | null;
};

function number(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function daysBetween(start: string, end: string) {
  const startMs = Date.parse(`${start}T00:00:00Z`);
  const endMs = Date.parse(`${end}T00:00:00Z`);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) return 0;
  return Math.floor((endMs - startMs) / 86_400_000) + 1;
}

function aggregateMetrics(rows: AdMetricRow[], startDate: string, endDate: string): NsiMetaTestMetrics | null {
  const filtered = rows.filter((row) => {
    const date = dateOnly(row.date);
    return date && (!startDate || date >= startDate) && (!endDate || date <= endDate);
  });
  if (!filtered.length) return null;

  const spend = filtered.reduce((sum, row) => sum + number(row.cost), 0);
  const impressions = filtered.reduce((sum, row) => sum + number(row.impressions), 0);
  const clicks = filtered.reduce((sum, row) => sum + number(row.clicks), 0);
  const leads = filtered.reduce((sum, row) => sum + number(row.leads), 0);
  const dates = filtered.map((row) => dateOnly(row.date)).filter(Boolean).sort();
  const firstDate = dates[0] ?? startDate;
  const lastDate = dates.at(-1) ?? endDate;

  return {
    spend,
    impressions,
    clicks,
    leads,
    ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
    costPerLead: leads > 0 ? spend / leads : null,
    daysLive: firstDate && lastDate ? daysBetween(firstDate, lastDate) : 0,
  };
}

function evidenceFor(
  row: CreativeTestRow,
  metrics: NsiMetaTestMetrics | null,
  accountCostPerLead: number | null
): Pick<NsiMetaCreativeTest, 'evidenceStatus' | 'evidenceLabel'> {
  if (!['launched', 'evaluating', 'concluded'].includes(row.status) || !metrics) {
    return { evidenceStatus: 'not_started', evidenceLabel: 'Not launched' };
  }

  const threshold = row.evidence_threshold ?? {};
  const minDays = number(threshold.min_days_live) || 14;
  const minLeads = number(threshold.min_leads_for_conversion_verdict) || 5;
  const noConversionSpendMultiple = number(threshold.min_no_conversion_spend_multiple) || 2;
  const enoughDays = metrics.daysLive >= minDays;
  const enoughLeads = metrics.leads >= minLeads;
  const enoughNoConversionSpend = metrics.leads === 0
    && accountCostPerLead !== null
    && metrics.spend >= accountCostPerLead * noConversionSpendMultiple;

  if (enoughDays && (enoughLeads || enoughNoConversionSpend)) {
    return { evidenceStatus: 'sufficient', evidenceLabel: 'Enough evidence for a decision' };
  }
  if (enoughDays || metrics.leads > 0) {
    return {
      evidenceStatus: 'directional',
      evidenceLabel: `${metrics.daysLive}/${minDays} days · ${metrics.leads}/${minLeads} leads`,
    };
  }
  return {
    evidenceStatus: 'early',
    evidenceLabel: `${metrics.daysLive}/${minDays} days · ${metrics.leads}/${minLeads} leads`,
  };
}

export async function fetchNsiMetaCreativeTests(
  accountCostPerLead: number | null
): Promise<NsiMetaCreativeTest[]> {
  const db = createSpartacoSupabaseClient();
  const { data, error } = await db
    .from('creative_tests')
    .select('*')
    .eq('client_key', 'nsi')
    .eq('initiative_key', 'meta')
    .order('priority_score', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: true });

  if (error || !data) return [];
  const rows = data as unknown as CreativeTestRow[];
  const allAdIds = Array.from(new Set(rows.flatMap((row) => [
    ...(row.linked_ad_ids ?? []),
    ...(row.control_ad_ids ?? []),
  ])));

  const adRows: AdMetricRow[] = [];
  if (allAdIds.length) {
    const earliestDate = rows
      .map((row) => dateOnly(row.launched_at) || row.source_period_start || '')
      .filter(Boolean)
      .sort()[0];
    const pageSize = 1000;
    for (let from = 0; ; from += pageSize) {
      let query = db
        .from('nsi_meta_ads_creatives')
        .select('id,ad_id,date,cost,impressions,clicks,leads')
        .in('ad_id', allAdIds)
        .order('date', { ascending: true })
        .order('id', { ascending: true })
        .range(from, from + pageSize - 1);
      if (earliestDate) query = query.gte('date', earliestDate);
      const response = await query;
      if (response.error) throw new Error(response.error.message);
      const page = (response.data ?? []) as unknown as AdMetricRow[];
      adRows.push(...page);
      if (page.length < pageSize) break;
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  return rows.map((row) => {
    const linkedIds = new Set((row.linked_ad_ids ?? []).map(String));
    const controlIds = new Set((row.control_ad_ids ?? []).map(String));
    const linkedRows = adRows.filter((ad) => linkedIds.has(String(ad.ad_id ?? '')));
    const controlRows = adRows.filter((ad) => controlIds.has(String(ad.ad_id ?? '')));
    const evaluationStart = dateOnly(row.launched_at) || row.source_period_start || '';
    const evaluationEnd = resolveCreativeTestEvaluationEnd(
      row.status,
      row.concluded_at,
      row.source_period_end,
      today
    );
    const missingConclusionDate = row.status === 'concluded' && evaluationEnd === null;
    const controlStart = dateOnly(row.launched_at) || row.source_period_start || '';
    const controlEnd = dateOnly(row.launched_at) ? evaluationEnd : row.source_period_end || evaluationEnd;
    const currentMetrics = missingConclusionDate
      ? null
      : aggregateMetrics(linkedRows, evaluationStart, evaluationEnd ?? '');
    const controlMetrics = missingConclusionDate
      ? null
      : aggregateMetrics(controlRows, controlStart, controlEnd ?? '');
    const evidence = missingConclusionDate
      ? { evidenceStatus: 'not_started' as const, evidenceLabel: 'Conclusion date unavailable' }
      : evidenceFor(row, currentMetrics, accountCostPerLead);

    return {
      id: row.id,
      testKey: row.test_key,
      title: row.title,
      hypothesis: row.hypothesis ?? '',
      primaryVariable: row.primary_variable ?? '',
      creativeFormat: row.creative_format ?? '',
      controlDescription: row.control_description ?? '',
      northStarMetric: row.north_star_metric,
      priorityScore: row.priority_score === null ? null : number(row.priority_score),
      priorityReason: row.priority_reason ?? '',
      status: row.status,
      ownerName: row.owner_name ?? '',
      sourcePeriodStart: row.source_period_start ?? '',
      sourcePeriodEnd: row.source_period_end ?? '',
      launchedAt: row.launched_at ?? '',
      linkedAdIds: row.linked_ad_ids ?? [],
      controlAdIds: row.control_ad_ids ?? [],
      previews: (row.preview_urls ?? []).map((preview) => ({
        role: preview.role ?? 'reference',
        name: preview.name ?? 'Creative reference',
        url: preview.url,
        imageUrl: preview.image_url,
      })),
      currentMetrics,
      controlMetrics,
      ...evidence,
      verdict: row.verdict,
      learning: row.learning ?? '',
    };
  });
}
