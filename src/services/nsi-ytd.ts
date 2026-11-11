import 'server-only';
import { createSpartacoSupabaseClient } from '@/lib/spartaco-supabase-server';
import { buildYtdRevenue, NSI_YTD_WINDOW, type YtdMediaRow, type YtdRevenueRow } from '@/lib/nsi-ytd-core';
import { fetchNsiDashboardData, type NsiDashboardData } from './nsi-analytics';

type TableMetrics = Omit<NsiDashboardData['channelRows'][number], 'channel'>;
export type NsiYtdData = {
  start: string; end: string; compStart: string; compEnd: string; asOf: string;
  summary: NsiDashboardData['summary']; prevSummary: NsiDashboardData['prevSummary'];
  conversionBreakout: NsiDashboardData['conversionBreakout'];
  channels: NsiDashboardData['channelRows']; audiences: NsiDashboardData['audienceTypeRows'];
  campaignTypes: NsiDashboardData['campaignTypeRows']; campaigns: NsiDashboardData['subCampaignRows'];
  revenueFamilies: ReturnType<typeof buildYtdRevenue>['revenueFamilies'];
  monthly: ReturnType<typeof buildYtdRevenue>['monthly']; warnings: string[];
};

// Named tables in the existing service intentionally omit untagged rows and
// legacy channels. Keep those conventions, but expose their residual here so
// the new all-activity report does not silently lose spend or conversions.
function residual(rows: TableMetrics[], dashboard: NsiDashboardData): TableMetrics | null {
  const totals = {} as TableMetrics;
  for (const prefix of ['', 'prev'] as const) {
    const summary = prefix ? dashboard.prevSummary : dashboard.summary;
    const split = prefix ? dashboard.prevConversionBreakout : dashboard.conversionBreakout;
    const fields = {
      impressions: summary.impressions, clicks: summary.clicks, cost: summary.cost,
      conversions: summary.conversions, sessions: summary.sessions, engagedSessions: summary.engagedSessions,
      websiteClicks: split.websiteClicks, websiteCost: split.websiteCost,
      websiteConversions: split.websiteConversions, productSubmittals: split.productSubmittals,
      hubspotFormFills: split.hubspotFormFills, metaClicks: split.metaClicks,
      metaCost: split.metaCost, metaLeads: split.metaLeads,
    };
    for (const [field, total] of Object.entries(fields)) {
      const key = (prefix ? `prev${field[0].toUpperCase()}${field.slice(1)}` : field) as keyof TableMetrics;
      const remainder = total - rows.reduce((sum, row) => sum + row[key], 0);
      if (remainder < -0.01) throw new Error(`NSI YTD breakdown exceeds portfolio total: ${key}`);
      totals[key] = Math.abs(remainder) < 0.000001 ? 0 : remainder;
    }
  }
  return Object.values(totals).some(value => value > 0.000001) ? totals : null;
}

