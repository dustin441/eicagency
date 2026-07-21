export type JsonRecord = Record<string, unknown>;

type ActionMetric = { action_type?: string; value?: string | number };
type MetaRow = JsonRecord & {
  actions?: ActionMetric[];
  ad_id?: string;
  ad_name?: string;
  adset_name?: string;
  campaign_id?: string;
  campaign_name?: string;
  clicks?: string | number;
  date_start?: string;
  impressions?: string | number;
  spend?: string | number;
};

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as JsonRecord
    : {};
}

function asRecords(value: unknown): JsonRecord[] {
  return Array.isArray(value) ? value.map(asRecord) : [];
}

function dateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function buildDateWindow(kind: unknown, now = new Date()): JsonRecord {
  if (kind === 'meta-campaign') {
    return { start: '2026-01-01', end: dateOnly(now) };
  }

  const yesterday = new Date(now);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  yesterday.setUTCHours(0, 0, 0, 0);

  if (kind === 'meta-creatives') {
    const thirtyDaysAgo = new Date(yesterday);
    thirtyDaysAgo.setUTCDate(thirtyDaysAgo.getUTCDate() - 29);
    return {
      since: dateOnly(thirtyDaysAgo),
      until: dateOnly(yesterday),
      label: dateOnly(yesterday).slice(0, 7),
    };
  }

  if (kind === 'ga4') {
    const start = new Date(yesterday);
    start.setUTCDate(start.getUTCDate() - 2);
    return {
      startDate: dateOnly(start),
      endDate: dateOnly(yesterday),
      refreshMode: 'rolling-3-day',
    };
  }

  throw new Error('Unsupported date-window kind');
}

export function metaCampaignRows(chunksValue: unknown): JsonRecord[] {
  const out: JsonRecord[] = [];
  for (const chunk of asRecords(chunksValue)) {
    for (const rawRow of asRecords(chunk.data)) {
      const row = rawRow as MetaRow;
      if (!row.date_start) continue;
      const conversions = (row.actions || [])
        .filter((action) => ['lead', 'schedule', 'complete_registration'].includes(action.action_type || ''))
        .reduce((sum, action) => sum + Number(action.value || 0), 0);
      out.push({
        date: row.date_start,
        campaign_id: row.campaign_id || '',
        campaign_name: row.campaign_name || '',
        impressions: Number(row.impressions || 0),
        clicks: Number(row.clicks || 0),
        spend: Number(row.spend || 0),
        leads: conversions,
      });
    }
  }
  return out;
}

export function flattenMetaRows(chunksValue: unknown): JsonRecord[] {
  const out: JsonRecord[] = [];
  for (const chunk of asRecords(chunksValue)) {
    if (chunk.error) continue;
    out.push(...asRecords(chunk.data));
  }
  return out;
}

export function uniqueAdIds(rowsValue: unknown): JsonRecord[] {
  const seen = new Set<string>();
  const out: JsonRecord[] = [];
  for (const row of asRecords(rowsValue)) {
    const id = String(row.ad_id || '');
    if (id && !seen.has(id)) {
      seen.add(id);
      out.push({ ad_id: id });
    }
  }
  return out;
}

function firstValue(...values: unknown[]): unknown {
  return values.find((value) => value !== undefined && value !== null && value !== '') ?? null;
}

function firstAssetValue(items: unknown, field: string): unknown {
  if (!Array.isArray(items)) return null;
  const match = items.map(asRecord).find((item) => item[field]);
  return match ? match[field] : null;
}

