// Presentation only. Never mutate or round the source metrics.
export const displayConversions = (value: number | null): string => value === null || !Number.isFinite(value) ? 'Not available' : new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value);
export function visibleYtdChannels<T extends { channel: string }>(rows: readonly T[]): T[] {
  const hidden = new Set(['ted', 'ew', 'ecm']);
  return rows.filter(row => !hidden.has(row.channel.toLowerCase().replace(/&amp;/g, '&').replace(/[^a-z0-9]/g, '')));
}
export function fundedYtdSubcampaigns<T extends { cost: number }>(rows: readonly T[]): T[] {
  return rows.filter(row => Number.isFinite(row.cost) && row.cost > 0);
}
export const MODELED_ROAS_LABEL = 'Modeled ROAS, 1% revenue assumption';
type ModelValue = number | null | undefined;
type ModelFamily = {
  key: string;
  current: ModelValue;
  previous: ModelValue;
  spend: ModelValue;
  previousSpend: ModelValue;
};
const positiveFinite = (value: ModelValue): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0;

// A scenario, not attributed revenue or actual ROI. Retain full source precision.
export function modeledRoas(reportedRevenue: ModelValue, matchingSpend: ModelValue): number | null {
  if (!positiveFinite(reportedRevenue) || !positiveFinite(matchingSpend)) return null;
  const value = 0.01 * reportedRevenue / matchingSpend;
  return Number.isFinite(value) ? value : null;
}

export function buildModeledRoas(families: readonly ModelFamily[]) {
  const byFamily = Object.fromEntries(families.map(family => [family.key, {
    current: modeledRoas(family.current, family.spend),
    previous: modeledRoas(family.previous, family.previousSpend),
  }]));
  // CMP is already inside POL. OTHER media has no matching revenue series.
  const headline = ['BPT', 'POL'].map(key => families.filter(family => family.key.toUpperCase() === key));
  const combinedPeriod = (revenueKey: 'current' | 'previous', spendKey: 'spend' | 'previousSpend') => {
    if (!headline.every(matches => matches.length === 1)) return null;
    const rows = headline.map(matches => matches[0]);
    if (!rows.every(row => positiveFinite(row[revenueKey]) && positiveFinite(row[spendKey]))) return null;
    const revenue = rows.reduce((sum, row) => sum + (row[revenueKey] as number), 0);
    const spend = rows.reduce((sum, row) => sum + (row[spendKey] as number), 0);
    return modeledRoas(revenue, spend);
  };
  return { combined: { current: combinedPeriod('current', 'spend'), previous: combinedPeriod('previous', 'previousSpend') }, byFamily };
}
export const conversionOptions = [
  { key: 'productSubmittals', label: 'Product Submittals' },
  { key: 'hubspotFormFills', label: 'HubSpot Form Fills' },
  { key: 'metaLeads', label: 'Meta Leads' },
  { key: 'websiteConversions', label: 'Website conversions, rate and cost' },
] as const;
export type ConversionColumn = typeof conversionOptions[number]['key'];
const activityKeys = ['cost', 'impressions', 'clicks', 'conversions', 'sessions', 'engagedSessions', 'websiteClicks', 'websiteCost', 'websiteConversions', 'productSubmittals', 'hubspotFormFills', 'metaClicks', 'metaCost', 'metaLeads'] as const;
type Activity = Partial<Record<typeof activityKeys[number], number>>;
export function hasCurrentActivity(row: Activity): boolean {
  return activityKeys.some(key => (row[key] ?? 0) !== 0);
}
export function partitionActivity<T extends Activity>(rows: readonly T[]) {
  return { active: rows.filter(hasCurrentActivity), inactive: rows.filter(row => !hasCurrentActivity(row)) };
}
export function totalConversions(row: Pick<Activity, 'productSubmittals' | 'hubspotFormFills' | 'metaLeads'>) {
  return (row.productSubmittals ?? 0) + (row.hubspotFormFills ?? 0) + (row.metaLeads ?? 0);
}
export function yoyLabel(current: number | null, previous: number | null): string {
  if (current === null || previous === null || !Number.isFinite(current) || !Number.isFinite(previous) || previous <= 0) return 'YoY not available';
  const value = (current - previous) / previous;
  if (value === 0) return 'Unchanged 0.0% YoY';
  return `${value > 0 ? '↑ Up' : '↓ Down'} ${(Math.abs(value) * 100).toFixed(1)}% YoY`;
}
