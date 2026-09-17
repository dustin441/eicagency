export const INSTANTLY_MONTHLY_SEND_TARGET = 10_000;
export const INSTANTLY_REPLY_RATE_TARGET = 2;

export type InstantlyApiAnalytics = {
  campaign_name?: string;
  campaign_id?: string;
  campaign_status?: number;
  emails_sent_count?: number | string;
  contacted_count?: number | string;
  open_count_unique?: number | string;
  link_click_count_unique?: number | string;
  reply_count_unique?: number | string;
  reply_count_automatic_unique?: number | string;
  total_opportunities?: number | string;
};

export type InstantlyApiDailyAnalytics = {
  date?: string;
  sent?: number | string;
  contacted?: number | string;
  unique_opened?: number | string;
  unique_clicks?: number | string;
  unique_replies?: number | string;
  unique_replies_automatic?: number | string;
  unique_opportunities?: number | string;
};

export type InstantlyMetricSummary = {
  sends: number;
  contacts: number;
  opens: number;
  clicks: number;
  replies: number;
  positiveReplies: number;
  openRate: number;
  clickRate: number;
  replyRate: number;
  positiveReplyRate: number;
};

export type InstantlyCampaignPerformance = InstantlyMetricSummary & {
  campaignId: string;
  campaignName: string;
  campaignStatus: number | null;
};

export type InstantlyCampaignComparisonPerformance = InstantlyCampaignPerformance & {
  comparison: InstantlyMetricSummary;
};

export type InstantlyTrendPoint = Omit<InstantlyMetricSummary, 'openRate' | 'clickRate' | 'replyRate' | 'positiveReplyRate'> & {
  date: string;
  openRate: number | null;
  clickRate: number | null;
  replyRate: number | null;
  positiveReplyRate: number | null;
};

export type InstantlyMonthlyGoal = {
  monthStart: string;
  dataThrough: string;
  sendTarget: number;
  replyRateTarget: number;
  sends: number;
  replyRate: number;
  sendProgress: number;
  projectedSends: number;
};

export type EicInstantlyPerformance = {
  available: boolean;
  error: string | null;
  periodStart: string;
  periodEnd: string;
  comparisonStart: string;
  comparisonEnd: string;
  summary: InstantlyMetricSummary;
  comparisonSummary: InstantlyMetricSummary;
  campaigns: InstantlyCampaignComparisonPerformance[];
  trend: InstantlyTrendPoint[];
  monthlyGoal: InstantlyMonthlyGoal;
};

export const EMPTY_INSTANTLY_SUMMARY: InstantlyMetricSummary = {
  sends: 0,
  contacts: 0,
  opens: 0,
  clicks: 0,
  replies: 0,
  positiveReplies: 0,
  openRate: 0,
  clickRate: 0,
  replyRate: 0,
  positiveReplyRate: 0,
};

