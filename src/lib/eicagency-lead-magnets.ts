export type EicLeadMagnetId = 'roi-calculator' | 'scoreboard';

export type EicLeadMagnetDefinition = {
  id: EicLeadMagnetId;
  label: string;
  campaignNames: readonly string[];
  conversionActionType: string;
};

export const EIC_LEAD_MAGNETS: readonly EicLeadMagnetDefinition[] = [
  {
    id: 'roi-calculator',
    label: 'ROI Calculator',
    campaignNames: ['EIC | Retarget | ROI Calculator'],
    conversionActionType: 'offsite_conversion.fb_pixel_custom.roi_lead',
  },
  {
    id: 'scoreboard',
    label: 'Scoreboard',
    campaignNames: ['EIC | Retarget | Ads Ready Scorecard'],
    conversionActionType: 'offsite_conversion.fb_pixel_custom.ScorecardCompleted',
  },
];

function normalizeCampaignName(value: string): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim().toLocaleLowerCase('en-US');
}

export function campaignMatchesExactNames(
  campaignName: string,
  exactNames: readonly string[],
): boolean {
  const normalizedCampaign = normalizeCampaignName(campaignName);
  return exactNames.some((name) => normalizeCampaignName(name) === normalizedCampaign);
}

export function leadMagnetForCampaign(
  campaignName: string,
): EicLeadMagnetDefinition | undefined {
  return EIC_LEAD_MAGNETS.find((leadMagnet) =>
    campaignMatchesExactNames(campaignName, leadMagnet.campaignNames),
  );
}

export function isEicLeadMagnetCampaign(campaignName: string): boolean {
  return Boolean(leadMagnetForCampaign(campaignName));
}
