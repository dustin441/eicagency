// Fixed review window. Deliberately does not drift while leadership reviews the draft.
export const NSI_YTD_WINDOW = { start: '2026-01-01', end: '2026-10-31', compStart: '2025-01-01', compEnd: '2025-10-31' } as const;
export type YtdRevenueRow = { month_start: string; campaign: string; revenue: number | string | null };
export type YtdMediaRow = { date: string; sub_campaign: string | null; campaign_name: string | null; cost: number | string | null };
export const YTD_FAMILIES = [
  { key: 'BPT', label: 'Bridgeport', campaign: 'CCF-CON-BPT2' },
  { key: 'POL', label: 'Polaris, including Compression', campaign: 'CON-CON-POL2' },
  { key: 'CMP', label: 'Compression, included in Polaris', campaign: 'CON-CON-CMP' },
] as const;
export function changePct(current: number | null, previous: number | null): number | null {
  return current == null || previous == null || previous === 0 ? null : (current / previous - 1) * 100;
}
// Preserve the existing revenue page's legacy family definitions, adding the
// explicitly identified Bridgeport OOPS/EZL omissions in this draft only.
// Prefer the curated bucket, falling back to campaign name only if unclassified.
export function mediaFamily(row: YtdMediaRow): 'BPT' | 'POL' | 'OTHER' {
  const tagged = row.sub_campaign?.trim();
  const name = (tagged && tagged !== 'Default text if none found' ? tagged : row.campaign_name ?? '').toUpperCase();
  if (/(?:^|[^A-Z0-9])(?:BPT\d*|LQT|OOPS|EZL)(?:$|[^A-Z0-9])|PEN-100/.test(name)) return 'BPT';
  if (/(?:^|[^A-Z0-9])(?:POL\d*|CMP|LSS|MCH)(?:$|[^A-Z0-9])/.test(name)) return 'POL';
  return 'OTHER';
}
export function isCompression(row: YtdMediaRow): boolean {
  const tagged = row.sub_campaign?.trim();
  return /(?:^|[^A-Z0-9])CMP(?:$|[^A-Z0-9])/i.test(tagged && tagged !== 'Default text if none found' ? tagged : row.campaign_name ?? '');
}
export function revenueValue(rows: YtdRevenueRow[], year: number, campaigns: readonly string[], months = 10): { value: number | null; months: number } {
  let value = 0; let completeMonths = 0;
  for (let month = 1; month <= months; month++) {
    const key = `${year}-${String(month).padStart(2, '0')}-01`;
    const selected = campaigns.map(campaign => rows.filter(row => row.month_start === key && row.campaign === campaign));
    // Duplicate or null source rows are not trustworthy zeros or additive revisions.
    if (selected.every(matches => matches.length === 1 && matches[0].revenue != null && Number.isFinite(Number(matches[0].revenue)))) {
      completeMonths++;
      value += selected.reduce((sum, matches) => sum + Number(matches[0].revenue), 0);
    }
  }
  return { value: completeMonths === months ? value : null, months: completeMonths };
}
export function buildYtdRevenue(rows: YtdRevenueRow[], media: YtdMediaRow[]) {
  const spendFor = (year: number, filter: (row: YtdMediaRow) => boolean) => media
    .filter(row => row.date >= `${year}-01-01` && row.date <= `${year}-10-31` && filter(row))
    .reduce((sum, row) => sum + Number(row.cost ?? 0), 0);
  const revenueFamilies: Array<{ key: string; label: string; current: number | null; previous: number | null; months: number; previousMonths: number; spend: number; previousSpend: number }> = YTD_FAMILIES.map(family => {
    const current = revenueValue(rows, 2026, [family.campaign]);
    const previous = revenueValue(rows, 2025, [family.campaign]);
    const filter = family.key === 'CMP' ? isCompression : (row: YtdMediaRow) => mediaFamily(row) === family.key;
    return { key: family.key, label: family.label, current: current.value, previous: previous.value, months: current.months, previousMonths: previous.months, spend: spendFor(2026, filter), previousSpend: spendFor(2025, filter) };
  });
  revenueFamilies.push({ key: 'OTHER', label: 'Other media / Contractor 360', current: null, previous: null, months: 0, previousMonths: 0, spend: spendFor(2026, row => mediaFamily(row) === 'OTHER'), previousSpend: spendFor(2025, row => mediaFamily(row) === 'OTHER') });
  const combinedCampaigns = [YTD_FAMILIES[0].campaign, YTD_FAMILIES[1].campaign];
  const monthly = Array.from({ length: 10 }, (_, index) => {
    const month = String(index + 1).padStart(2, '0');
    const value = (year: number) => {
      const selected = rows.filter(row => row.month_start === `${year}-${month}-01` && combinedCampaigns.includes(row.campaign as typeof combinedCampaigns[number]));
      return selected.length === 2 && new Set(selected.map(row => row.campaign)).size === 2 && selected.every(row => row.revenue != null && Number.isFinite(Number(row.revenue))) ? selected.reduce((sum, row) => sum + Number(row.revenue), 0) : null;
    };
    return { month: `2026-${month}`, currentRevenue: value(2026), previousRevenue: value(2025), currentSpend: spendFor(2026, row => row.date.slice(5, 7) === month), previousSpend: spendFor(2025, row => row.date.slice(5, 7) === month) };
  });
  return { revenueFamilies, monthly };
}
