export type ChampagneCampaignScope = 'events' | 'halloween';

const HALLOWEEN_CAMPAIGN_MARKERS = [
  'halloween',
  'fangs & flutes',
  'fangs and flutes',
] as const;

export function isChampagneHalloweenCampaign(campaignName: string): boolean {
  const normalized = campaignName.trim().toLowerCase();
  return HALLOWEEN_CAMPAIGN_MARKERS.some(marker => normalized.includes(marker));
}

export function champagneCampaignMatchesScope(
  campaignName: string,
  scope: ChampagneCampaignScope,
): boolean {
  const halloween = isChampagneHalloweenCampaign(campaignName);
  return scope === 'halloween' ? halloween : !halloween;
}

export function champagneClicksForScope({
  scope,
  channel,
  clicks,
  linkClicks,
}: {
  scope: ChampagneCampaignScope;
  channel: string;
  clicks: number | null | undefined;
  linkClicks: number | null | undefined;
}): number {
  if (scope === 'halloween' && channel === 'Meta') {
    return Number(linkClicks ?? 0);
  }
  return Number(clicks ?? 0);
}

export const CHAMPAGNE_SCOPE_CONFIG: Record<
  ChampagneCampaignScope,
  { title: string; subtitle: string; budgetClient: string }
> = {
  events: {
    title: 'Events-Based Lead Gen',
    subtitle: 'Always-on Google + Meta lead generation performance',
    budgetClient: 'champagne_events',
  },
  halloween: {
    title: 'Halloween Campaign',
    subtitle: 'Halloween link-click performance only',
    budgetClient: 'champagne_halloween',
  },
};
