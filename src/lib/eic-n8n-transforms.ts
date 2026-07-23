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

function sqlQuote(value: unknown): string {
  return `'${String(value ?? '').replace(/'/g, "''")}'`;
}

function sqlJson(value: unknown): string {
  return `${sqlQuote(JSON.stringify(value ?? null))}::jsonb`;
}

export function collectVisionVideoIds(adsValue: unknown): JsonRecord[] {
  const ids = new Set<string>();
  for (const ad of asRecords(adsValue)) {
    if (ad.is_video && ad.video_id) ids.add(String(ad.video_id));
  }
  return ids.size ? [...ids].map((videoId) => ({ video_id: videoId })) : [{ video_id: '0', _placeholder: true }];
}

const VISION_SYSTEM = 'You are a senior paid-social creative strategist analyzing ONE lead-generation client (EIC Agency). You can SEE actual ad creatives plus 30-day spend, leads, CPL, and CTR. Optimize for lead volume and CPL efficiency while adding a creative-director strategy layer. Refer to each ad only by its exact name in double quotes. Respond with ONLY a valid minified JSON object with keys: brand, summary, video_vs_image, what_works, improvements, next_tests, brand_level_thesis, winning_concepts, message_patterns, image_patterns, video_patterns, creative_director_brief. Keep every recommendation concise, specific, and tied to performance evidence.';

function allowedImageHost(hostname: string): boolean {
  return ['.fbcdn.net', '.facebook.com', '.fbsbx.com', '.supabase.co']
    .some((suffix) => hostname === suffix.slice(1) || hostname.endsWith(suffix));
}