export async function fetchNsiYtdData(): Promise<NsiYtdData> {
  const client = createSpartacoSupabaseClient();
  async function fetchMedia(start: string, end: string): Promise<YtdMediaRow[]> {
    const rows: YtdMediaRow[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await client.from('nsi_master_campaign_daily')
        .select('date,sub_campaign,campaign_name,cost').gte('date', start).lte('date', end)
        .order('date').order('id').range(from, from + 999);
      if (error) throw new Error(`NSI YTD media unavailable: ${error.message}`);
      if (data == null) throw new Error('NSI YTD media query returned no response');
      rows.push(...data);
      if (data.length < 1000) return rows;
    }
  }
  const { start, end, compStart, compEnd } = NSI_YTD_WINDOW;
  const [dashboard, currentMedia, previousMedia, revenue] = await Promise.all([
    fetchNsiDashboardData({ ...NSI_YTD_WINDOW, compMode: 'custom', channel: 'all', campaignType: 'all', campaign: 'all', torpedo: 'all', objective: 'all' }),
    fetchMedia(start, end), fetchMedia(compStart, compEnd),
    client.from('nsi_revenue').select('month_start,campaign,revenue').gte('month_start', compStart).lte('month_start', end).order('month_start').order('id').limit(1000),
  ]);
  if (revenue.error || !revenue.data) throw new Error(`NSI YTD revenue unavailable: ${revenue.error?.message ?? 'no response'}`);
  if (revenue.data.length >= 1000) throw new Error('NSI YTD revenue result may be truncated');
  const media = [...currentMedia, ...previousMedia];
  // Independent narrow-query totals must agree with the shared dashboard path.
  for (const [rows, expected] of [[currentMedia, dashboard.summary.cost], [previousMedia, dashboard.prevSummary.cost]] as const) {
    if (Math.abs(rows.reduce((sum, row) => sum + Number(row.cost ?? 0), 0) - expected) > 0.01) throw new Error('NSI YTD source changed during read, refresh the report');
  }
  const { revenueFamilies, monthly } = buildYtdRevenue(revenue.data as YtdRevenueRow[], media);
  const campaigns = [...dashboard.subCampaignRows];
  const unmapped = residual(campaigns, dashboard);
  if (unmapped) campaigns.push({ subCampaign: 'Other / unmapped', ...unmapped });
  const campaignTypes = [...dashboard.campaignTypeRows];
  const otherTypes = residual(campaignTypes, dashboard);
  if (otherTypes) campaignTypes.push({ campaignType: 'Publisher / other inventory', ...otherTypes });
  // Audience taxonomy changed in 2026. The legacy distributor label absorbed
  // traffic now identified as contractor, so neither side is a like-for-like YoY.
  const audiences = dashboard.audienceTypeRows.map(row => ({ ...row, suppressComparison: true }));
  const otherAudiences = residual(audiences, dashboard);
  if (otherAudiences) audiences.push({ audienceType: 'Other / historically unclassified', suppressComparison: true, ...otherAudiences });
  const warnings = [
    'Revenue is company sales from the reporting warehouse, not revenue attributed to ads. Modeled ROAS applies the approved 1% revenue assumption to matching business-line media spend; it is a scenario, not measured attribution, actual ROI or causal lift.',
    'Conversions are platform-attributed actions, not unique leads, customers or sales. Pre-2026 tracking is not comparable, so conversion YoY is unavailable.',
    'Onsite sessions and engaged sessions follow the existing campaign-attributed warehouse definition. They are not independently reconciled property-level GA4 totals; users are not summed or shown.',
    'Bridgeport media includes BPT, LQT, PEN-100, OOPS and EZL. Polaris includes POL, CMP, LSS and MCH. Compression is nested inside Polaris, never added again. Other media stays in portfolio spend without invented revenue.',
    'Contractor/distributor audience classifications changed in 2026. All audience YoY comparisons are withheld, because the old distributor bucket is not equivalent to the current one. Historical residuals remain visible without being relabeled.',
    'November 4 native delivery audit: Google Ads account 2580549250 (NSI Industries, USD, America/Chicago) matches warehouse spend, clicks and impressions for both YTD windows. Meta account 1189511575368694 (USD, America/New_York) matches 2025; 2026 warehouse delivery is short by $71.16, 82 clicks and 4,957 impressions, isolated to October 7. LinkedIn and publishers are not native-reconciled. The separate NSI HVAC Google account is outside this report.',
    'Campaign tagging exception: 22 October OOPS Meta leads remain outside the named OOPS bucket, but inside channel/portfolio totals. This draft includes identifiable OOPS spend in Bridgeport through campaign-name fallback and retains untagged campaign activity in Other / unmapped. No source ingestion or existing monthly/revenue page was changed.',
  ];
  for (const family of revenueFamilies.filter(row => row.key !== 'OTHER')) {
    if (family.months !== 10 || family.previousMonths !== 10) warnings.push(`${family.label}: incomplete revenue coverage (${family.months}/10 current, ${family.previousMonths}/10 prior). Totals are unavailable rather than zero.`);
  }
  return { ...NSI_YTD_WINDOW, asOf: new Date().toISOString(), summary: dashboard.summary, prevSummary: dashboard.prevSummary, conversionBreakout: dashboard.conversionBreakout, channels: dashboard.channelRows, audiences, campaignTypes, campaigns, revenueFamilies, monthly, warnings };
}
