export type DurodyneProductLine = 'Duraline' | 'Dynatite';

export type DurodyneProductFields = {
  campaignName?: string | null;
  adsetName?: string | null;
  adName?: string | null;
  destinationUrl?: string | null;
};

export type DurodyneMetaPerformanceRow = {
  date: string;
  campaign_name: string;
  adset_name?: string | null;
  ad_name?: string | null;
  destination_url?: string | null;
  impressions: number;
  clicks: number;
  spend: number;
  leads: number | null;
};

export type DurodynePerformanceRow = {
  date: string;
  campaign_name: string;
  ad_channel: 'Meta';
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
};

const DYNATITE_PATTERN = /dynatite|dyna[\s-]*tite|stock the system|strut[\s-]*suspension/i;
const DURALINE_PATTERN = /duro[\s-]*line|duroline|50%\s*off|fastenter/i;
const DURALINE_WEAK_PATTERN = /\bscrew\b/i;

export function productLineFromFields(fields: DurodyneProductFields): DurodyneProductLine | null {
  // Ad set, ad, and destination identify the product inside mixed-product campaigns.
  // Campaign names are only a fallback because the current Meta campaign names both
  // Duro Line and Dyna-Tite. Explicit Dyna-Tite identity wins over the weak "screw"
  // Duro Line signal because current Dyna-Tite ad-set names also contain "Screw Launch".
  const specific = [fields.adsetName, fields.adName, fields.destinationUrl]
    .filter(Boolean)
    .join(' | ');
  const specificDyna = DYNATITE_PATTERN.test(specific);
  const specificDuro = DURALINE_PATTERN.test(specific);
  if (specificDyna) return 'Dynatite';
  if (specificDuro || DURALINE_WEAK_PATTERN.test(specific)) return 'Duraline';

  const campaign = fields.campaignName ?? '';
  if (/\|\s*Duraline\s*$/i.test(campaign)) return 'Duraline';
  if (/\|\s*Dynatite\s*$/i.test(campaign)) return 'Dynatite';
  const campaignDyna = DYNATITE_PATTERN.test(campaign);
  const campaignDuro = DURALINE_PATTERN.test(campaign);
  if (campaignDyna === campaignDuro) return null;
  return campaignDyna ? 'Dynatite' : 'Duraline';
}

export function buildProductAwareMetaRows(rows: DurodyneMetaPerformanceRow[]): DurodynePerformanceRow[] {
  const grouped = new Map<string, DurodynePerformanceRow>();

  for (const row of rows) {
    const product = productLineFromFields({
      campaignName: row.campaign_name,
      adsetName: row.adset_name,
      adName: row.ad_name,
      destinationUrl: row.destination_url,
    });
    const campaignName = product ? `${row.campaign_name} | ${product}` : row.campaign_name;
    const key = `${row.date}__${campaignName}`;
    const current = grouped.get(key) ?? {
      date: row.date,
      campaign_name: campaignName,
      ad_channel: 'Meta' as const,
      impressions: 0,
      clicks: 0,
      cost: 0,
      conversions: 0,
    };
    current.impressions += Number(row.impressions ?? 0);
    current.clicks += Number(row.clicks ?? 0);
    current.cost += Number(row.spend ?? 0);
    current.conversions += Number(row.leads ?? 0);
    grouped.set(key, current);
  }

  return Array.from(grouped.values());
}
