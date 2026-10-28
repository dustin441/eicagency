export type NsiConversionMetricRow = {
  ad_channel: string | null;
  clicks: number;
  cost: number;
  conversions: number;
  hubspot_conversions: number;
};

export type NsiConversionSplit = {
  productSubmittals: number;
  hubspotFormFills: number;
  metaLeads: number;
};

export type NsiConversionBreakout = {
  totalConversions: number;
  productSubmittals: number;
  hubspotFormFills: number;
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
 * Google (Search/Display/PMax) is where Product Submittals and HubSpot Form Fills
 * are tracked, so Google spend is the cost basis for Cost Per Product Submittal and
 * Cost Per HubSpot Form Fill. Meta and LinkedIn spend never enters those costs.
 */
export function isNsiGoogleRow(row: Pick<NsiConversionMetricRow, 'ad_channel'>): boolean {
  return row.ad_channel === 'Google' || row.ad_channel === 'Google Pmax';
}

/**
 * NSI conversion definitions — every row's `conversions` lands in exactly one subtype:
 * - Meta rows are native Meta lead-ad submissions (Meta Leads).
 * - On every other channel, `hubspot_conversions` is the Google Ads
 *   "hs_form_submission" action, which is already counted inside `conversions`.
 *   Those are HubSpot Form Fills; the remainder are Product Submittals.
 *
 * HubSpot is clamped to the row's conversions so a sync glitch can never make
 * Product Submittals negative or count a conversion twice.
 */
export function splitNsiConversions(row: Pick<NsiConversionMetricRow, 'ad_channel' | 'conversions' | 'hubspot_conversions'>): NsiConversionSplit {
  if (isNsiMetaLeadRow(row)) {
    return { productSubmittals: 0, hubspotFormFills: 0, metaLeads: row.conversions };
  }
  const hubspotFormFills = Math.min(Math.max(row.hubspot_conversions, 0), Math.max(row.conversions, 0));
  return {
    productSubmittals: row.conversions - hubspotFormFills,
    hubspotFormFills,
    metaLeads: 0,
  };
}

/**
 * Website Conversions = Product Submittals + HubSpot Form Fills.
 * Total Conversions = Website Conversions + Meta Leads.
 * Rate and cost are only reported at the website-aggregate level because paid
 * website spend cannot be allocated between submittals and HubSpot forms.
 */
export function buildNsiConversionBreakout(rows: NsiConversionMetricRow[]): NsiConversionBreakout {
  let productSubmittals = 0;
  let hubspotFormFills = 0;
  let websiteClicks = 0;
  let websiteCost = 0;
  let metaClicks = 0;
  let metaCost = 0;
  let metaLeads = 0;

  for (const row of rows) {
    const split = splitNsiConversions(row);
    productSubmittals += split.productSubmittals;
    hubspotFormFills += split.hubspotFormFills;
    metaLeads += split.metaLeads;
    if (isNsiMetaLeadRow(row)) {
      metaClicks += row.clicks;
      metaCost += row.cost;
    } else {
      websiteClicks += row.clicks;
      websiteCost += row.cost;
    }
  }

  const websiteConversions = productSubmittals + hubspotFormFills;

  return {
    totalConversions: websiteConversions + metaLeads,
    productSubmittals,
    hubspotFormFills,
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
