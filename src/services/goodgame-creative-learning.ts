import { createSpartacoSupabaseClient } from '@/lib/spartaco-supabase-server';

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

export type CreativeTestMetrics = {
  spend: number;
  impressions: number;
  clicks: number;
  purchases: number;
  revenue: number;
  ctr: number;
  roas: number;
  costPerPurchase: number | null;
  daysLive: number;
};

export type GoodGameCreativeTest = {
  id: number;
  testKey: string;
  title: string;
  hypothesis: string;
  primaryVariable: string;
  creativeFormat: string;
  controlDescription: string;
  northStarMetric: string;
  impactScore: number | null;
  speedScore: number | null;
  confidenceScore: number | null;
  effortScore: number | null;
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
  currentMetrics: CreativeTestMetrics | null;
  controlMetrics: CreativeTestMetrics | null;
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
  impact_score: number | null;
  speed_score: number | null;
  confidence_score: number | null;
  effort_score: number | null;
  priority_score: number | string | null;
  priority_reason: string | null;
  status: CreativeTestStatus;
  owner_name: string | null;
  source_period_start: string | null;
  source_period_end: string | null;
  launched_at: string | null;
  linked_ad_ids: string[] | null;
  control_ad_ids: string[] | null;
  preview_urls: Array<{ role?: string; name?: string; url?: string; image_url?: string }> | null;
  verdict: CreativeTestVerdict | null;
  learning: string | null;
};

type AdMetricRow = {
  ad_id: string | number | null;
  date: string | null;
  cost: number | string | null;
  impressions: number | string | null;
  clicks: number | string | null;
  purchases: number | string | null;
  revenue: number | string | null;
};

function number(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function dateOnly(value: string | null | undefined) {
  return value?.slice(0, 10) ?? '';
}

function daysBetween(start: string, end: string) {
  const startMs = Date.parse(`${start}T00:00:00Z`);
  const endMs = Date.parse(`${end}T00:00:00Z`);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) return 0;
  return Math.floor((endMs - startMs) / 86_400_000) + 1;
}

function aggregateMetrics(rows: AdMetricRow[], startDate: string, endDate: string): CreativeTestMetrics | null {
  const filtered = rows.filter((row) => {
    const date = dateOnly(row.date);
    return date && (!startDate || date >= startDate) && (!endDate || date <= endDate);
  });
  if (!filtered.length) return null;

  const spend = filtered.reduce((sum, row) => sum + number(row.cost), 0);
  const impressions = filtered.reduce((sum, row) => sum + number(row.impressions), 0);
  const clicks = filtered.reduce((sum, row) => sum + number(row.clicks), 0);
  const purchases = filtered.reduce((sum, row) => sum + number(row.purchases), 0);
  const revenue = filtered.reduce((sum, row) => sum + number(row.revenue), 0);
  const dates = filtered.map((row) => dateOnly(row.date)).filter(Boolean).sort();
  const firstDate = dates[0] ?? startDate;
  const lastDate = dates.at(-1) ?? endDate;

  return {
    spend,
    impressions,
    clicks,
    purchases,
    revenue,
    ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
    roas: spend > 0 ? revenue / spend : 0,
    costPerPurchase: purchases > 0 ? spend / purchases : null,
    daysLive: firstDate && lastDate ? daysBetween(firstDate, lastDate) : 0,
  };
}

function evidenceFor(
  row: CreativeTestRow,
  metrics: CreativeTestMetrics | null,
  accountCostPerPurchase: number | null
): Pick<GoodGameCreativeTest, 'evidenceStatus' | 'evidenceLabel'> {
  if (!['launched', 'evaluating', 'concluded'].includes(row.status) || !metrics) {
    return { evidenceStatus: 'not_started', evidenceLabel: 'Not launched' };
  }

  const threshold = row.evidence_threshold ?? {};
  const minDays = number(threshold.min_days_live) || 7;
  const minPurchases = number(threshold.min_purchases_for_conversion_verdict) || 3;
  const noConversionSpendMultiple = number(threshold.min_no_conversion_spend_multiple) || 2;
  const enoughDays = metrics.daysLive >= minDays;
  const enoughPurchases = metrics.purchases >= minPurchases;
  const enoughNoConversionSpend = metrics.purchases === 0
    && accountCostPerPurchase !== null
    && metrics.spend >= accountCostPerPurchase * noConversionSpendMultiple;

  if (enoughDays && (enoughPurchases || enoughNoConversionSpend)) {
    return { evidenceStatus: 'sufficient', evidenceLabel: 'Enough evidence for a decision' };
  }
  if (enoughDays || metrics.purchases > 0) {
    return {
      evidenceStatus: 'directional',
      evidenceLabel: `${metrics.daysLive}/${minDays} days · ${metrics.purchases}/${minPurchases} purchases`,
    };
  }
  return {
    evidenceStatus: 'early',
    evidenceLabel: `${metrics.daysLive}/${minDays} days · ${metrics.purchases}/${minPurchases} purchases`,
  };
}

