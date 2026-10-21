export type NsiConversionMetricRow = {
  ad_channel: string | null;
  clicks: number;
  cost: number;
  conversions: number;
};

export type NsiConversionBreakout = {
  websiteClicks: number;
  websiteCost: number;
  websiteConversions: number;
  websiteConversionRate: number;
  websiteCostPerConversion: number;
  metaClicks: number;
  metaCost: number;
  metaLeads: number;
  metaLeadRate: number;
  metaCostPerLead: number;
};

export function isNsiMetaLeadRow(row: Pick<NsiConversionMetricRow, 'ad_channel'>): boolean {
  return row.ad_channel === 'Facebook';
}

/**
 * NSI conversion definitions:
 * - Meta rows are native Meta lead-ad submissions.
 * - Every other tracked paid-media conversion is an on-site conversion. This
 *   includes product submittals and the small number of HubSpot form fills.
 *
 * Keeping the split channel-based means the two buckets are mutually exclusive
 * and always reconcile to the existing aggregate conversions total.
 */
export function buildNsiConversionBreakout(rows: NsiConversionMetricRow[]): NsiConversionBreakout {
  let websiteClicks = 0;
  let websiteCost = 0;
  let websiteConversions = 0;
  let metaClicks = 0;
  let metaCost = 0;
  let metaLeads = 0;

  for (const row of rows) {
    if (isNsiMetaLeadRow(row)) {
      metaClicks += row.clicks;
      metaCost += row.cost;
      metaLeads += row.conversions;
    } else {
      websiteClicks += row.clicks;
      websiteCost += row.cost;
      websiteConversions += row.conversions;
    }
  }

  return {
    websiteClicks,
    websiteCost,
    websiteConversions,
    websiteConversionRate: websiteClicks > 0 ? websiteConversions / websiteClicks : 0,
    websiteCostPerConversion: websiteConversions > 0 ? websiteCost / websiteConversions : 0,
    metaClicks,
    metaCost,
    metaLeads,
    metaLeadRate: metaClicks > 0 ? metaLeads / metaClicks : 0,
    metaCostPerLead: metaLeads > 0 ? metaCost / metaLeads : 0,
  };
}
