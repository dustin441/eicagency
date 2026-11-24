export type VideoMetrics = { spend: number | null; impressions: number | null; views: number | null; thruplays: number | null; completeViews: number | null };
export type SocialMetrics = { followersStart: number | null; followersEnd: number | null; reach: number | null; engagements: number | null; impressions: number | null; mediaViews: number | null };
export type VideoRow = { id: string; platform: 'Google Ads' | 'Meta' | 'LinkedIn'; label: string; spendScope: 'placement' | 'campaign' | 'ad' | 'unavailable'; viewDefinition: string; source: string; current: VideoMetrics | null; previous: VideoMetrics | null };
export type PageActivity = { start: string; end: string; source: string; points: { date: string; netFollows: number }[]; interactions: number; views: number; impressions: number };
/** Relative flow tracking, never an opening or closing follower stock. */
export function summarizePageActivity(activity: PageActivity) {
  let total = 0;
  const monthly = new Map<string, number>();
  const points = activity.points.map(point => {
    total += point.netFollows;
    if (!Number.isSafeInteger(total)) throw new Error('Unsafe cumulative net follower change');
    const month = point.date.slice(0, 7);
    const sum = (monthly.get(month) ?? 0) + point.netFollows;
    if (!Number.isSafeInteger(sum)) throw new Error('Unsafe monthly net follower change');
    monthly.set(month, sum);
    return { ...point, cumulative: total };
  });
  return { baseline: 0, points, months: Array.from(monthly).map(([month, netFollows]) => ({ month, netFollows })), total };
}
export type SocialRow = { activity?: PageActivity; id: string; platform: 'Facebook' | 'Instagram' | 'LinkedIn'; brand: 'Bridgeport' | 'Polaris'; boostedIncluded: boolean | null; followersStartStatus?: 'not-launched'; source: string; current: SocialMetrics | null; previous: SocialMetrics | null };
export type MediaSnapshot = { extractedAt: string; periods: { start: string; end: string; compStart: string; compEnd: string }; videos: VideoRow[]; social: SocialRow[]; notes: string[] };
export type PresentedVideoRow = VideoRow & { deliveryScope: string };
/** Only the audited, mutually exclusive Google network subsets may be joined.
 * Views cover both subsets; available spend/impressions still cover YouTube only. */
export function consolidateVideoRows(rows: readonly VideoRow[]): PresentedVideoRow[] {
  const youtube = rows.filter(row => row.platform === 'Google Ads' && row.id === 'google-youtube' && row.spendScope === 'placement');
  const other = rows.filter(row => row.platform === 'Google Ads' && row.id === 'google-other-video' && row.spendScope === 'unavailable');
  const canCombine = youtube.length === 1 && other.length === 1;
  const combine = (period: 'current' | 'previous'): VideoMetrics | null => {
    const a = youtube[0][period], b = other[0][period];
    if (!a && !b) return null;
    return { spend: a?.spend ?? null, impressions: a?.impressions ?? null, views: a?.views == null || b?.views == null ? null : a.views + b.views, thruplays: null, completeViews: null };
  };
  return rows.flatMap(row => {
    if (canCombine && row === other[0]) return [];
    if (canCombine && row === youtube[0]) return [{ ...row, id: 'google-video-combined', label: 'YouTube + other Google video inventory', viewDefinition: 'Native Google TrueView views across disjoint networks', source: `${row.source} ${other[0].source}`, current: combine('current'), previous: combine('previous'), deliveryScope: 'Spend and impressions: YouTube only. Views: all reported Google video inventory.' }];
    return [{ ...row, deliveryScope: row.platform === 'Meta' && row.spendScope === 'ad' ? 'Ads with reported video plays; delivery can include mixed formats' : row.spendScope === 'placement' ? 'Placement delivery, already included in paid-media totals' : row.spendScope === 'campaign' ? 'Associated campaign delivery, not video-only' : 'Video-specific delivery not isolated' }];
  });
}
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
    const x = record(v); if (!['Google Ads', 'Meta', 'LinkedIn'].includes(String(x.platform)) || !['placement', 'campaign', 'ad', 'unavailable'].includes(String(x.spendScope))) return invalid();
    const current = readVideo(x.current); const previous = readVideo(x.previous); if (!current && !previous) return invalid();
    if (x.spendScope === 'unavailable' && (current?.spend != null || previous?.spend != null)) return invalid();
    return { id: id(x.id), platform: x.platform as VideoRow['platform'], label: text(x.label), spendScope: x.spendScope as VideoRow['spendScope'], viewDefinition: text(x.viewDefinition), source: text(x.source), current, previous };
  });
  const social = array(root.social).map(v => {
    const x = record(v); if (!['Facebook', 'Instagram', 'LinkedIn'].includes(String(x.platform)) || !['Bridgeport', 'Polaris'].includes(String(x.brand)) || (x.boostedIncluded !== null && typeof x.boostedIncluded !== 'boolean')) return invalid();
    const current = readSocial(x.current); const previous = readSocial(x.previous); if (!current && !previous) return invalid();
    const followersStartStatus = x.followersStartStatus;
    if (followersStartStatus !== undefined && followersStartStatus !== 'not-launched') return invalid();
    // This row-level qualification describes the current January boundary only.
    if (followersStartStatus === 'not-launched' && (!current || current.followersStart !== null)) return invalid();
    let activity: PageActivity | undefined;
    if (x.activity !== undefined) {
      const a = record(x.activity);
      if (!current || current.followersStart !== null || current.followersEnd !== null || a.start !== periods.start || a.end !== periods.end || !Array.isArray(a.points) || a.points.length !== 304) return invalid();
      const points = a.points.map((value: unknown, index: number) => {
        const p = record(value);
        const expected = new Date(Date.UTC(2026, 0, index + 1)).toISOString().slice(0, 10);
        if (p.date !== expected || typeof p.netFollows !== 'number' || !Number.isSafeInteger(p.netFollows)) return invalid();
        return { date: expected, netFollows: p.netFollows };
      });
      const count = (v: unknown): number => { const n = number(v, true); return n === null ? invalid() : n; };
      activity = { start: '2026-01-01', end: '2026-10-31', source: text(a.source), points, interactions: count(a.interactions), views: count(a.views), impressions: count(a.impressions) };
      try { summarizePageActivity(activity); } catch { return invalid(); }
    }
    return { ...(activity ? { activity } : {}), id: id(x.id), platform: x.platform as SocialRow['platform'], brand: x.brand as SocialRow['brand'], boostedIncluded: x.boostedIncluded as boolean | null, ...(followersStartStatus === 'not-launched' ? { followersStartStatus: 'not-launched' as const } : {}), source: text(x.source), current, previous };
  });
  return { extractedAt, periods: { start: '2026-01-01', end: '2026-10-31', compStart: '2025-01-01', compEnd: '2025-10-31' }, videos, social, notes: array(root.notes).map(text) };
}
