export type GoodGameCampaignScope = 'all' | 'foot_traffic' | 'ecommerce';

const ECOMMERCE_NAME_PATTERN = /(?:sales|e-?commerce)/i;

const ECOMMERCE_CAMPAIGN_EXCEPTIONS = new Set([
  'MT | TOF | Purchase | 5 Hour + Red Bull + T-Pain',
  'MT-MOF-Retargeting Catalog',
  'MT-MOF-Retargeting Catalog - (Dup of what was working - Sept 25)',
  'MT | TOF | IC Opt | Headline Test | Sep 14 2025',
]);

export function isGoodGameEcommerceCampaign(campaignName: string | null | undefined): boolean {
  const normalizedName = campaignName?.trim() ?? '';
  return ECOMMERCE_NAME_PATTERN.test(normalizedName)
    || ECOMMERCE_CAMPAIGN_EXCEPTIONS.has(normalizedName);
}

export function matchesGoodGameCampaignScope(
  campaignName: string | null | undefined,
  scope: GoodGameCampaignScope
): boolean {
  if (scope === 'all') return true;
  const isEcommerce = isGoodGameEcommerceCampaign(campaignName);
  return scope === 'ecommerce' ? isEcommerce : !isEcommerce;
}