export function mergeAdCreatives(creativeValue: unknown, performanceValue: unknown): JsonRecord[] {
  const performanceMap = new Map<string, JsonRecord>();
  for (const raw of asRecords(performanceValue)) {
    const row = raw as MetaRow;
    const key = `${row.ad_id || ''}|${row.date_start || ''}`;
    if (performanceMap.has(key)) continue;
    const leads = (row.actions || [])
      .filter((action) => ['lead', 'on_facebook_lead', 'leadgen_grouped'].includes(action.action_type || ''))
      .reduce((sum, action) => sum + Number(action.value || 0), 0);
    const landingPageViews = (row.actions || [])
      .filter((action) => action.action_type === 'landing_page_view')
      .reduce((sum, action) => sum + Number(action.value || 0), 0);
    performanceMap.set(key, {
      ad_id: row.ad_id || '',
      ad_name: row.ad_name || '',
      adset_name: row.adset_name || '',
      campaign_name: row.campaign_name || '',
      date: row.date_start || '',
      spend: Number.parseFloat(String(row.spend || 0)),
      impressions: Number.parseInt(String(row.impressions || 0), 10),
      clicks: Number.parseInt(String(row.clicks || 0), 10),
      leads,
      landing_page_views: landingPageViews,
    });
  }

  const creativeMap = new Map<string, JsonRecord>();
  for (const row of asRecords(creativeValue)) {
    const creative = asRecord(row.creative);
    const story = asRecord(creative.object_story_spec);
    const linkData = asRecord(story.link_data);
    const videoData = asRecord(story.video_data);
    const assetFeed = asRecord(creative.asset_feed_spec);
    const callToAction = asRecord(videoData.call_to_action);
    const callToActionValue = asRecord(callToAction.value);
    const linkCallToAction = asRecord(linkData.call_to_action);

    const imageHash = firstValue(
      creative.image_hash,
      linkData.image_hash,
      videoData.image_hash,
      firstAssetValue(assetFeed.images, 'hash'),
      firstAssetValue(assetFeed.ad_formats, 'hash'),
    );
    const fallbackImage = firstValue(
      creative.image_url,
      linkData.picture,
      videoData.image_url,
      firstAssetValue(assetFeed.images, 'url'),
      creative.thumbnail_url,
    );
    const videoId = firstValue(creative.video_id, videoData.video_id);

    creativeMap.set(String(row.id || ''), {
      creative_id: creative.id || null,
      image_hash: imageHash,
      final_creative_link: fallbackImage,
      video_id: videoId,
      video_url: null,
      headline: firstValue(creative.title, linkData.name, videoData.title, firstAssetValue(assetFeed.titles, 'text'), ''),
      primary_text: firstValue(creative.body, linkData.message, videoData.message, firstAssetValue(assetFeed.bodies, 'text'), ''),
      destination_url: firstValue(creative.link_url, linkData.link, callToActionValue.link, firstAssetValue(assetFeed.link_urls, 'website_url'), ''),
      cta_type: firstValue(creative.call_to_action_type, linkCallToAction.type, callToAction.type, ''),
      is_video: Boolean(videoId),
      ad_status: 'ACTIVE',
    });
  }

  return [...performanceMap.values()].map((performance) => ({
    ...performance,
    ...(creativeMap.get(String(performance.ad_id || '')) || {}),
  }));
}

export function uniqueImageHashes(rowsValue: unknown): JsonRecord[] {
  const seen = new Set<string>();
  const out: JsonRecord[] = [];
  for (const row of asRecords(rowsValue)) {
    const hash = String(row.image_hash || '');
    if (hash && !seen.has(hash)) {
      seen.add(hash);
      out.push({ image_hash: hash });
    }
  }
  return out.length ? out : [{ image_hash: '' }];
}

export function injectImageUrls(imageResponsesValue: unknown, rowsValue: unknown): JsonRecord[] {
  const hashToUrl = new Map<string, string>();
  for (const response of asRecords(imageResponsesValue)) {
    for (const image of asRecords(response.data)) {
      if (image.hash && image.url) hashToUrl.set(String(image.hash), String(image.url));
    }
  }
  return asRecords(rowsValue).map((row) => ({
    ...row,
    final_creative_link: row.image_hash && hashToUrl.has(String(row.image_hash))
      ? hashToUrl.get(String(row.image_hash))
      : row.final_creative_link,
  }));
}

export function uniqueVideoIds(rowsValue: unknown): JsonRecord[] {
  const seen = new Set<string>();
  const out: JsonRecord[] = [];
  for (const row of asRecords(rowsValue)) {
    const id = String(row.video_id || '');
    if (id && id !== 'null' && !seen.has(id)) {
      seen.add(id);
      out.push({ video_id: id });
    }
  }
  return out.length ? out : [{ video_id: null, _skip: true }];
}

function bestThumbnail(video: JsonRecord): string | null {
  const thumbnailContainer = asRecord(video.thumbnails);
  const thumbnails = asRecords(thumbnailContainer.data).filter((thumbnail) => thumbnail.uri);
  const preferred = thumbnails.find((thumbnail) => thumbnail.is_preferred);
  const largest = thumbnails.sort((a, b) =>
    Number(b.width || 0) * Number(b.height || 0) - Number(a.width || 0) * Number(a.height || 0))[0];
  return String(preferred?.uri || largest?.uri || video.picture || '') || null;
}

