// Presentation only. Never mutate or round the source metrics.
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