function numeric(value: number | string | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function rate(numerator: number, denominator: number): number {
  return denominator > 0 ? (numerator / denominator) * 100 : 0;
}

export function normalizeInstantlySummary(row: InstantlyApiAnalytics = {}): InstantlyMetricSummary {
  const sends = numeric(row.emails_sent_count);
  const contacts = numeric(row.contacted_count);
  const opens = numeric(row.open_count_unique);
  const clicks = numeric(row.link_click_count_unique);
  // Instantly documents reply_count_unique as excluding automatic replies.
  const replies = numeric(row.reply_count_unique);
  const positiveReplies = numeric(row.total_opportunities);

  return {
    sends,
    contacts,
    opens,
    clicks,
    replies,
    positiveReplies,
    openRate: rate(opens, contacts),
    clickRate: rate(clicks, contacts),
    replyRate: rate(replies, contacts),
    positiveReplyRate: rate(positiveReplies, contacts),
  };
}

export function normalizeInstantlyCampaigns(rows: InstantlyApiAnalytics[]): InstantlyCampaignPerformance[] {
  return rows
    .map((row): InstantlyCampaignPerformance => ({
      campaignId: String(row.campaign_id ?? '').trim(),
      campaignName: String(row.campaign_name ?? '').trim() || 'Unnamed campaign',
      campaignStatus: row.campaign_status == null ? null : numeric(row.campaign_status),
      ...normalizeInstantlySummary(row),
    }))
    .filter(row => row.sends > 0)
    .sort((a, b) => b.sends - a.sends || a.campaignName.localeCompare(b.campaignName));
}

export function mergeInstantlyCampaignComparisons(
  current: InstantlyCampaignPerformance[],
  previous: InstantlyCampaignPerformance[]
): InstantlyCampaignComparisonPerformance[] {
  const currentById = new Map(current.map(row => [row.campaignId, row]));
  const previousById = new Map(previous.map(row => [row.campaignId, row]));
  const ids = new Set([...Array.from(currentById.keys()), ...Array.from(previousById.keys())]);

  return Array.from(ids)
    .map((campaignId): InstantlyCampaignComparisonPerformance => {
      const currentRow = currentById.get(campaignId);
      const previousRow = previousById.get(campaignId);
      const identity = currentRow ?? previousRow!;
      return {
        campaignId,
        campaignName: identity.campaignName,
        campaignStatus: currentRow?.campaignStatus ?? previousRow?.campaignStatus ?? null,
        ...(currentRow ?? EMPTY_INSTANTLY_SUMMARY),
        comparison: previousRow ?? { ...EMPTY_INSTANTLY_SUMMARY },
      };
    })
    .sort((a, b) => b.sends - a.sends || b.comparison.sends - a.comparison.sends || a.campaignName.localeCompare(b.campaignName));
}

export function normalizeInstantlyTrend(
  rows: InstantlyApiDailyAnalytics[],
  start: string,
  end: string
): InstantlyTrendPoint[] {
  const byDate = new Map(rows.map(row => [String(row.date ?? '').trim(), row]));
  const points: InstantlyTrendPoint[] = [];
  const cursor = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);

  while (Number.isFinite(cursor.getTime()) && cursor <= last) {
      const date = cursor.toISOString().slice(0, 10);
      const row = byDate.get(date) ?? {};
      const contacts = numeric(row.contacted);
      const opens = numeric(row.unique_opened);
      const clicks = numeric(row.unique_clicks);
      // Instantly's daily unique_replies field is also human-only.
      const replies = numeric(row.unique_replies);
      const positiveReplies = numeric(row.unique_opportunities);
      points.push({
        date,
        sends: numeric(row.sent),
        contacts,
        opens,
        clicks,
        replies,
        positiveReplies,
        openRate: contacts > 0 ? rate(opens, contacts) : null,
        clickRate: contacts > 0 ? rate(clicks, contacts) : null,
        replyRate: contacts > 0 ? rate(replies, contacts) : null,
        positiveReplyRate: contacts > 0 ? rate(positiveReplies, contacts) : null,
      });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return points;
}

export function bucketInstantlyTrendByWeek(points: InstantlyTrendPoint[]): InstantlyTrendPoint[] {
  const weeks = new Map<string, Omit<InstantlyTrendPoint, 'date' | 'openRate' | 'clickRate' | 'replyRate' | 'positiveReplyRate'>>();

  for (const point of points) {
    const date = new Date(`${point.date}T00:00:00Z`);
    const day = date.getUTCDay();
    date.setUTCDate(date.getUTCDate() + (day === 0 ? -6 : 1 - day));
    const weekStart = date.toISOString().slice(0, 10);
    const current = weeks.get(weekStart) ?? {
      sends: 0,
      contacts: 0,
      opens: 0,
      clicks: 0,
      replies: 0,
      positiveReplies: 0,
    };
    current.sends += point.sends;
    current.contacts += point.contacts;
    current.opens += point.opens;
    current.clicks += point.clicks;
    current.replies += point.replies;
    current.positiveReplies += point.positiveReplies;
    weeks.set(weekStart, current);
  }

  return Array.from(weeks.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, totals]) => ({
      date,
      ...totals,
      openRate: totals.contacts > 0 ? rate(totals.opens, totals.contacts) : null,
      clickRate: totals.contacts > 0 ? rate(totals.clicks, totals.contacts) : null,
      replyRate: totals.contacts > 0 ? rate(totals.replies, totals.contacts) : null,
      positiveReplyRate: totals.contacts > 0 ? rate(totals.positiveReplies, totals.contacts) : null,
    }));
}

export function utcMonthStart(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-01`;
}

export function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function buildInstantlyMonthlyGoal(summary: InstantlyMetricSummary, now: Date): InstantlyMonthlyGoal {
  const monthStart = utcMonthStart(now);
  const monthStartMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
  const nextMonthMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1);
  const elapsedDays = Math.max((now.getTime() - monthStartMs) / 86_400_000, 1 / 24);
  const daysThisMonth = (nextMonthMs - monthStartMs) / 86_400_000;

  return {
    monthStart,
    dataThrough: isoDate(now),
    sendTarget: INSTANTLY_MONTHLY_SEND_TARGET,
    replyRateTarget: INSTANTLY_REPLY_RATE_TARGET,
    sends: summary.sends,
    replyRate: summary.replyRate,
    sendProgress: rate(summary.sends, INSTANTLY_MONTHLY_SEND_TARGET),
    projectedSends: (summary.sends / elapsedDays) * daysThisMonth,
  };
}
