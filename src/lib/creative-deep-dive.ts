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

    if (!existing.videoUrl && ad.videoUrl) {
      existing.isVideo = true;
      existing.videoId = ad.videoId;
      existing.videoUrl = ad.videoUrl;
      existing.finalCreativeLink = ad.finalCreativeLink || existing.finalCreativeLink;
      existing.permanentImageUrl = ad.permanentImageUrl || existing.permanentImageUrl;
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

export function findCreativeReference(
  reference: CreativeReference,
  candidates: CreativeDeepDiveLeader[],
): CreativeDeepDiveLeader | null {
  const requestedId = String(reference.referenceCreativeId ?? '').trim();
  if (requestedId) {
    const idMatches = candidates.filter((candidate) => String(candidate.id) === requestedId);
    return idMatches.length === 1 ? idMatches[0] : null;
  }

  const requestedName = normalizeCreativeReference(reference.referenceCreativeName ?? '');
  if (!requestedName) return null;
  const nameMatches = candidates.filter((candidate) =>
    [candidate.platformName, candidate.name, candidate.headline]
      .some((value) => normalizeCreativeReference(value ?? '') === requestedName));
  return nameMatches.length === 1 ? nameMatches[0] : null;
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

export function isLowResolutionMetaThumbnail(value: string): boolean {
  return /(?:^|[_?&])p(?:32|40|48|64|80|96)x(?:32|40|48|64|80|96)(?:_|[&]|$)/i.test(value);
}

export function metaPreviewKind(
  imageUrl: string,
  videoUrl: string,
  isVideo: boolean,
): 'image' | 'video' | 'catalog' {
  if (videoUrl) return 'video';
  if (isLowResolutionMetaThumbnail(imageUrl)) return 'catalog';
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
