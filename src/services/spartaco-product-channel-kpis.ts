export type ProductChannelMetricInput = {
  ad_impressions: number;
  ad_clicks: number;
  ad_cost: number;
  ad_conversions: number;
  ad_purchases: number;
  ad_revenue: number;
  ga4_sessions: number;
  ga4_engaged_sessions: number;
  ga4_total_revenue: number;
  email_total_sent: number;
  email_opens: number;
  email_clicks: number;
  gsc_clicks: number;
  gsc_impressions: number;
  gsc_avg_position: number;
  social_impressions: number;
  social_interactions: number;
  social_engagement: number;
};

export type ProductChannelKpiRow = {
  channel: 'Paid Media' | 'Website' | 'Email' | 'Search' | 'Social';
  metric: string;
  value: number | null;
  previousValue: number | null;
  available: boolean;
  previousAvailable: boolean;
  format: 'number' | 'compact' | 'currency' | 'multiple';
  description: string;
};

export type ProductChannelAvailability = {
  paid: boolean;
  website: boolean;
  email: boolean;
  search: boolean;
  social: boolean;
};

function hasAny(values: number[]): boolean {
  return values.some(value => Number.isFinite(Number(value)) && Number(value) !== 0);
}

function paidAvailable(row: ProductChannelMetricInput): boolean {
  return hasAny([
    row.ad_impressions,
    row.ad_clicks,
    row.ad_cost,
    row.ad_conversions,
    row.ad_purchases,
    row.ad_revenue,
  ]);
}

function websiteAvailable(row: ProductChannelMetricInput): boolean {
  return hasAny([row.ga4_sessions, row.ga4_engaged_sessions, row.ga4_total_revenue]);
}

function emailAvailable(row: ProductChannelMetricInput): boolean {
  return hasAny([row.email_total_sent, row.email_opens, row.email_clicks]);
}

function searchAvailable(row: ProductChannelMetricInput): boolean {
  return hasAny([row.gsc_impressions, row.gsc_clicks, row.gsc_avg_position]);
}

function socialAvailable(row: ProductChannelMetricInput): boolean {
  return hasAny([row.social_impressions, row.social_interactions, row.social_engagement]);
}

function availableValue(available: boolean, value: number): number | null {
  return available && Number.isFinite(value) ? value : null;
}

function availableRatio(available: boolean, numerator: number, denominator: number): number | null {
  return available && denominator > 0 && Number.isFinite(numerator)
    ? numerator / denominator
    : null;
}

export function buildProductChannelKpiRows(
  current: ProductChannelMetricInput,
  previous: ProductChannelMetricInput,
  currentAvailability?: ProductChannelAvailability,
  previousAvailability?: ProductChannelAvailability,
): ProductChannelKpiRow[] {
  const currentPaidAvailable = currentAvailability?.paid ?? paidAvailable(current);
  const previousPaidAvailable = previousAvailability?.paid ?? paidAvailable(previous);
  const usePaidRoas = hasAny([
    current.ad_purchases,
    current.ad_revenue,
    previous.ad_purchases,
    previous.ad_revenue,
  ]);

  const currentWebsiteAvailable = currentAvailability?.website ?? websiteAvailable(current);
  const previousWebsiteAvailable = previousAvailability?.website ?? websiteAvailable(previous);
  const useWebsiteRevenue = hasAny([current.ga4_total_revenue, previous.ga4_total_revenue]);

  const currentEmailAvailable = currentAvailability?.email ?? emailAvailable(current);
  const previousEmailAvailable = previousAvailability?.email ?? emailAvailable(previous);
  const currentSearchAvailable = currentAvailability?.search ?? searchAvailable(current);
  const previousSearchAvailable = previousAvailability?.search ?? searchAvailable(previous);
  const currentSocialAvailable = currentAvailability?.social ?? socialAvailable(current);
  const previousSocialAvailable = previousAvailability?.social ?? socialAvailable(previous);

  return [
    {
      channel: 'Paid Media',
      metric: usePaidRoas ? 'ROAS' : 'Leads',
      value: usePaidRoas
        ? availableRatio(currentPaidAvailable, current.ad_revenue, current.ad_cost)
        : availableValue(currentPaidAvailable, current.ad_conversions),
      previousValue: usePaidRoas
        ? availableRatio(previousPaidAvailable, previous.ad_revenue, previous.ad_cost)
        : availableValue(previousPaidAvailable, previous.ad_conversions),
      available: currentPaidAvailable,
      previousAvailable: previousPaidAvailable,
      format: usePaidRoas ? 'multiple' : 'number',
      description: usePaidRoas ? 'Ad-attributed revenue divided by spend' : 'Tracked ad-platform conversions',
    },
    {
      channel: 'Website',
      metric: useWebsiteRevenue ? 'GA4 Revenue' : 'Engaged Sessions',
      value: availableValue(
        currentWebsiteAvailable,
        useWebsiteRevenue ? current.ga4_total_revenue : current.ga4_engaged_sessions,
      ),
      previousValue: availableValue(
        previousWebsiteAvailable,
        useWebsiteRevenue ? previous.ga4_total_revenue : previous.ga4_engaged_sessions,
      ),
      available: currentWebsiteAvailable,
      previousAvailable: previousWebsiteAvailable,
      format: useWebsiteRevenue ? 'currency' : 'compact',
      description: useWebsiteRevenue ? 'GA4 revenue attributed to product pages' : 'Engaged sessions on product pages',
    },
    {
      channel: 'Email',
      metric: 'Email Clicks',
      value: availableValue(currentEmailAvailable, current.email_clicks),
      previousValue: availableValue(previousEmailAvailable, previous.email_clicks),
      available: currentEmailAvailable,
      previousAvailable: previousEmailAvailable,
      format: 'number',
      description: 'Clicks from product-aligned email sends',
    },
    {
      channel: 'Search',
      metric: 'GSC Clicks',
      value: availableValue(currentSearchAvailable, current.gsc_clicks),
      previousValue: availableValue(previousSearchAvailable, previous.gsc_clicks),
      available: currentSearchAvailable,
      previousAvailable: previousSearchAvailable,
      format: 'number',
      description: 'Organic search clicks from Google Search Console',
    },
    {
      channel: 'Social',
      metric: 'Social Interactions',
      value: availableValue(currentSocialAvailable, current.social_interactions),
      previousValue: availableValue(previousSocialAvailable, previous.social_interactions),
      available: currentSocialAvailable,
      previousAvailable: previousSocialAvailable,
      format: 'number',
      description: 'Interactions on product-aligned social posts',
    },
  ];
}
