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
  total_opportunities?: number | string;
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
  summary: InstantlyMetricSummary;
  campaigns: InstantlyCampaignPerformance[];
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