export function injectVideoUrls(videoResponsesValue: unknown, rowsValue: unknown): JsonRecord[] {
  const videoMap = new Map<string, { source: string | null; thumbnail: string | null }>();
  for (const video of asRecords(videoResponsesValue)) {
    if (!video.id) continue;
    videoMap.set(String(video.id), {
      source: String(video.source || '') || null,
      thumbnail: bestThumbnail(video),
    });
  }

  return asRecords(rowsValue).map((row) => {
    const video = row.video_id ? videoMap.get(String(row.video_id)) : undefined;
    const current = typeof row.final_creative_link === 'string' ? row.final_creative_link : '';
    const compressed = /p64x64|_p64x64|s64x64|64x64|q75/.test(current);
    const shouldReplace = Boolean(video?.thumbnail) && (!current || Boolean(row.is_video) || compressed);
    return {
      ...row,
      final_creative_link: shouldReplace ? video?.thumbnail : row.final_creative_link,
      video_url: video?.source || row.video_url || null,
    };
  });
}

export function buildGa4Request(windowValue: unknown): JsonRecord {
  const window = asRecord(windowValue);
  const propertyId = '399325751';
  const requestBody = {
    dimensions: [
      { name: 'date' },
      { name: 'sessionSource' },
      { name: 'sessionMedium' },
      { name: 'sessionDefaultChannelGroup' },
      { name: 'sessionCampaignName' },
      { name: 'sessionManualAdContent' },
      { name: 'sessionManualTerm' },
      { name: 'landingPagePlusQueryString' },
    ],
    metrics: [
      { name: 'sessions' },
      { name: 'engagedSessions' },
      { name: 'engagementRate' },
      { name: 'bounceRate' },
      { name: 'averageSessionDuration' },
      { name: 'screenPageViews' },
      { name: 'keyEvents' },
    ],
    dateRanges: [{ startDate: window.startDate, endDate: window.endDate }],
    keepEmptyRows: false,
    limit: 100000,
  };
  return {
    propertyId,
    startDate: window.startDate,
    endDate: window.endDate,
    requestBody: JSON.stringify(requestBody),
  };
}

function cleanNotSet(value: unknown): string {
  const normalized = String(value || '').trim();
  return ['(not set)', '(none)', '(direct)'].includes(normalized.toLowerCase()) ? '' : normalized;
}

function normalize(value: unknown): string {
  let normalized = cleanNotSet(value);
  if (!normalized) return '';
  try {
    normalized = decodeURIComponent(normalized.replace(/\+/g, ' '));
  } catch {
    normalized = normalized.replace(/\+/g, ' ');
  }
  return normalized.replace(/\s+/g, ' ').trim();
}

function validId(value: unknown): string {
  const normalized = normalize(value);
  return /^\d{6,}$/.test(normalized) ? normalized : '';
}

function decodeQuery(value: unknown): string {
  const normalized = String(value || '').replace(/\+/g, ' ');
  try {
    return decodeURIComponent(normalized);
  } catch {
    return normalized;
  }
}

function parseLanding(raw: unknown): JsonRecord {
  if (!raw) {
    return {
      landing_page: '', campaign_id: '', adset_id: '', ad_id: '', utm_adgroup_name: '',
      utm_source: '', utm_medium: '', utm_campaign: '', utm_content: '', utm_term: '',
    };
  }
  const withoutOrigin = String(raw).replace(/^https?:\/\/[^/]+/i, '');
  const question = withoutOrigin.indexOf('?');
  const path = question >= 0 ? withoutOrigin.slice(0, question) : withoutOrigin;
  const query = question >= 0 ? withoutOrigin.slice(question + 1) : '';
  const params: Record<string, string> = {};
  for (const pair of query.split('&')) {
    if (!pair) continue;
    const equals = pair.indexOf('=');
    const rawKey = equals >= 0 ? pair.slice(0, equals) : pair;
    const rawValue = equals >= 0 ? pair.slice(equals + 1) : '';
    params[decodeQuery(rawKey)] = rawValue;
  }
  return {
    landing_page: path || '/',
    campaign_id: validId(params.campaign_id),
    adset_id: validId(params.adset_id),
    ad_id: validId(params.ad_id),
    utm_adgroup_name: normalize(params.utm_adgroup_name),
    utm_source: normalize(params.utm_source),
    utm_medium: normalize(params.utm_medium),
    utm_campaign: normalize(params.utm_campaign),
    utm_content: normalize(params.utm_content),
    utm_term: normalize(params.utm_term),
  };
}

function detectPlatform(source: string, medium: string, channel: string): string {
  const combined = `${source} ${medium} ${channel}`.toLowerCase();
  if (/(^|\s)(fb|ig)(\s|$)|facebook|instagram|meta/.test(combined)) return 'Meta';
  if (source.toLowerCase().includes('google') || /\bcpc\b|\bpmax\b/.test(combined)) return 'Google';
  return channel || 'Other';
}

