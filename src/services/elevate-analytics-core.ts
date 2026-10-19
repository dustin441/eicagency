export const ELEVATE_CHANNELS = ['Google Search', 'Meta', 'LinkedIn', 'GroundTruth'] as const;
export type ElevatePlatform = (typeof ELEVATE_CHANNELS)[number];
export type ElevatePerformanceRow = { date: string; platform: ElevatePlatform | string; account_id: string | null; campaign_id: string | null; campaign_name: string | null; creative_id: string; creative_name: string | null; impressions: number | string | null; clicks: number | string | null; spend: number | string | null; form_fills: number | string | null; preview_url: string | null; destination_url: string | null; metadata: Record<string, unknown> | null };
export type ElevateParams = { start: string; end: string; channel: string };
export type ElevateCreative = { platform: string; creativeId: string; creativeName: string; campaignName: string; spend: number; impressions: number; clicks: number; ctr: number; formFills: number | null; previewUrl: string | null; destinationUrl: string | null };
export type ElevateMetaPreview = { name: string; campaign: string; adset: string; headline: string; primaryText: string; finalCreativeLink: string; destinationUrl: string; ctaType: string; isVideo: boolean; videoId: string; videoUrl: string; previewUrl?: string; spend: number; leads: number; clicks: number; impressions: number; adId?: string };
export type ElevateGooglePreview = { id?: string; name: string; campaign: string; headline: string; description: string; headlines?: string[]; descriptions?: string[]; spend: number; clicks: number; impressions: number; results: number };
export type ElevateLinkedInPreview = { id: string; name: string; campaign: string; previewUrl: string | null; destinationUrl: string | null; spend: number; impressions: number; clicks: number; formFills: number | null };
export type ElevateDashboardData = {
  params: ElevateParams; totalSpend: number; totalImpressions: number; totalClicks: number; ctr: number; formFills: number | null; formFillCoverage: 'available' | 'partial' | 'unavailable'; sourceLatestDate: string | null;
  daily: Array<{ date: string; spend: number; impressions: number; clicks: number; formFills: number | null }>;
  creatives: ElevateCreative[];
  adPreviews: { meta: ElevateMetaPreview[]; google: ElevateGooglePreview[]; linkedin: ElevateLinkedInPreview[] };
  selectionUnavailable: boolean;
  channels: Array<{ platform: ElevatePlatform; status: 'connected' | 'represented'; spend: number | null; impressions: number | null; clicks: number | null; ctr: number | null; formFills: number | null; limitation: string | null }>;
  sourceError: string | null;
};
const numeric = (value: number | string | null | undefined) => Number(value ?? 0) || 0;
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
function summarizeRows(rows: ElevatePerformanceRow[]) {
  const tracked = rows.filter(row => row.form_fills !== null && row.form_fills !== undefined);
  const impressions = rows.reduce((sum, row) => sum + numeric(row.impressions), 0);
  const clicks = rows.reduce((sum, row) => sum + numeric(row.clicks), 0);
  return { spend: rows.reduce((sum, row) => sum + numeric(row.spend), 0), impressions, clicks, ctr: impressions > 0 ? clicks / impressions * 100 : 0, formFills: tracked.length ? tracked.reduce((sum, row) => sum + numeric(row.form_fills), 0) : null, trackedRows: tracked.length };
}
export function buildElevateDashboardData(rows: ElevatePerformanceRow[], params: ElevateParams, sourceError: string | null = null): ElevateDashboardData {
  const selected = rows.filter(row => row.date >= params.start && row.date <= params.end && (params.channel === 'all' || row.platform === params.channel));
  const totals = summarizeRows(selected);
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
    return { platform: first.platform, creativeId: first.creative_id, creativeName: first.creative_name || `Creative ${first.creative_id}`, campaignName: first.campaign_name || 'Elevate', spend: summary.spend, impressions: summary.impressions, clicks: summary.clicks, ctr: summary.ctr, formFills: summary.formFills, previewUrl: safeHttpUrl(first.preview_url), destinationUrl: safeHttpUrl(first.destination_url) };
  }).sort((a, b) => b.spend - a.spend || b.impressions - a.impressions);
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
      adPreviews.meta.push({ name, campaign, adset: metadataString(metadata, 'adset_name'), headline: metadataString(metadata, 'headline'), primaryText: metadataString(metadata, 'primary_text'), finalCreativeLink: imageUrl, destinationUrl, ctaType: metadataString(metadata, 'cta_type'), isVideo: metadata.is_video === true, videoId: metadataString(metadata, 'video_id'), videoUrl: safeHttpUrl(metadataString(metadata, 'video_url')) || '', previewUrl: safeHttpUrl(first.preview_url) || undefined, spend: summary.spend, leads: summary.formFills ?? 0, clicks: summary.clicks, impressions: summary.impressions, adId: first.creative_id });
    } else if (first.platform === 'Google Search') {
      const headlines = metadataStrings(metadata, 'headlines');
      const descriptions = metadataStrings(metadata, 'descriptions');
      adPreviews.google.push({ id: first.creative_id, name, campaign, headline: headlines[0] || name, description: descriptions[0] || '', headlines, descriptions, spend: summary.spend, clicks: summary.clicks, impressions: summary.impressions, results: summary.formFills ?? 0 });
    } else if (first.platform === 'LinkedIn') {
      adPreviews.linkedin.push({ id: first.creative_id, name, campaign, previewUrl: safeHttpUrl(first.preview_url), destinationUrl: safeHttpUrl(first.destination_url), spend: summary.spend, impressions: summary.impressions, clicks: summary.clicks, formFills: summary.formFills });
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
    const connected = platformRows.length > 0 && !sourceError;
    return { platform, status: connected ? 'connected' as const : 'represented' as const, spend: connected ? summary.spend : null, impressions: connected ? summary.impressions : null, clicks: connected ? summary.clicks : null, ctr: connected ? summary.ctr : null, formFills: connected ? summary.formFills : null, limitation: connected ? null : platform === 'Meta' && sourceError ? 'Meta performance data is temporarily unavailable.' : limitations[platform] };
  });
  const selectedChannel = params.channel === 'all' ? null : channels.find(channel => channel.platform === params.channel);
  return { params, totalSpend: totals.spend, totalImpressions: totals.impressions, totalClicks: totals.clicks, ctr: totals.ctr, formFills: totals.formFills, formFillCoverage: totals.trackedRows === 0 ? 'unavailable' : totals.trackedRows === selected.length ? 'available' : 'partial', sourceLatestDate: selected.reduce<string | null>((latest, row) => !latest || row.date > latest ? row.date : latest, null), daily, creatives, adPreviews, channels, selectionUnavailable: Boolean(selectedChannel && selectedChannel.status !== 'connected'), sourceError };
}