async function fetchImageBlock(urlValue: unknown): Promise<{ block: JsonRecord; bytes: number } | null> {
  let url: URL;
  try { url = new URL(String(urlValue || '')); } catch { return null; }
  if (url.protocol !== 'https:' || !allowedImageHost(url.hostname)) return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    let response: Response | null = null;
    for (let redirects = 0; redirects < 4; redirects += 1) {
      response = await fetch(url, { signal: controller.signal, redirect: 'manual' });
      if (response.status < 300 || response.status >= 400) break;
      const location = response.headers.get('location');
      if (!location) return null;
      url = new URL(location, url);
      if (url.protocol !== 'https:' || !allowedImageHost(url.hostname)) return null;
    }
    if (!response?.ok) return null;
    const contentType = String(response.headers.get('content-type') || '').split(';')[0].toLowerCase();
    if (!['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(contentType)) return null;
    const declaredSize = Number(response.headers.get('content-length') || 0);
    if (declaredSize > 750_000) return null;
    const bytes = Buffer.from(await response.arrayBuffer());
    if (!bytes.length || bytes.length > 750_000) return null;
    return { bytes: bytes.length, block: { type: 'image', source: { type: 'base64', media_type: contentType, data: bytes.toString('base64') } } };
  } catch { return null; } finally { clearTimeout(timeout); }
}

export async function buildVisionRequest(adsValue: unknown, thumbnailsValue: unknown): Promise<JsonRecord[]> {
  const brand = 'EIC Agency';
  const model = 'claude-sonnet-4-6';
  const today = new Date();
  const start = new Date(today);
  start.setUTCDate(start.getUTCDate() - 30);
  const periodStart = dateOnly(start);
  const periodEnd = dateOnly(today);
  const ads = asRecords(adsValue).sort((a, b) => Number(b.cost || 0) - Number(a.cost || 0));
  if (!ads.length) return [{ brand, period_start: periodStart, period_end: periodEnd, model, ads_analyzed: 0, has_data: false, top_ads: [] }];

  const thumbnailMap = new Map<string, string[]>();
  for (const thumbnail of asRecords(thumbnailsValue)) {
    const values = asRecords(asRecord(thumbnail.thumbnails).data).map((item) => String(item.uri || '')).filter(Boolean);
    if (!thumbnail.id || !values.length) continue;
    const picks = [values[0]];
    if (values.length > 2) picks.push(values[Math.floor(values.length / 2)]);
    thumbnailMap.set(String(thumbnail.id), picks);
  }

  const top = ads.slice(0, 8);
  const totalSpend = ads.reduce((sum, ad) => sum + Number(ad.cost || 0), 0);
  const totalLeads = ads.reduce((sum, ad) => sum + Number(ad.leads || 0), 0);
  const accountCpl = totalLeads > 0 ? (totalSpend / totalLeads).toFixed(2) : 'n/a';
  let intro = `CLIENT: ${brand}. Period: ${periodStart} to ${periodEnd}. Account spend $${Math.round(totalSpend)}, leads ${totalLeads}, CPL $${accountCpl}.\nTop Meta ads:\n`;
  for (const ad of top) {
    const ctr = Number(ad.impressions || 0) > 0 ? (100 * Number(ad.clicks || 0) / Number(ad.impressions)).toFixed(2) : '0';
    const leads = Number(ad.leads || 0);
    const cpl = leads > 0 ? (Number(ad.cost || 0) / leads).toFixed(2) : 'n/a';
    intro += `- "${String(ad.ad_name || '(unnamed)')}" ${ad.is_video ? 'VIDEO' : 'IMAGE'} | spend $${Math.round(Number(ad.cost || 0))} | leads ${leads} | CPL $${cpl} | CTR ${ctr}% | headline: ${String(ad.headline || '')}\n`;
  }

  const content: JsonRecord[] = [{ type: 'text', text: intro }];
  let imageBytes = 0;
  for (const ad of top) {
    let urls = ad.is_video ? thumbnailMap.get(String(ad.video_id || '')) || [] : [];
    if (!urls.length && ad.final_creative_link) urls = [String(ad.final_creative_link)];
    const blocks: JsonRecord[] = [];
    for (const imageUrl of urls.slice(0, 2)) {
      if (imageBytes >= 2_500_000) break;
      const image = await fetchImageBlock(imageUrl);
      if (image && imageBytes + image.bytes <= 2_500_000) { imageBytes += image.bytes; blocks.push(image.block); }
    }
    if (blocks.length) content.push({ type: 'text', text: `--- CREATIVE: "${String(ad.ad_name || '(unnamed)')}" ---` }, ...blocks);
  }

  const topAds = top.map((ad) => {
    const leads = Number(ad.leads || 0);
    return { ad_id: ad.ad_id, ad_name: ad.ad_name, is_video: Boolean(ad.is_video), spend: Math.round(Number(ad.cost || 0)), leads, cpl: leads > 0 ? Number((Number(ad.cost || 0) / leads).toFixed(2)) : 0, ctr: Number(ad.impressions || 0) > 0 ? Number((100 * Number(ad.clicks || 0) / Number(ad.impressions)).toFixed(2)) : 0, image: ad.final_creative_link || null };
  });
  return [{ brand, period_start: periodStart, period_end: periodEnd, model, ads_analyzed: top.length, has_data: true, top_ads: topAds, anthropicBody: { model, max_tokens: 8000, system: VISION_SYSTEM, messages: [{ role: 'user', content }] } }];
}

export function parseVisionInsights(responsesValue: unknown, buildsValue: unknown): JsonRecord[] {
  const builds = asRecords(buildsValue);
  const dataBuilds = builds.filter((build) => build.has_data);
  return asRecords(responsesValue).map((response, index) => {
    const text = asRecords(response.content).map((block) => String(block.text || '')).join('').trim().replace(/^```json/i, '').replace(/^```/, '').replace(/```$/, '').trim();
    let insight: JsonRecord;
    try { insight = asRecord(JSON.parse(text)); } catch { insight = { summary: 'AI response could not be parsed.', _raw: text }; }
    const brand = String(insight.brand || '');
    const meta = builds.find((build) => String(build.brand || '').toLowerCase() === brand.toLowerCase()) || dataBuilds[index] || dataBuilds[0] || builds[0] || {};
    const brief = asRecord(insight.creative_director_brief);
    const parts: string[] = [];
    if (insight.brand_level_thesis) parts.push(`Brand-level thesis: ${String(insight.brand_level_thesis)}`);
    if (brief.overall_direction) parts.push(`Overall direction: ${String(brief.overall_direction)}`);
    for (const [key, label] of [['concepts_to_develop', 'Concepts to develop'], ['copy_hooks_to_test', 'Copy hooks to test'], ['visuals_to_shoot', 'Visuals to shoot'], ['formats_to_prioritize', 'Formats to prioritize']] as const) {
      if (Array.isArray(brief[key]) && brief[key].length) parts.push(`${label}: ${brief[key].join('; ')}`);
    }
    const nextBrief = String(insight.next_creative_brief || parts.join('\n'));
    const columns = '(brand, as_of_date, period_start, period_end, model, ads_analyzed, has_data, summary, video_vs_image, what_works, improvements, next_creative_brief, next_tests, top_ads, raw)';
    const values = [sqlQuote(meta.brand || brand), 'current_date', sqlQuote(meta.period_start), sqlQuote(meta.period_end), sqlQuote(meta.model || 'claude-sonnet-4-6'), String(Number(meta.ads_analyzed || 0)), 'true', sqlQuote(insight.summary || ''), sqlQuote(insight.video_vs_image || ''), sqlJson(insight.what_works || []), sqlJson(insight.improvements || []), sqlQuote(nextBrief), sqlJson(insight.next_tests || []), sqlJson(meta.top_ads || []), sqlJson(insight)].join(', ');
    return { brand: meta.brand || brand, sql: `insert into public.eicagency_creative_ai_insights ${columns} values (${values}) on conflict (brand, as_of_date) do update set period_start=excluded.period_start, period_end=excluded.period_end, model=excluded.model, ads_analyzed=excluded.ads_analyzed, has_data=excluded.has_data, summary=excluded.summary, video_vs_image=excluded.video_vs_image, what_works=excluded.what_works, improvements=excluded.improvements, next_creative_brief=excluded.next_creative_brief, next_tests=excluded.next_tests, top_ads=excluded.top_ads, raw=excluded.raw, created_at=now();` };
  });
}

export function buildVisionNoDataRows(buildsValue: unknown): JsonRecord[] {
  return asRecords(buildsValue).map((meta) => {
    const values = [sqlQuote(meta.brand), 'current_date', sqlQuote(meta.period_start), sqlQuote(meta.period_end), sqlQuote(meta.model || 'claude-sonnet-4-6'), '0', 'false', sqlQuote('Insufficient ad spend in the last 30 days to analyze creatives for this client.'), "'[]'::jsonb", "'[]'::jsonb", "'[]'::jsonb"].join(', ');
    return { brand: meta.brand, sql: `insert into public.eicagency_creative_ai_insights (brand, as_of_date, period_start, period_end, model, ads_analyzed, has_data, summary, what_works, improvements, top_ads) values (${values}) on conflict (brand, as_of_date) do update set has_data=excluded.has_data, ads_analyzed=excluded.ads_analyzed, summary=excluded.summary, period_start=excluded.period_start, period_end=excluded.period_end, what_works=excluded.what_works, improvements=excluded.improvements, top_ads=excluded.top_ads, created_at=now();` };
  });
}

export async function runAsyncTransform(action: unknown, payloadValue: unknown): Promise<JsonRecord> {
  const payload = asRecord(payloadValue);
  switch (action) {
    case 'vision-collect-video-ids': return { items: collectVisionVideoIds(payload.ads) };
    case 'vision-build-request': return { items: await buildVisionRequest(payload.ads, payload.thumbnails) };
    case 'vision-parse-insight': return { items: parseVisionInsights(payload.responses, payload.builds) };
    case 'vision-no-data': return { items: buildVisionNoDataRows(payload.builds) };
    default: return runTransform(action, payloadValue);
  }
}

export function runTransform(action: unknown, payloadValue: unknown): JsonRecord {
  const payload = asRecord(payloadValue);
  switch (action) {
    case 'date-window': {
      const window = buildDateWindow(payload.kind);
      return { ...window, item: window };
    }
    case 'meta-campaign-rows': return { items: metaCampaignRows(payload.chunks) };
    case 'flatten-meta-rows': return { items: flattenMetaRows(payload.chunks) };
    case 'unique-ad-ids': return { items: uniqueAdIds(payload.rows) };
    case 'merge-ad-creatives': return { items: mergeAdCreatives(payload.creatives, payload.performance) };
    case 'unique-image-hashes': return { items: uniqueImageHashes(payload.rows) };
    case 'inject-image-urls': return { items: injectImageUrls(payload.imageResponses, payload.rows) };
    case 'unique-video-ids': return { items: uniqueVideoIds(payload.rows) };
    case 'inject-video-urls': return { items: injectVideoUrls(payload.videoResponses, payload.rows) };
    case 'ga4-request': {
      const request = buildGa4Request(payload.window);
      // Preserve the bridge item envelope for the no-Code workflow while also
      // exposing the legacy top-level fields consumed by the credentialed GA4
      // HTTP node. The n8n API key cannot rewrite that credential-owned node.
      return { ...request, item: request };
    }
    case 'normalize-ga4': return { items: normalizeGa4(payload.response, payload.propertyId) };
    default: throw new Error('Unsupported transform action');
  }
}
