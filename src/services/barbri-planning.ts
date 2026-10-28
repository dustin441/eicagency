import 'server-only';

import { createServerSupabaseClient } from '@/lib/supabase-server';

type Numeric = number | string;

export type BarbriSnapshot = {
  version: string;
  status: 'working' | 'approved' | 'archived';
  sourceCutoff: string;
  forecastStart: string;
  forecastEnd: string;
  currentModeledRoas: number;
  targetRoas: number;
  forecastSpend: number;
  forecastRevenue: number;
  forecastSales: number;
  improvementPct: number;
  strategySummary: string;
};

export type BarbriPerformanceWindow = {
  key: string;
  label: string;
  startDate: string;
  endDate: string;
  spend: number;
  nativeRevenue: number;
  nativeRoas: number;
  ga4Revenue: number;
  ga4Roas: number;
  purchases: number;
  aov: number;
};

export type BarbriMeasurementPoint = {
  key: string;
  label: string;
  value: number;
  unit: string;
  evidenceType: string;
  definition: string;
};

export type BarbriChannelPlan = {
  key: string;
  label: string;
  currentRoas: number | null;
  forecastRoas: number;
  spend: number;
  revenue: number;
  sales: number;
  evidenceType: string;
  roleInPlan: string;
};

export type BarbriMonthPlan = {
  key: string;
  label: string;
  dateRange: string;
  spend: number;
  revenue: number;
  sales: number;
  roas: number;
};

export type BarbriMediaPlanLine = {
  key: string;
  allocationKey: string;
  allocationLabel: string;
  label: string;
  month1Spend: number;
  month2Spend: number;
  month3Spend: number;
  totalSpend: number;
  cpm: number;
  ctr: number;
  cpc: number;
  conversionRate: number;
  forecastSales: number;
  forecastRevenue: number;
  forecastRoas: number;
  evidenceType: string;
  operatingIntent: string;
};

export type BarbriRoadmapPhase = {
  key: string;
  timing: string;
  theme: string;
  actions: string;
  decisionGate: string;
  primaryKpi: string;
  ownerBoundary: string;
};

export type BarbriPlanningDashboardData = {
  snapshot: BarbriSnapshot;
  windows: BarbriPerformanceWindow[];
  measurement: BarbriMeasurementPoint[];
  channels: BarbriChannelPlan[];
  months: BarbriMonthPlan[];
  mediaPlan: BarbriMediaPlanLine[];
  roadmap: BarbriRoadmapPhase[];
};

function n(value: Numeric | null): number {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed)) throw new Error('BARBRI dashboard received a non-finite numeric value');
  return parsed;
}

export async function fetchBarbriPlanningDashboard(): Promise<BarbriPlanningDashboardData> {
  const db = createServerSupabaseClient();
  const { data: snapshotRow, error: snapshotError } = await db
    .from('barbri_plan_snapshots')
    .select('*')
    .neq('status', 'archived')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (snapshotError || !snapshotRow) {
    throw new Error(`Unable to load BARBRI planning snapshot: ${snapshotError?.message ?? 'not found'}`);
  }

  const version = String(snapshotRow.version);
  const [windowsResult, measurementResult, channelsResult, monthsResult, mediaPlanResult, roadmapResult] = await Promise.all([
    db.from('barbri_performance_windows').select('*').eq('snapshot_version', version).order('sort_order'),
    db.from('barbri_measurement_bridge').select('*').eq('snapshot_version', version).order('sort_order'),
    db.from('barbri_channel_plan').select('*').eq('snapshot_version', version).order('sort_order'),
    db.from('barbri_monthly_plan').select('*').eq('snapshot_version', version).order('sort_order'),
    db.from('barbri_media_plan_lines').select('*').eq('snapshot_version', version).order('sort_order'),
    db.from('barbri_roadmap').select('*').eq('snapshot_version', version).order('sort_order'),
  ]);

  for (const result of [windowsResult, measurementResult, channelsResult, monthsResult, mediaPlanResult, roadmapResult]) {
    if (result.error) throw new Error(`Unable to load BARBRI planning detail: ${result.error.message}`);
  }

  const windows = (windowsResult.data ?? []).map((row) => ({
    key: String(row.window_key), label: String(row.window_label), startDate: String(row.start_date), endDate: String(row.end_date),
    spend: n(row.spend), nativeRevenue: n(row.native_revenue), nativeRoas: n(row.native_roas),
    ga4Revenue: n(row.ga4_revenue), ga4Roas: n(row.ga4_roas), purchases: n(row.purchases), aov: n(row.aov),
  }));
  const measurement = (measurementResult.data ?? []).map((row) => ({
    key: String(row.metric_key), label: String(row.label), value: n(row.value), unit: String(row.unit),
    evidenceType: String(row.evidence_type), definition: String(row.definition),
  }));
  const channels = (channelsResult.data ?? []).map((row) => ({
    key: String(row.channel_key), label: String(row.channel_label),
    currentRoas: row.current_roas === null ? null : n(row.current_roas), forecastRoas: n(row.forecast_roas),
    spend: n(row.spend), revenue: n(row.revenue), sales: n(row.sales),
    evidenceType: String(row.evidence_type), roleInPlan: String(row.role_in_plan),
  }));
  const months = (monthsResult.data ?? []).map((row) => ({
    key: String(row.month_key), label: String(row.month_label), dateRange: String(row.date_range), spend: n(row.spend),
    revenue: n(row.revenue), sales: n(row.sales), roas: n(row.roas),
  }));
  const mediaPlan = (mediaPlanResult.data ?? []).map((row) => ({
    key: String(row.line_key), allocationKey: String(row.allocation_key), allocationLabel: String(row.allocation_label),
    label: String(row.line_label), month1Spend: n(row.month_1_spend), month2Spend: n(row.month_2_spend),
    month3Spend: n(row.month_3_spend), totalSpend: n(row.total_spend), cpm: n(row.cpm), ctr: n(row.ctr),
    cpc: n(row.cpc), conversionRate: n(row.conversion_rate), forecastSales: n(row.forecast_sales),
    forecastRevenue: n(row.forecast_revenue), forecastRoas: n(row.forecast_roas),
    evidenceType: String(row.evidence_type), operatingIntent: String(row.operating_intent),
  }));
  const roadmap = (roadmapResult.data ?? []).map((row) => ({
    key: String(row.phase_key), timing: String(row.timing), theme: String(row.theme), actions: String(row.actions),
    decisionGate: String(row.decision_gate), primaryKpi: String(row.primary_kpi), ownerBoundary: String(row.owner_boundary),
  }));

  if (windows.length !== 5 || measurement.length !== 5 || channels.length !== 3 || months.length !== 3 || mediaPlan.length !== 16 || roadmap.length !== 4) {
    throw new Error('BARBRI planning snapshot is incomplete');
  }

  return {
    snapshot: {
      version, status: snapshotRow.status as BarbriSnapshot['status'], sourceCutoff: String(snapshotRow.source_cutoff),
      forecastStart: String(snapshotRow.forecast_start), forecastEnd: String(snapshotRow.forecast_end),
      currentModeledRoas: n(snapshotRow.current_modeled_roas), targetRoas: n(snapshotRow.target_roas),
      forecastSpend: n(snapshotRow.forecast_spend), forecastRevenue: n(snapshotRow.forecast_revenue),
      forecastSales: n(snapshotRow.forecast_sales), improvementPct: n(snapshotRow.improvement_pct),
      strategySummary: String(snapshotRow.strategy_summary),
    },
    windows, measurement, channels, months, mediaPlan, roadmap,
  };
}
