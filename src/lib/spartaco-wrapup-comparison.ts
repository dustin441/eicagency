export type WrapupCampaignComparisonMode = 'lift' | 'share';

export type WrapupMetricComparison = {
  campaignMode: WrapupCampaignComparisonMode;
  campaignValue: number | null;
  afterChange: number | null;
};

/**
 * Builds the two stakeholder-facing comparisons for a wrap-up metric.
 *
 * A percentage lift from a zero baseline is undefined. When the before
 * period is zero, use the campaign period's share of all activity observed
 * across the before, during, and after windows instead of inventing a lift.
 */
export function buildWrapupMetricComparison(
  before: number,
  during: number,
  after: number,
): WrapupMetricComparison {
  const campaignMode: WrapupCampaignComparisonMode = before > 0 ? 'lift' : 'share';
  const observedTotal = before + during + after;
  const campaignValue = campaignMode === 'lift'
    ? (during - before) / before
    : observedTotal > 0
      ? during / observedTotal
      : null;
  const afterChange = during > 0 ? (after - during) / during : null;

  return { campaignMode, campaignValue, afterChange };
}
