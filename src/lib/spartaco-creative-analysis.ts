export type SpartacoAiReferenceAd = {
  adId: string;
  adName: string;
  campaignName: string;
  imageUrl: string;
  isVideo: boolean;
  videoUrl: string;
  spend: number;
  leads: number;
  ctr: number;
};

export function buildEligibleSpartacoCampaigns(
  rows: Record<string, unknown>[],
  mode: 'LEAD' | 'SALES',
): Map<string, Set<string>> {
  const byBrand = new Map<string, Set<string>>();
  for (const row of rows) {
    const brand = String(row.brand ?? '');
    const campaignName = String(row.campaign_name ?? '').trim().toLowerCase();
    const campaignType = String(row.type ?? '').toUpperCase();
    if (!brand || !campaignName || campaignType !== mode) continue;
    const eligibleCampaigns = byBrand.get(brand) ?? new Set<string>();
    eligibleCampaigns.add(campaignName);
    byBrand.set(brand, eligibleCampaigns);
  }
  return byBrand;
}

export function normalizeSpartacoAiReferenceAds(value: unknown): SpartacoAiReferenceAd[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((raw): SpartacoAiReferenceAd => {
      const ad = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
      return {
        adId: String(ad.ad_id ?? ''),
        adName: String(ad.ad_name ?? ''),
        campaignName: String(ad.campaign_name ?? ''),
        imageUrl: String(ad.image ?? ''),
        isVideo: Boolean(ad.is_video),
        videoUrl: String(ad.video_url ?? ''),
        spend: Number(ad.spend) || 0,
        leads: Number(ad.leads) || 0,
        ctr: Number(ad.ctr) || 0,
      };
    })
    .filter((ad) => Boolean(ad.adId));
}
