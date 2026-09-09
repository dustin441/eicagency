export type CreativeObjective = 'sales' | 'leads' | 'traffic' | 'engagement' | 'volume';

export type CreativeDeepDiveLeader = {
  id: string;
  name: string;
  platformName?: string;
  imageUrl?: string;
  primaryText?: string;
  headline?: string;
  destinationUrl?: string;
  videoUrl?: string;
  externalPreviewUrl?: string;
  previewKind?: 'image' | 'video' | 'search' | 'text' | 'catalog';
  lowResolutionPreview?: boolean;
  validateImageDimensions?: boolean;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  revenue?: number;
  engagements?: number;
  referenceOnly?: boolean;
};

export type CreativeReference = {
  referenceCreativeId?: string;
  referenceCreativeName?: string;
};

type MetaCreativeIdentityShape = {
  name: string;
  campaign: string;
  adset: string;
  headline: string;
  primaryText: string;
  finalCreativeLink: string;
  destinationUrl: string;
  ctaType: string;
  isVideo: boolean;
  videoId: string;
  videoUrl: string;
  previewUrl?: string;
  permanentImageUrl?: string;
  isCatalog?: boolean;
  adId?: string;
  spend: number;
  leads: number;
  clicks: number;
  impressions: number;
  sales?: number;
  revenue?: number;
  mqls?: number;
  sqls?: number;
  won?: number;
};

export function hasImmutableMetaCreativeId<T extends { adId?: string }>(creative: T): creative is T & { adId: string } {
  return Boolean(String(creative.adId ?? '').trim());
}

/** Reconcile repeated rows for one immutable ad without merging same-named ads. */
export function aggregateMetaCreativesByIdentity<T extends MetaCreativeIdentityShape>(creatives: T[]): T[] {
  const hasMedia = (value?: string) => Boolean(value && value !== 'null' && value !== 'undefined');
  const byIdentity = new Map<string, T>();

  for (const ad of [...creatives].sort((a, b) => b.spend - a.spend)) {
    const adId = String(ad.adId ?? '').trim();
    const fallbackMedia = ad.videoId || ad.videoUrl || ad.permanentImageUrl || ad.finalCreativeLink;
    const key = adId
      ? `id:${adId}`
      : `media:${ad.name.trim().toLowerCase()}|${fallbackMedia || `${ad.campaign}|${ad.adset}`}`;
    const existing = byIdentity.get(key);
    if (!existing) {
      byIdentity.set(key, { ...ad });
      continue;
    }

    existing.impressions += ad.impressions;
    existing.clicks += ad.clicks;
    existing.spend += ad.spend;
    existing.leads += ad.leads;
    existing.sales = (existing.sales ?? 0) + (ad.sales ?? 0);
    existing.revenue = (existing.revenue ?? 0) + (ad.revenue ?? 0);
    existing.mqls = (existing.mqls ?? 0) + (ad.mqls ?? 0);
    existing.sqls = (existing.sqls ?? 0) + (ad.sqls ?? 0);
    existing.won = (existing.won ?? 0) + (ad.won ?? 0);
    existing.isCatalog = isConfirmedMetaCatalogCreative(existing) || isConfirmedMetaCatalogCreative(ad);

    if (!existing.videoUrl && ad.videoUrl) {
      existing.isVideo = true;
      existing.videoId = ad.videoId;
      existing.videoUrl = ad.videoUrl;
      existing.finalCreativeLink = ad.finalCreativeLink || existing.finalCreativeLink;
      existing.permanentImageUrl = ad.permanentImageUrl || existing.permanentImageUrl;
      existing.previewUrl = ad.previewUrl || existing.previewUrl;
    } else if (shouldReplaceMetaImage(existing, ad)) {
      existing.permanentImageUrl = ad.permanentImageUrl;
      existing.finalCreativeLink = ad.finalCreativeLink;
      existing.previewUrl = ad.previewUrl || existing.previewUrl;
    } else if (!hasMedia(existing.permanentImageUrl) && hasMedia(ad.permanentImageUrl)) {
      existing.permanentImageUrl = ad.permanentImageUrl;
    } else if (!hasMedia(existing.finalCreativeLink) && hasMedia(ad.finalCreativeLink)) {
      existing.finalCreativeLink = ad.finalCreativeLink;
    }
    existing.previewUrl ||= ad.previewUrl;
    existing.headline ||= ad.headline;
    existing.primaryText ||= ad.primaryText;
    existing.destinationUrl ||= ad.destinationUrl;
    existing.ctaType ||= ad.ctaType;
  }

  return Array.from(byIdentity.values()).sort((a, b) => b.spend - a.spend);
}

