'use client';

import React from 'react';
import { Megaphone } from 'lucide-react';
import { MetaAdPreviews } from '@/components/AdPreviews';
import CreativeDeepDiveSections from '@/components/CreativeDeepDiveSections';
import {
  hasImmutableMetaCreativeId,
  isConfirmedMetaCatalogCreative,
  metaPreviewKind,
  resolveMetaImageUrl,
} from '@/lib/creative-deep-dive';
import type { MedibraneCreativeAnalysis } from '@/services/medibrane-creative-analytics';

export default function MedibraneCreativeAnalysisClient({ data }: { data: MedibraneCreativeAnalysis }) {
  const { meta, referenceMeta, insight } = data;
  const toCandidates = (creatives: typeof meta) => creatives.filter(hasImmutableMetaCreativeId).map(creative => {
    const imageUrl = resolveMetaImageUrl(creative);
    const isCatalog = isConfirmedMetaCatalogCreative(creative);
    return {
      id: creative.adId,
      name: creative.headline || creative.name,
      platformName: creative.name,
      imageUrl,
      videoUrl: creative.videoUrl,
      externalPreviewUrl: creative.previewUrl,
      previewKind: metaPreviewKind(imageUrl, creative.videoUrl, creative.isVideo, isCatalog),
      validateImageDimensions: true,
      primaryText: creative.primaryText,
      headline: creative.headline,
      destinationUrl: creative.destinationUrl,
      spend: creative.spend,
      impressions: creative.impressions,
      clicks: creative.clicks,
      conversions: creative.leads,
    };
  });
  const candidates = toCandidates(meta);
  const referenceCandidates = toCandidates(referenceMeta);

  return (
    <div className="space-y-10 max-w-7xl mx-auto pb-20">
      <div>
        <h1 className="text-3xl font-bold text-brand-dark tracking-tight">MediBraine — Ad Analysis</h1>
        <p className="text-gray-500 mt-1">
          Creative-level Meta Ads performance and AI recommendations from the last {data.periodDays} days
        </p>
      </div>

      {insight?.hasData && (
        <CreativeDeepDiveSections
          insight={insight}
          candidates={candidates}
          referenceCandidates={referenceCandidates}
          objective="leads"
          conversionLabel="Leads"
          costLabel="CPL"
          prioritySectionLabels={['Overall Direction', 'Concepts to Develop', 'Formats to Prioritize']}
          currencySymbol="₪"
        />
      )}

      <section className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-8 w-1.5 rounded-full bg-brand-forest" />
          <Megaphone className="w-5 h-5 text-brand-forest" />
          <h2 className="text-2xl font-bold text-brand-dark tracking-tight">Meta</h2>
          <span className="text-sm text-gray-400 font-medium">{meta.length} ad creatives</span>
        </div>

        {meta.length === 0 ? (
          <div className="rounded-[2rem] border border-dashed border-gray-200 bg-white px-8 py-10 text-center">
            <p className="text-sm text-gray-400">No Meta creatives in the last {data.periodDays} days.</p>
          </div>
        ) : (
          <MetaAdPreviews
            creatives={meta}
            title="MediBraine — Meta Ad Creatives"
            advertiserName="MediBraine"
            metricMode="leads"
            conversionLabel={{ conversion: 'Leads', cpa: 'CPL' }}
            currencySymbol="₪"
          />
        )}
      </section>
    </div>
  );
}
