export type VideoMetrics = { spend: number | null; impressions: number | null; views: number | null; thruplays: number | null; completeViews: number | null };
export type SocialMetrics = { followersStart: number | null; followersEnd: number | null; reach: number | null; engagements: number | null; impressions: number | null; mediaViews: number | null };
export type VideoRow = { id: string; platform: 'Google Ads' | 'Meta' | 'LinkedIn'; label: string; spendScope: 'placement' | 'campaign' | 'unavailable'; viewDefinition: string; source: string; current: VideoMetrics | null; previous: VideoMetrics | null };
export type SocialRow = { id: string; platform: 'Facebook' | 'Instagram' | 'LinkedIn'; brand: 'Bridgeport' | 'Polaris'; boostedIncluded: boolean | null; source: string; current: SocialMetrics | null; previous: SocialMetrics | null };
export type MediaSnapshot = { extractedAt: string; periods: { start: string; end: string; compStart: string; compEnd: string }; videos: VideoRow[]; social: SocialRow[]; notes: string[] };
export const followerGrowth = (m: Pick<SocialMetrics, 'followersStart' | 'followersEnd'>): number | null => m.followersStart === null || m.followersEnd === null ? null : m.followersEnd - m.followersStart;
/** Validate server-only reporting configuration, then project only authorized report fields. */
export function parseMediaSnapshot(raw: string): MediaSnapshot {
  const invalid = (): never => { throw new Error('Invalid NSI YTD media snapshot'); };
  const record = (v: unknown): Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : invalid();
  const text = (v: unknown): string => typeof v === 'string' && v.trim().length > 0 && v.length <= 800 ? v : invalid();
  const number = (v: unknown, count: boolean): number | null => v === null ? null : typeof v === 'number' && Number.isFinite(v) && v >= 0 && (!count || Number.isSafeInteger(v)) ? v : invalid();
  const array = (v: unknown): unknown[] => Array.isArray(v) && v.length <= 100 ? v : invalid();
  let decoded: unknown; try { decoded = JSON.parse(raw); } catch { return invalid(); }
  const root = record(decoded); const periods = record(root.periods);
  if (periods.start !== '2026-01-01' || periods.end !== '2026-10-31' || periods.compStart !== '2025-01-01' || periods.compEnd !== '2025-10-31') return invalid();
  const extractedAt = text(root.extractedAt); if (!Number.isFinite(Date.parse(extractedAt))) return invalid();
  const readVideo = (v: unknown): VideoMetrics | null => { if (v === null) return null; const x = record(v); return { spend: number(x.spend, false), impressions: number(x.impressions, true), views: number(x.views, true), thruplays: number(x.thruplays, true), completeViews: number(x.completeViews, true) }; };
  const readSocial = (v: unknown): SocialMetrics | null => { if (v === null) return null; const x = record(v); return { followersStart: number(x.followersStart, true), followersEnd: number(x.followersEnd, true), reach: number(x.reach, true), engagements: number(x.engagements, true), impressions: number(x.impressions, true), mediaViews: number(x.mediaViews, true) }; };
  const ids = new Set<string>(); const id = (v: unknown) => { const s = text(v); if (ids.has(s)) return invalid(); ids.add(s); return s; };
  const videos = array(root.videos).map(v => {
    const x = record(v); if (!['Google Ads', 'Meta', 'LinkedIn'].includes(String(x.platform)) || !['placement', 'campaign', 'unavailable'].includes(String(x.spendScope))) return invalid();
    const current = readVideo(x.current); const previous = readVideo(x.previous); if (!current && !previous) return invalid();
    if (x.spendScope === 'unavailable' && (current?.spend != null || previous?.spend != null)) return invalid();
    return { id: id(x.id), platform: x.platform as VideoRow['platform'], label: text(x.label), spendScope: x.spendScope as VideoRow['spendScope'], viewDefinition: text(x.viewDefinition), source: text(x.source), current, previous };
  });
  const social = array(root.social).map(v => {
    const x = record(v); if (!['Facebook', 'Instagram', 'LinkedIn'].includes(String(x.platform)) || !['Bridgeport', 'Polaris'].includes(String(x.brand)) || (x.boostedIncluded !== null && typeof x.boostedIncluded !== 'boolean')) return invalid();
    const current = readSocial(x.current); const previous = readSocial(x.previous); if (!current && !previous) return invalid();
    return { id: id(x.id), platform: x.platform as SocialRow['platform'], brand: x.brand as SocialRow['brand'], boostedIncluded: x.boostedIncluded as boolean | null, source: text(x.source), current, previous };
  });
  return { extractedAt, periods: { start: '2026-01-01', end: '2026-10-31', compStart: '2025-01-01', compEnd: '2025-10-31' }, videos, social, notes: array(root.notes).map(text) };
}
