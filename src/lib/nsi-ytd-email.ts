export type EmailMetrics = {
  campaign_name: string;
  total_sent: number | null;
  total_delivered: number | null;
  unique_opened: number | null;
  unique_clicked: number | null;
  unique_open_rate: number | null;
  unique_click_rate: number | null;
  click_through_rate: number | null;
  delivery_rate: number | null;
  unsubscribe_rate: number | null;
  spam_report_rate: number | null;
};
export type EmailCampaignRow = { guid: string; name: string; current: EmailMetrics | null; previous: EmailMetrics | null };
export type EmailSnapshot = {
  extractedAt: string;
  periods: { current: { startDate: string; endDate: string }; previous: { startDate: string; endDate: string } };
  rows: EmailCampaignRow[];
};
/** Validate and project protected server configuration, without retaining unexpected fields. */
export function parseEmailSnapshot(raw: string): EmailSnapshot {
  const invalid = (field: string): never => { throw new Error(`Invalid NSI YTD email snapshot: ${field}`); };
  const record = (value: unknown): Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : invalid('object');
  let decoded: unknown;
  try { decoded = JSON.parse(raw); } catch { return invalid('JSON'); }
  const root = record(decoded);
  if (typeof root.extractedAt !== 'string' || !Number.isFinite(Date.parse(root.extractedAt))) return invalid('extraction date');
  const periods = record(root.periods);
  const current = record(periods.current);
  const previous = record(periods.previous);
  if (current.startDate !== '2026-01-01' || current.endDate !== '2026-10-31' || previous.startDate !== '2025-01-01' || previous.endDate !== '2025-10-31') return invalid('fixed reporting windows');
  if (!Array.isArray(root.rows) || root.rows.length === 0 || root.rows.length > 100) return invalid('campaign rows');
  const counts = ['total_sent', 'total_delivered', 'unique_opened', 'unique_clicked'] as const;
  const rates = ['unique_open_rate', 'unique_click_rate', 'click_through_rate', 'delivery_rate', 'unsubscribe_rate', 'spam_report_rate'] as const;
  const readMetrics = (value: unknown, name: string): EmailMetrics | null => {
    if (value === null) return null;
    const input = record(value);
    if (input.campaign_name !== name) return invalid('campaign identity');
    const result: EmailMetrics = { campaign_name: name, total_sent: null, total_delivered: null, unique_opened: null, unique_clicked: null, unique_open_rate: null, unique_click_rate: null, click_through_rate: null, delivery_rate: null, unsubscribe_rate: null, spam_report_rate: null };
    for (const key of [...counts, ...rates]) {
      const number = input[key];
      if (number !== null && (typeof number !== 'number' || !Number.isFinite(number) || number < 0)) return invalid('numeric metrics');
      result[key] = number as number | null;
    }
    for (const key of counts) if (result[key] !== null && !Number.isInteger(result[key])) return invalid('integer counts');
    for (const key of rates) if (result[key] !== null && result[key]! > 1) return invalid('rate range');
    if (result.total_delivered !== null) {
      if (result.total_sent !== null && result.total_delivered > result.total_sent) return invalid('delivery counts');
      for (const key of ['unique_opened', 'unique_clicked'] as const) if (result[key] !== null && result[key]! > result.total_delivered) return invalid('engagement counts');
    }
    return result;
  };
  const seen = new Set<string>();
  const rows = root.rows.map(value => {
    const row = record(value);
    if (typeof row.guid !== 'string' || !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(row.guid) || seen.has(row.guid)) return invalid('campaign GUID');
    if (typeof row.name !== 'string' || !/^(CCF-|CON-|NEL-)/.test(row.name)) return invalid('product campaign scope');
    seen.add(row.guid);
    const current = readMetrics(row.current, row.name);
    const previous = readMetrics(row.previous, row.name);
    if (current === null && previous === null) return invalid('missing campaign periods');
    return { guid: row.guid, name: row.name, current, previous };
  });
  return { extractedAt: root.extractedAt, periods: { current: { startDate: '2026-01-01', endDate: '2026-10-31' }, previous: { startDate: '2025-01-01', endDate: '2025-10-31' } }, rows };
}

export type EmailPeriod = 'current' | 'previous';
export const emailCount = (value: number | null) => value === null ? 'N/A' : new Intl.NumberFormat('en-US').format(value);
export const emailRate = (value: number | null) => value === null ? 'N/A' : `${(value * 100).toFixed(2)}%`;
export function emailSendChange(current: number | null, previous: number | null): number | null {
  return current === null || previous === null || previous <= 0 ? null : (current - previous) / previous;
}
export function emailChangeLabel(current: number | null, previous: number | null): string {
  const change = emailSendChange(current, previous);
  return change === null ? 'N/A' : `${change > 0 ? '+' : ''}${emailRate(change)}`;
}
export function partitionEmailRows(rows: readonly EmailCampaignRow[]) {
  return { current: rows.filter(row => row.current !== null), historical: rows.filter(row => row.current === null && row.previous !== null) };
}
/** Missing groups stay missing; only returned rows contribute to each period's sums. */
export function aggregateEmailRows(rows: readonly EmailCampaignRow[], period: EmailPeriod) {
  const metrics = rows.flatMap(row => row[period] === null ? [] : [row[period]]);
  const sum = (key: 'total_sent' | 'total_delivered' | 'unique_opened' | 'unique_clicked'): number | null =>
    !metrics.length || metrics.some(row => row[key] === null) ? null : metrics.reduce((total, row) => total + row[key]!, 0);
  const sent = sum('total_sent');
  const delivered = sum('total_delivered');
  const opened = sum('unique_opened');
  const clicked = sum('unique_clicked');
  const ratio = (n: number | null, d: number | null) => n === null || d === null || d <= 0 ? null : n / d;
  return { sent, delivered, opened, clicked, openRate: ratio(opened, delivered), clickRate: ratio(clicked, delivered), deliveryRate: ratio(delivered, sent) };
}