function normalizeCreativeReference(value: string): string {
  return value
    .normalize('NFC')
    .toLowerCase()
    .replace(/[\u2018\u2019\u201A\u201B\u02BC]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
    .replace(/^["']+|["']+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// When several ads share the referenced name (the same creative launched in
// multiple ad sets/campaigns is the norm — e.g. PrePass "Have All Bypass" runs
// under 5 ad IDs), pick the one with a usable preview and the most spend
// instead of failing closed. Failing closed hid the reference thumbnail for
// almost every name-referenced test across PrePass, Duro Dyne, Champagne, etc.
function pickBestCreativeReference(matches: CreativeDeepDiveLeader[]): CreativeDeepDiveLeader | null {
  if (!matches.length) return null;
  const hasPreview = (candidate: CreativeDeepDiveLeader) => Boolean(candidate.videoUrl || candidate.imageUrl);
  return [...matches].sort((a, b) =>
    Number(hasPreview(b)) - Number(hasPreview(a)) || b.spend - a.spend)[0];
}

export function findCreativeReference(
  reference: CreativeReference,
  candidates: CreativeDeepDiveLeader[],
): CreativeDeepDiveLeader | null {
  const requestedId = String(reference.referenceCreativeId ?? '').trim();
  if (requestedId) {
    const idMatches = candidates.filter((candidate) => String(candidate.id) === requestedId);
    if (idMatches.length) return pickBestCreativeReference(idMatches);
    // The referenced ad ID may fall outside the selected dashboard window —
    // fall through to the exact-name match rather than dropping the reference.
  }

  const requestedName = normalizeCreativeReference(reference.referenceCreativeName ?? '');
  if (!requestedName) return null;
  const nameMatches = candidates.filter((candidate) =>
    [candidate.platformName, candidate.name, candidate.headline]
      .some((value) => normalizeCreativeReference(value ?? '') === requestedName));
  return pickBestCreativeReference(nameMatches);
}

export function mergeCreativeReferencesById(candidates: CreativeDeepDiveLeader[]): CreativeDeepDiveLeader[] {
  const byId = new Map<string, CreativeDeepDiveLeader>();
  for (const candidate of candidates) {
    const id = String(candidate.id).trim();
    if (!id) continue;
    const existing = byId.get(id);
    if (!existing) {
      byId.set(id, { ...candidate });
      continue;
    }

    existing.spend += candidate.spend;
    existing.impressions += candidate.impressions;
    existing.clicks += candidate.clicks;
    existing.conversions += candidate.conversions;
    existing.revenue = (existing.revenue ?? 0) + (candidate.revenue ?? 0);
    existing.engagements = (existing.engagements ?? 0) + (candidate.engagements ?? 0);

    const candidateHasPlayableVideo = Boolean(candidate.videoUrl);
    const existingHasPlayableVideo = Boolean(existing.videoUrl);
    if (candidateHasPlayableVideo && !existingHasPlayableVideo) {
      existing.imageUrl = candidate.imageUrl;
      existing.videoUrl = candidate.videoUrl;
      existing.externalPreviewUrl = candidate.externalPreviewUrl;
      existing.previewKind = 'video';
      existing.lowResolutionPreview = candidate.lowResolutionPreview;
    } else if (!existingHasPlayableVideo && candidate.previewKind === 'catalog') {
      existing.previewKind = 'catalog';
      existing.lowResolutionPreview = candidate.lowResolutionPreview;
    } else if (!existing.imageUrl && candidate.imageUrl) {
      existing.imageUrl = candidate.imageUrl;
      existing.lowResolutionPreview = candidate.lowResolutionPreview;
    }
    existing.externalPreviewUrl ||= candidate.externalPreviewUrl;
    existing.primaryText ||= candidate.primaryText;
    existing.headline ||= candidate.headline;
    existing.destinationUrl ||= candidate.destinationUrl;
  }
  return Array.from(byId.values());
}

export function youtubeEmbedUrlFromThumbnail(value: string): string {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || !['img.youtube.com', 'i.ytimg.com'].includes(url.hostname)) return '';
    const match = url.pathname.match(/^\/(?:vi|vi_webp)\/([A-Za-z0-9_-]{6,})\//);
    return match?.[1] ? `https://www.youtube.com/embed/${match[1]}` : '';
  } catch {
    return '';
  }
}

export function isTrustedYoutubeEmbedUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:'
      && ['www.youtube.com', 'youtube.com'].includes(url.hostname)
      && /^\/embed\/[A-Za-z0-9_-]{6,}$/.test(url.pathname)
      && !url.username
      && !url.password;
  } catch {
    return false;
  }
}

export type MetaImageSource = 'permanent' | 'final' | 'local' | 'unknown';

type MetaImageFields = {
  permanentImageUrl?: string | null;
  finalCreativeLink?: string | null;
};

const EMPTY_MEDIA_VALUES = new Set(['', 'null', 'undefined']);
const META_CDN_HOST = /(^|\.)((scontent[^.]*|lookaside)\.fna\.fbcdn\.net|fbcdn\.net)$/i;

export function hasUsableMetaImageUrl(value?: string | null): value is string {
  const normalized = String(value ?? '').trim();
  if (EMPTY_MEDIA_VALUES.has(normalized.toLowerCase())) return false;
  if (normalized.startsWith('/')) return true;
  try {
    const url = new URL(normalized);
    return (url.protocol === 'https:' || url.protocol === 'http:') && !url.username && !url.password;
  } catch {
    return false;
  }
}

/** Detect explicit Meta transform dimensions such as p64x64 or p160x120. */
export function metaThumbnailDimensions(value?: string | null): { width: number; height: number } | null {
  if (!hasUsableMetaImageUrl(value)) return null;
  const match = value.match(/(?:^|[_?&])p(\d{2,4})x(\d{2,4})(?:_|[&]|$)/i);
  if (!match) return null;
  return { width: Number(match[1]), height: Number(match[2]) };
}

export function isLowResolutionMetaThumbnail(value: string): boolean {
  const dimensions = metaThumbnailDimensions(value);
  if (!dimensions) return false;
  return Math.max(dimensions.width, dimensions.height) < 320 || Math.min(dimensions.width, dimensions.height) < 180;
}

export function isRenderableMetaImageDimensions(width: number, height: number): boolean {
  return Math.max(width, height) >= 600 && Math.min(width, height) >= 315;
}

function isStableFirstPartyUrl(value: string): boolean {
  if (value.startsWith('/')) return true;
  try {
    const url = new URL(value);
    return url.hostname.endsWith('.supabase.co')
      || url.pathname.includes('/storage/v1/object/public/meta-creative-previews/');
  } catch {
    return false;
  }
}

function isMetaCdnUrl(value: string): boolean {
  try {
    return META_CDN_HOST.test(new URL(value).hostname);
  } catch {
    return false;
  }
}

/** Stable validated assets outrank signed CDN links; tiny transforms rank last. */
export function metaImageUrlScore(value?: string | null, source: MetaImageSource = 'unknown'): number {
  if (!hasUsableMetaImageUrl(value)) return Number.NEGATIVE_INFINITY;
  let score = 100;
  if (source === 'permanent') score += 300;
  if (source === 'local') score += 250;
  if (isStableFirstPartyUrl(value)) score += 200;
  if (isMetaCdnUrl(value)) score -= 25;
  if (isLowResolutionMetaThumbnail(value)) score -= 1_000;
  return score;
}

export function resolveMetaImageUrl(fields: MetaImageFields): string {
  // Low-resolution thumbnails (e.g. Meta's p64x64 transform) are scored last
  // via metaImageUrlScore, not excluded outright — many ads genuinely have no
  // better asset available via the API (boosted posts, some Dynamic Creative
  // formats), and showing that thumbnail is preferable to showing nothing.
  const candidates = [
    { value: fields.permanentImageUrl, source: 'permanent' as const },
    { value: fields.finalCreativeLink, source: 'final' as const },
  ].filter((candidate) => hasUsableMetaImageUrl(candidate.value));
  candidates.sort((a, b) => metaImageUrlScore(b.value, b.source) - metaImageUrlScore(a.value, a.source));
  return String(candidates[0]?.value ?? '');
}

export function shouldReplaceMetaImage(current: MetaImageFields, candidate: MetaImageFields): boolean {
  const currentUrl = resolveMetaImageUrl(current);
  const candidateUrl = resolveMetaImageUrl(candidate);
  const sourceFor = (fields: MetaImageFields, value: string): MetaImageSource =>
    value && value === fields.permanentImageUrl ? 'permanent' : 'final';
  return metaImageUrlScore(candidateUrl, sourceFor(candidate, candidateUrl))
    > metaImageUrlScore(currentUrl, sourceFor(current, currentUrl));
}

type MetaCatalogEvidence = {
  isCatalog?: boolean;
  headline?: string;
  primaryText?: string;
};

/** Catalog semantics require source metadata or an unresolved dynamic-product template. */
export function isConfirmedMetaCatalogCreative(creative: MetaCatalogEvidence): boolean {
  if (creative.isCatalog === true) return true;
  return /\{\{\s*product\.[^}]+\}\}/i.test(`${creative.headline ?? ''}\n${creative.primaryText ?? ''}`);
}

