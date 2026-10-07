export const ATA_EVENT_CAMPAIGN_PREFIX = 'ATA Event | PrePass |';

export const ATA_GOOGLE_CAMPAIGNS = [
  { id: '24301231161', name: 'ATA Event | PrePass | Search', channel: 'Search' },
  { id: '24301231173', name: 'ATA Event | PrePass | Demand Gen', channel: 'Demand Gen' },
] as const;

export const ATA_BUDGET_MONTH_START = '2026-10-01';
export const ATA_BUDGET_MONTH_END = '2026-10-31';
export const ATA_BUDGET_MONTH_LABEL = 'October 2026';

export function isAtaEventCampaignName(name: string | null | undefined): boolean {
  return String(name ?? '').trim().startsWith(ATA_EVENT_CAMPAIGN_PREFIX);
}