export async function fetchGoodGameCreativeTests(
  accountCostPerPurchase: number | null
): Promise<GoodGameCreativeTest[]> {
  const db = createSpartacoSupabaseClient();
  const { data, error } = await db
    .from('creative_tests')
    .select('*')
    .eq('client_key', 'goodgame')
    .eq('initiative_key', 'ecommerce')
    .order('priority_score', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: true });

  if (error || !data) return [];
  const rows = data as unknown as CreativeTestRow[];
  const allAdIds = Array.from(new Set(rows.flatMap((row) => [
    ...(row.linked_ad_ids ?? []),
    ...(row.control_ad_ids ?? []),
  ])));

  let adRows: AdMetricRow[] = [];
  if (allAdIds.length) {
    const earliestDate = rows
      .map((row) => dateOnly(row.launched_at) || row.source_period_start || '')
      .filter(Boolean)
      .sort()[0];
    let query = db
      .from('goodgame_meta_ads')
      .select('ad_id,date,cost,impressions,clicks,purchases,revenue')
      .in('ad_id', allAdIds)
      .limit(20_000);
    if (earliestDate) query = query.gte('date', earliestDate);
    const response = await query;
    if (!response.error && response.data) adRows = response.data as unknown as AdMetricRow[];
  }

  const today = new Date().toISOString().slice(0, 10);
  return rows.map((row) => {
    const linkedIds = new Set((row.linked_ad_ids ?? []).map(String));
    const controlIds = new Set((row.control_ad_ids ?? []).map(String));
    const linkedRows = adRows.filter((ad) => linkedIds.has(String(ad.ad_id ?? '')));
    const controlRows = adRows.filter((ad) => controlIds.has(String(ad.ad_id ?? '')));
    const evaluationStart = dateOnly(row.launched_at) || row.source_period_start || '';
    const evaluationEnd = row.status === 'concluded' ? today : today;
    const controlStart = dateOnly(row.launched_at) || row.source_period_start || '';
    const controlEnd = dateOnly(row.launched_at) ? evaluationEnd : row.source_period_end || evaluationEnd;
    const currentMetrics = aggregateMetrics(linkedRows, evaluationStart, evaluationEnd);
    const controlMetrics = aggregateMetrics(controlRows, controlStart, controlEnd);
    const evidence = evidenceFor(row, currentMetrics, accountCostPerPurchase);

    return {
      id: row.id,
      testKey: row.test_key,
      title: row.title,
      hypothesis: row.hypothesis ?? '',
      primaryVariable: row.primary_variable ?? '',
      creativeFormat: row.creative_format ?? '',
      controlDescription: row.control_description ?? '',
      northStarMetric: row.north_star_metric,
      impactScore: row.impact_score,
      speedScore: row.speed_score,
      confidenceScore: row.confidence_score,
      effortScore: row.effort_score,
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

export async function refreshGoodGameCreativeTestEvaluations(
  accountCostPerPurchase: number | null
) {
  const db = createSpartacoSupabaseClient();
  const tests = await fetchGoodGameCreativeTests(accountCostPerPurchase);
  const activeTests = tests.filter((test) => ['launched', 'evaluating'].includes(test.status));
  const calculatedAt = new Date().toISOString();
  let updated = 0;

  for (const test of activeTests) {
    const currentEvaluation = {
      calculated_at: calculatedAt,
      north_star_metric: test.northStarMetric,
      evidence_status: test.evidenceStatus,
      evidence_label: test.evidenceLabel,
      linked_ad_ids: test.linkedAdIds,
      metrics: test.currentMetrics,
      control_metrics: test.controlMetrics,
    };
    const updates: Record<string, unknown> = { current_evaluation: currentEvaluation };
    if (test.status === 'launched' && test.currentMetrics) updates.status = 'evaluating';

    const { error } = await db
      .from('creative_tests')
      .update(updates)
      .eq('id', test.id)
      .eq('client_key', 'goodgame')
      .eq('initiative_key', 'ecommerce');
    if (error) throw error;
    updated += 1;
  }

  return {
    clientKey: 'goodgame',
    initiativeKey: 'ecommerce',
    activeTests: activeTests.length,
    updated,
    calculatedAt,
  };
}
