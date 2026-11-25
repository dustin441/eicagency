import type { MetaCreative } from '@/services/analytics';
export const TRAFFIC_COLUMNS = [
  { key: 'spend', label: 'Spend', kind: 'money' },
  { key: 'impressions', label: 'Impressions', kind: 'number' },
  { key: 'linkClicks', label: 'Link clicks', kind: 'number' },
  { key: 'linkCtr', label: 'Link CTR', kind: 'percent' },
  { key: 'linkCpc', label: 'CPC (link)', kind: 'money' },
  { key: 'landingPageViews', label: 'Landing page views', kind: 'number' },
  { key: 'costPerLpv', label: 'Cost per LPV', kind: 'money' },
] as const;
export type TrafficSortKey = typeof TRAFFIC_COLUMNS[number]['key'];
export function formatTraffic(value: number | null | undefined, kind: 'money' | 'percent' | 'number', currencySymbol = '$') {
  if (value == null) return 'N/A';
  if (kind === 'percent') return `${value.toFixed(2)}%`;
  return kind === 'money' ? `${currencySymbol}${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : value.toLocaleString('en-US', { maximumFractionDigits: 0 });
}
export function sortTrafficCreatives(creatives: MetaCreative[], key: TrafficSortKey) {
  const lowerIsBetter = key === 'linkCpc' || key === 'costPerLpv';
  return [...creatives].sort((a, b) => {
    const av = a.traffic?.[key] ?? null;
    const bv = b.traffic?.[key] ?? null;
    if (av === null) return bv === null ? 0 : 1;
    if (bv === null) return -1;
    return lowerIsBetter ? av - bv : bv - av;
  });
}
export function weightedTrafficCtr(creatives: MetaCreative[]): number | null {
  if (!creatives.length || creatives.some(ad => ad.traffic?.linkClicks == null || ad.traffic?.impressions == null)) return null;
  const impressions = creatives.reduce((sum, ad) => sum + ad.traffic!.impressions!, 0);
  return impressions > 0 ? creatives.reduce((sum, ad) => sum + ad.traffic!.linkClicks!, 0) / impressions * 100 : null;
}