function numberValue(value: unknown): number {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function round(value: number, places: number): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

export function normalizeGa4(responseValue: unknown, propertyIdValue: unknown): JsonRecord[] {
  const response = asRecord(responseValue);
  const propertyId = String(propertyIdValue || '399325751');
  const groups = new Map<string, JsonRecord & { _duration_seconds: number }>();

  for (const row of asRecords(response.rows)) {
    const dimensions = asRecords(row.dimensionValues);
    const metrics = asRecords(row.metricValues);
    const rawDate = String(dimensions[0]?.value || '');
    const date = rawDate ? `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}` : '';
    let source = normalize(dimensions[1]?.value);
    let medium = normalize(dimensions[2]?.value);
    const channel = normalize(dimensions[3]?.value);
    let campaign = normalize(dimensions[4]?.value);
    let content = normalize(dimensions[5]?.value);
    let term = normalize(dimensions[6]?.value);
    const parsed = parseLanding(cleanNotSet(dimensions[7]?.value));
    source = source || String(parsed.utm_source || '');
    medium = medium || String(parsed.utm_medium || '');
    campaign = campaign || String(parsed.utm_campaign || '');
    content = content || String(parsed.utm_content || '');
    term = term || String(parsed.utm_term || '');
    const platform = detectPlatform(source, medium, channel);
    const keyParts = [date, propertyId, platform, source, medium, channel, campaign, content, term,
      parsed.landing_page, parsed.campaign_id, parsed.adset_id, parsed.ad_id, parsed.utm_adgroup_name];
    const rowKey = keyParts.join('\u001f');
    const sessions = numberValue(metrics[0]?.value);
    const existing = groups.get(rowKey) || {
      row_key: rowKey,
      property_id: propertyId,
      date,
      platform,
      session_source: source,
      session_medium: medium,
      session_default_channel_group: channel,
      session_campaign_name: campaign,
      session_manual_ad_content: content,
      session_manual_term: term,
      landing_page: parsed.landing_page,
      campaign_id: parsed.campaign_id,
      adset_id: parsed.adset_id,
      ad_id: parsed.ad_id,
      utm_adgroup_name: parsed.utm_adgroup_name,
      sessions: 0,
      engaged_sessions: 0,
      _duration_seconds: 0,
      screen_page_views: 0,
      key_events: 0,
    };
    existing.sessions = numberValue(existing.sessions) + sessions;
    existing.engaged_sessions = numberValue(existing.engaged_sessions) + numberValue(metrics[1]?.value);
    existing._duration_seconds += numberValue(metrics[4]?.value) * sessions;
    existing.screen_page_views = numberValue(existing.screen_page_views) + numberValue(metrics[5]?.value);
    existing.key_events = numberValue(existing.key_events) + numberValue(metrics[6]?.value);
    groups.set(rowKey, existing);
  }

  const rows = [...groups.values()].map((value) => {
    const sessions = numberValue(value.sessions);
    const result: JsonRecord = { ...value };
    result.engagement_rate = round(sessions > 0 ? numberValue(value.engaged_sessions) / sessions : 0, 6);
    result.bounce_rate = round(sessions > 0 ? Math.max(0, 1 - Number(result.engagement_rate)) : 0, 6);
    result.average_session_duration = round(sessions > 0 ? value._duration_seconds / sessions : 0, 2);
    delete result._duration_seconds;
    return result;
  });
  return rows.length ? rows : [{ _empty: true }];
}

export function runTransform(action: unknown, payloadValue: unknown): JsonRecord {
  const payload = asRecord(payloadValue);
  switch (action) {
    case 'date-window': return { item: buildDateWindow(payload.kind) };
    case 'meta-campaign-rows': return { items: metaCampaignRows(payload.chunks) };
    case 'flatten-meta-rows': return { items: flattenMetaRows(payload.chunks) };
    case 'unique-ad-ids': return { items: uniqueAdIds(payload.rows) };
    case 'merge-ad-creatives': return { items: mergeAdCreatives(payload.creatives, payload.performance) };
    case 'unique-image-hashes': return { items: uniqueImageHashes(payload.rows) };
    case 'inject-image-urls': return { items: injectImageUrls(payload.imageResponses, payload.rows) };
    case 'unique-video-ids': return { items: uniqueVideoIds(payload.rows) };
    case 'inject-video-urls': return { items: injectVideoUrls(payload.videoResponses, payload.rows) };
    case 'ga4-request': return { item: buildGa4Request(payload.window) };
    case 'normalize-ga4': return { items: normalizeGa4(payload.response, payload.propertyId) };
    default: throw new Error('Unsupported transform action');
  }
}
