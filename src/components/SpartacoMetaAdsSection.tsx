'use client';

import React from 'react';
import { MetaAdPreviews } from '@/components/AdPreviews';
import type { MetaCreative } from '@/services/analytics';
import type { SpartacoMetaAd, SpartacoMode } from '@/services/spartaco-analytics';

function toMetaCreative(ad: SpartacoMetaAd, mode: SpartacoMode): MetaCreative {
  return {
    name: ad.adName || ad.headline || ad.campaignName,
    campaign: ad.campaignName,
    adset: ad.adsetName,
    headline: ad.headline,
    primaryText: ad.primaryText,
    finalCreativeLink: ad.finalCreativeLink,
    destinationUrl: ad.destinationUrl,
    ctaType: ad.ctaType,
    isVideo: ad.isVideo,
    videoId: ad.videoId,
    videoUrl: ad.videoUrl,
    spend: ad.cost,
    leads: mode === 'LEAD' ? ad.leads : ad.purchases,
    clicks: ad.clicks,
    impressions: ad.impressions,
  };
}

export default function SpartacoMetaAdsSection({
  brand,
  mode,
  ads,
}: {
  brand: string;
  mode: SpartacoMode;
  ads: SpartacoMetaAd[];
}) {
  if (ads.length === 0) return null;

  const creatives: MetaCreative[] = ads.map((ad) => toMetaCreative(ad, mode));

  return (
    <MetaAdPreviews
      creatives={creatives}
      title={`${brand} Meta Ads`}
      description={mode === 'LEAD' ? 'Brand-level Meta creative performance' : 'Brand-level Meta sales creative performance'}
      advertiserName={brand}
    />
  );
}