export function metaPreviewKind(
  imageUrl: string,
  videoUrl: string,
  isVideo: boolean,
  isCatalog = false,
): 'image' | 'video' | 'catalog' {
  if (videoUrl) return 'video';
  if (isCatalog) return 'catalog';
  return isVideo ? 'video' : 'image';
}

function ctr(leader: CreativeDeepDiveLeader): number {
  return leader.impressions > 0 ? leader.clicks / leader.impressions : 0;
}

function costPerConversion(leader: CreativeDeepDiveLeader): number {
  return leader.conversions > 0 ? leader.spend / leader.conversions : Number.POSITIVE_INFINITY;
}

function roas(leader: CreativeDeepDiveLeader): number {
  return leader.spend > 0 ? (leader.revenue ?? 0) / leader.spend : 0;
}

function costPerEngagement(leader: CreativeDeepDiveLeader): number {
  return (leader.engagements ?? 0) > 0
    ? leader.spend / (leader.engagements ?? 1)
    : Number.POSITIVE_INFINITY;
}

export function selectCreativeLeaders(
  candidates: CreativeDeepDiveLeader[],
  objective: CreativeObjective,
  limit = 3,
): CreativeDeepDiveLeader[] {
  const totalSpend = candidates.reduce((sum, leader) => sum + leader.spend, 0);
  const totalConversions = candidates.reduce((sum, leader) => sum + leader.conversions, 0);
  const totalEngagements = candidates.reduce((sum, leader) => sum + (leader.engagements ?? 0), 0);
  const matureConversionSpend = totalConversions > 0 ? (totalSpend / totalConversions) * 2 : Number.POSITIVE_INFINITY;
  const matureEngagementSpend = totalEngagements > 0 ? (totalSpend / totalEngagements) * 2 : Number.POSITIVE_INFINITY;

  const eligible = candidates.filter((leader) => {
    if (leader.referenceOnly) return false;
    if (objective === 'traffic') {
      return leader.clicks > 0 && (leader.impressions >= 1_000 || leader.clicks >= 20);
    }
    if (objective === 'engagement') {
      return (leader.engagements ?? 0) >= 10
        || ((leader.engagements ?? 0) > 0 && leader.spend >= matureEngagementSpend);
    }
    return leader.conversions >= 3
      || (leader.conversions > 0 && leader.spend >= matureConversionSpend);
  });

  return [...eligible]
    .sort((a, b) => {
      if (objective === 'sales') {
        return roas(b) - roas(a) || b.conversions - a.conversions || b.spend - a.spend;
      }
      if (objective === 'leads') {
        return costPerConversion(a) - costPerConversion(b) || b.conversions - a.conversions || b.spend - a.spend;
      }
      if (objective === 'volume') {
        return b.conversions - a.conversions || costPerConversion(a) - costPerConversion(b) || b.spend - a.spend;
      }
      if (objective === 'engagement') {
        return costPerEngagement(a) - costPerEngagement(b)
          || (b.engagements ?? 0) - (a.engagements ?? 0)
          || b.spend - a.spend;
      }
      return ctr(b) - ctr(a) || b.clicks - a.clicks || b.spend - a.spend;
    })
    .slice(0, limit);
}
