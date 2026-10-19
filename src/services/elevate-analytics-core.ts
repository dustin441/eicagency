export const ELEVATE_CHANNELS = ['Google Search', 'Meta', 'LinkedIn', 'GroundTruth'] as const;
export type ElevatePlatform = (typeof ELEVATE_CHANNELS)[number];
export type Coverage = 'available' | 'partial' | 'unavailable';
export type ElevatePerformanceRow = { date: string; platform: ElevatePlatform | string; account_id: string | null; campaign_id: string | null; campaign_name: string | null; creative_id: string; creative_name: string | null; impressions: number | string | null; clicks: number | string | null; spend: number | string | null; form_fills: number | string | null; preview_url: string | null; destination_url: string | null; metadata: Record<string, unknown> | null };
export type ElevateParams = { start: string; end: string; channel: string };
export type ElevateCreative = { platform: string; creativeId: string; creativeName: string; campaignName: string; spend: number; impressions: number | null; clicks: number | null; ctr: number | null; formFills: number | null; previewUrl: string | null; destinationUrl: string | null };
export type ElevateMetaPreview = { name: string; campaign: string; adset: string; headline: string; primaryText: string; finalCreativeLink: string; destinationUrl: string; ctaType: string; isVideo: boolean; videoId: string; videoUrl: string; previewUrl?: string; spend: number; leads: number; clicks: number; impressions: number; adId?: string };
export type ElevateGooglePreview = { id?: string; name: string; campaign: string; headline: string; description: string; headlines?: string[]; descriptions?: string[]; spend: number; clicks: number; impressions: number; results: number };
export type ElevateLinkedInPreview = { id: string; name: string; campaign: string; previewUrl: string | null; destinationUrl: string | null; spend: number; impressions: number; clicks: number; formFills: number | null };
type MetricCoverage = { spend: Coverage; impressions: Coverage; clicks: Coverage; formFills: Coverage };
export type ElevateDashboardData = {
  params: ElevateParams; totalSpend: number | null; totalImpressions: number | null; totalClicks: number | null; ctr: number | null; formFills: number | null; metricCoverage: MetricCoverage; spendReconciliationNote: string | null; sourceLatestDate: string | null;
  daily: Array<{ date: string; spend: number | null; impressions: number | null; clicks: number | null; formFills: number | null }>;
  creatives: ElevateCreative[];
  adPreviews: { meta: ElevateMetaPreview[]; google: ElevateGooglePreview[]; linkedin: ElevateLinkedInPreview[] };
  selectionUnavailable: boolean;
  channels: Array<{ platform: ElevatePlatform; status: 'connected' | 'manual' | 'represented'; spend: number | null; impressions: number | null; clicks: number | null; ctr: number | null; formFills: number | null; coverage: MetricCoverage; limitation: string | null }>;
  sourceError: string | null;
};
const numeric = (value: number | string | null | undefined) => Number(value ?? 0) || 0;
const present = (value: unknown) => value !== null && value !== undefined;
const coverage = (tracked: number, total: number): Coverage => tracked === 0 ? 'unavailable' : tracked === total ? 'available' : 'partial';
const safeHttpUrl = (value: string | null) => {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? value : null;
  } catch {
    return null;
  }
};
const metadataString = (metadata: Record<string, unknown>, key: string) => typeof metadata[key] === 'string' ? metadata[key] as string : '';
const metadataStrings = (metadata: Record<string, unknown>, key: string) => Array.isArray(metadata[key]) ? (metadata[key] as unknown[]).filter((value): value is string => typeof value === 'string') : [];
const deliveryMetricsAvailable = (row: ElevatePerformanceRow) => !(row.platform === 'GroundTruth' && metadataString(row.metadata ?? {}, 'metrics_status').toLowerCase().includes('delivery metrics unavailable'));
function groundTruthReportedSpend(rows: ElevatePerformanceRow[]): number | null {
  if (!rows.length || rows.some(row => row.platform !== 'GroundTruth')) return null;
  const reportRows = rows.filter(row => row.metadata && typeof row.metadata.reported_campaign_total === 'object');
  const latestReportDate = reportRows.reduce<string | null>((latest, row) => !latest || row.date > latest ? row.date : latest, null);
  const latestRowDate = rows.reduce<string | null>((latest, row) => !latest || row.date > latest ? row.date : latest, null);
  if (!latestReportDate || latestReportDate !== latestRowDate) return null;
  const total = (reportRows[0].metadata?.reported_campaign_total as { spend?: unknown } | undefined)?.spend;
  const value = Number(total);
  const dailySpend = rows.reduce((sum, row) => sum + numeric(row.spend), 0);
  return Number.isFinite(value) && Math.abs(value - dailySpend) <= 0.02 ? value : null;
}
function summarizeRows(rows: ElevatePerformanceRow[]) {
  const spendRows = rows.filter(row => present(row.spend));
  const impressionRows = rows.filter(row => present(row.impressions) && deliveryMetricsAvailable(row));
  const clickRows = rows.filter(row => present(row.clicks) && deliveryMetricsAvailable(row));
  const formFillRows = rows.filter(row => present(row.form_fills));
  const dailySpend = spendRows.length ? spendRows.reduce((sum, row) => sum + numeric(row.spend), 0) : null;
  const reportedSpend = groundTruthReportedSpend(rows);
  const spend = reportedSpend ?? dailySpend;
  const impressions = impressionRows.length ? impressionRows.reduce((sum, row) => sum + numeric(row.impressions), 0) : null;
  const clicks = clickRows.length ? clickRows.reduce((sum, row) => sum + numeric(row.clicks), 0) : null;
  const metricCoverage = { spend: coverage(spendRows.length, rows.length), impressions: coverage(impressionRows.length, rows.length), clicks: coverage(clickRows.length, rows.length), formFills: coverage(formFillRows.length, rows.length) };
  const ctr = metricCoverage.impressions === 'available' && metricCoverage.clicks === 'available' && impressions && impressions > 0 && clicks !== null ? clicks / impressions * 100 : null;
  return { spend, impressions, clicks, ctr, formFills: formFillRows.length ? formFillRows.reduce((sum, row) => sum + numeric(row.form_fills), 0) : null, coverage: metricCoverage, spendReconciled: reportedSpend !== null && dailySpend !== null && Math.abs(reportedSpend - dailySpend) > 0.000001 };
}
export function buildElevateDashboardData(rows: ElevatePerformanceRow[], params: ElevateParams, sourceError: string | null = null): ElevateDashboardData {
  const selected = rows.filter(row => row.date >= params.start && row.date <= params.end && (params.channel === 'all' || row.platform === params.channel));
  const rawTotals = summarizeRows(selected);
  const dailyMap = new Map<string, ElevatePerformanceRow[]>();
  const creativeMap = new Map<string, ElevatePerformanceRow[]>();
  for (const row of selected) {
    dailyMap.set(row.date, [...(dailyMap.get(row.date) ?? []), row]);
    const key = `${row.platform}:${row.creative_id}`;
    creativeMap.set(key, [...(creativeMap.get(key) ?? []), row]);
  }
  const daily = Array.from(dailyMap.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([date, dayRows]) => { const summary = summarizeRows(dayRows); return { date, spend: summary.spend, impressions: summary.impressions, clicks: summary.clicks, formFills: summary.formFills }; });
  const creatives = Array.from(creativeMap.values()).map(creativeRows => {
    const summary = summarizeRows(creativeRows); const first = creativeRows[0];
    return { platform: first.platform, creativeId: first.creative_id, creativeName: first.creative_name || `Creative ${first.creative_id}`, campaignName: first.campaign_name || 'Elevate', spend: summary.spend ?? 0, impressions: summary.impressions, clicks: summary.clicks, ctr: summary.ctr, formFills: summary.formFills, previewUrl: safeHttpUrl(first.preview_url), destinationUrl: safeHttpUrl(first.destination_url) };
  }).sort((a, b) => b.spend - a.spend || (b.impressions ?? -1) - (a.impressions ?? -1));
  const adPreviews: ElevateDashboardData['adPreviews'] = { meta: [], google: [], linkedin: [] };
  for (const creativeRows of Array.from(creativeMap.values())) {
    const first = creativeRows.find(row => row.metadata && Object.keys(row.metadata).length > 0) ?? creativeRows[0];
    const metadata = first.metadata ?? {};
    const summary = summarizeRows(creativeRows);
    const name = first.creative_name || `Creative ${first.creative_id}`;
    const campaign = first.campaign_name || 'Elevate';
    if (first.platform === 'Meta') {
      const imageUrl = safeHttpUrl(metadataString(metadata, 'image_url')) || safeHttpUrl(metadataString(metadata, 'thumbnail_url')) || '';
      const destinationUrl = safeHttpUrl(metadataString(metadata, 'destination_url')) || safeHttpUrl(first.destination_url) || '';
      adPreviews.meta.push({ name, campaign, adset: metadataString(metadata, 'adset_name'), headline: metadataString(metadata, 'headline'), primaryText: metadataString(metadata, 'primary_text'), finalCreativeLink: imageUrl, destinationUrl, ctaType: metadataString(metadata, 'cta_type'), isVideo: metadata.is_video === true, videoId: metadataString(metadata, 'video_id'), videoUrl: safeHttpUrl(metadataString(metadata, 'video_url')) || '', previewUrl: safeHttpUrl(first.preview_url) || undefined, spend: summary.spend ?? 0, leads: summary.formFills ?? 0, clicks: summary.clicks ?? 0, impressions: summary.impressions ?? 0, adId: first.creative_id });
    } else if (first.platform === 'Google Search') {
      const headlines = metadataStrings(metadata, 'headlines');
      const descriptions = metadataStrings(metadata, 'descriptions');
      adPreviews.google.push({ id: first.creative_id, name, campaign, headline: headlines[0] || name, description: descriptions[0] || '', headlines, descriptions, spend: summary.spend ?? 0, clicks: summary.clicks ?? 0, impressions: summary.impressions ?? 0, results: summary.formFills ?? 0 });
    } else if (first.platform === 'LinkedIn') {
      adPreviews.linkedin.push({ id: first.creative_id, name, campaign, previewUrl: safeHttpUrl(first.preview_url), destinationUrl: safeHttpUrl(first.destination_url), spend: summary.spend ?? 0, impressions: summary.impressions ?? 0, clicks: summary.clicks ?? 0, formFills: summary.formFills });
    }
  }
  adPreviews.meta.sort((a, b) => b.spend - a.spend || b.impressions - a.impressions);
  adPreviews.google.sort((a, b) => b.spend - a.spend || b.impressions - a.impressions);
  adPreviews.linkedin.sort((a, b) => b.spend - a.spend || b.impressions - a.impressions);
  const limitations: Record<ElevatePlatform, string | null> = {
    Meta: 'No Meta delivery was returned for the selected period.',
    'Google Search': 'No Google Search delivery was returned for the selected period.',
    LinkedIn: 'No LinkedIn delivery was returned for the selected period.',
    GroundTruth: 'GroundTruth has no API connection. Metrics will be loaded manually after the source data is provided.',
  };
  const channels = ELEVATE_CHANNELS.map(platform => {
    const platformRows = selected.filter(row => row.platform === platform);
    const summary = summarizeRows(platformRows);
    const available = platformRows.length > 0 && !sourceError;
    const status = available ? (platform === 'GroundTruth' ? 'manual' as const : 'connected' as const) : 'represented' as const;
    const incomplete = summary.coverage.impressions !== 'available' || summary.coverage.clicks !== 'available' || summary.coverage.formFills !== 'available';
    const limitation = available && platform === 'GroundTruth'
      ? `Metrics are manually loaded from the latest supplied GroundTruth report.${summary.spendReconciled ? ' Native total spend is used; displayed daily spend differs by $0.01 due to source rounding.' : ''}${incomplete ? ' Some report rows omit delivery metrics; unavailable values are not treated as zero.' : ''}`
      : available ? null : platform === 'Meta' && sourceError ? 'Meta performance data is temporarily unavailable.' : limitations[platform];
    return { platform, status, spend: available ? summary.spend : null, impressions: available ? summary.impressions : null, clicks: available ? summary.clicks : null, ctr: available ? summary.ctr : null, formFills: available ? summary.formFills : null, coverage: summary.coverage, limitation };
  });
  const selectedChannel = params.channel === 'all' ? null : channels.find(channel => channel.platform === params.channel);
  const availableChannels = channels.filter(channel => channel.status !== 'represented');
  const totalSpend = availableChannels.length ? availableChannels.reduce((sum, channel) => sum + (channel.spend ?? 0), 0) : null;
  const spendReconciled = availableChannels.some(channel => channel.platform === 'GroundTruth' && channel.limitation?.includes('Native total spend'));
  return { params, totalSpend, totalImpressions: rawTotals.impressions, totalClicks: rawTotals.clicks, ctr: rawTotals.ctr, formFills: rawTotals.formFills, metricCoverage: rawTotals.coverage, spendReconciliationNote: spendReconciled ? 'Includes the GroundTruth native total; its displayed daily rows differ by $0.01 due to source rounding.' : null, sourceLatestDate: selected.reduce<string | null>((latest, row) => !latest || row.date > latest ? row.date : latest, null), daily, creatives, adPreviews, channels, selectionUnavailable: selected.length === 0 || Boolean(selectedChannel && selectedChannel.status === 'represented'), sourceError };
}
