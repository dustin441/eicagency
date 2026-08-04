export type GoodGameCampaignScope = 'all' | 'foot_traffic' | 'ecommerce';
export type GoodGameDestinationStage = 'ecommerce' | 'homepage_awareness' | 'store_locator';

const ECOMMERCE_NAME_PATTERN = /(?:sales|e-?commerce)/i;

const ECOMMERCE_CAMPAIGN_EXCEPTIONS = new Set([
  'MT | TOF | Purchase | 5 Hour + Red Bull + T-Pain',
  'MT-MOF-Retargeting Catalog',
  'MT-MOF-Retargeting Catalog - (Dup of what was working - Sept 25)',
  'MT | TOF | IC Opt | Headline Test | Sep 14 2025',
]);

const STORE_LOCATOR_NAME_PATTERN = /(?:\[locator\]|get\s+directions|store[-_\s]?locator)/i;
const STORE_LOCATOR_URL_PATTERN = /\/(?:pages\/)?store-locator(?:[/?#]|$)/i;

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

export function classifyGoodGameDestinationStage({
  campaignName,
  destinationUrl,
}: {
  campaignName: string | null | undefined;
  destinationUrl?: string | null;
}): GoodGameDestinationStage {
  if (isGoodGameEcommerceCampaign(campaignName)) return 'ecommerce';
  if (
    STORE_LOCATOR_NAME_PATTERN.test(campaignName?.trim() ?? '')
    || STORE_LOCATOR_URL_PATTERN.test(destinationUrl?.trim() ?? '')
  ) {
    return 'store_locator';
  }
  return 'homepage_awareness';
}

export function goodGameDestinationStageLabel(stage: GoodGameDestinationStage): string {
  if (stage === 'ecommerce') return 'eCommerce';
  if (stage === 'store_locator') return 'Store Locator / Get Directions';
  return 'Homepage / Awareness';
}
