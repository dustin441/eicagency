'use client';

import React, { useState } from 'react';
import {
  DollarSign,
  Eye,
  Image as ImageIcon,
  LayoutGrid,
  MousePointer2,
  ShoppingCart,
  Sparkles,
  Target,
} from 'lucide-react';
import { MetaAdPreviews, GoogleAdPreviews } from '@/components/AdPreviews';
import CreativeDeepDiveSections from '@/components/CreativeDeepDiveSections';
import DashboardXlsxDownloadButton from '@/components/DashboardXlsxDownloadButton';
import SpartacoFilterBar from '@/components/SpartacoFilterBar';
import { isConfirmedMetaCatalogCreative, metaPreviewKind } from '@/lib/creative-deep-dive';
import { cn, fmtCompact, fmtCurrency, fmtMoneyPrecise, fmtNumber, fmtPercent } from '@/lib/utils';
import type { MetaCreative } from '@/services/analytics';
import type { PmaxImageCreative } from '@/services/creative-analysis-types';
import type {
  SpartacoBrandAiInsight,
  SpartacoCreativeAnalysis,
  SpartacoCreativeBrandBlock,
  SpartacoMetaAd,
} from '@/services/spartaco-analytics';

const BRAND_LABELS: Record<string, string> = {
  Jameson: 'Jameson',
  Huskie: 'Huskie',
  Ronin: 'Ronin',
};

function toMetaCreative(ad: SpartacoMetaAd): MetaCreative {
  return {
    adId: ad.adId,
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
    previewUrl: ad.previewUrl,
    spend: ad.cost,
    leads: ad.leads,
    clicks: ad.clicks,
    impressions: ad.impressions,
  };
}

function StatCard({
  title,
  value,
  icon: Icon,
  color,
  isNorthStar = false,
}: {
  title: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  isNorthStar?: boolean;
}) {
  return (
    <div
      className={cn(
        'bg-white p-5 rounded-3xl border shadow-sm hover:shadow-lg transition-all group',
        isNorthStar ? 'border-brand-forest/25 ring-1 ring-brand-forest/10 bg-brand-forest/5' : 'border-gray-100'
      )}
    >
      <div className="mb-3 flex items-center justify-between">
        <div className={cn('rounded-xl bg-gray-50 p-2 transition-transform group-hover:scale-110', color)}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <div className="mb-1 text-2xl font-bold tabular-nums text-brand-dark">{value}</div>
      <div className="flex items-center gap-2">
        <span className={cn('text-xs font-medium uppercase tracking-widest', isNorthStar ? 'text-brand-forest' : 'text-gray-400')}>
          {title}
        </span>
        {isNorthStar ? (
          <span className="rounded-full bg-brand-forest/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-brand-forest">
            North Star
          </span>
        ) : null}
      </div>
    </div>
  );
}

function KpiStrip({ block }: { block: SpartacoCreativeBrandBlock }) {
  const summary = block.summary;
  const cards = [
    { title: 'Spend', value: fmtCurrency(summary.spend), icon: DollarSign, color: 'text-indigo-700' },
    { title: 'Impressions', value: fmtCompact(summary.impressions), icon: Eye, color: 'text-slate-700' },
    { title: 'Clicks', value: fmtNumber(summary.clicks), icon: MousePointer2, color: 'text-blue-700' },
    { title: 'CTR', value: fmtPercent(summary.ctr), icon: Target, color: 'text-emerald-700' },
    { title: 'CPC', value: summary.cpc > 0 ? fmtMoneyPrecise(summary.cpc) : '—', icon: DollarSign, color: 'text-cyan-700' },
    { title: 'Leads', value: fmtNumber(summary.leads), icon: ShoppingCart, color: 'text-brand-orange' },
    { title: 'Cost / Lead', value: summary.cpl > 0 ? fmtMoneyPrecise(summary.cpl) : '—', icon: DollarSign, color: 'text-brand-forest', isNorthStar: true },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-7">
      {cards.map((card) => <StatCard key={card.title} {...card} />)}
    </div>
  );
}

function fmtAsOf(iso: string) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function CopywriterNoteCard({ note, asOf }: { note: string[]; asOf: string }) {
  if (note.length === 0) return null;
  return (
    <div className="overflow-hidden rounded-[2rem] border border-gray-100 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-4 border-b border-gray-50 px-8 py-6">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-brand-forest/10 p-2 text-brand-forest"><Sparkles className="h-5 w-5" /></div>
          <div>
            <h3 className="text-xl font-bold text-brand-dark">AI Creative Insights</h3>
            <p className="mt-0.5 text-sm font-medium text-gray-400">Legacy copywriter note shown only when structured insights are unavailable.</p>
          </div>
        </div>
        {asOf ? <span className="shrink-0 text-xs font-medium text-gray-400">as of {fmtAsOf(asOf)}</span> : null}
      </div>
      <div className="space-y-2 px-8 py-6">
        {note.map((line, index) => <p key={index} className="text-sm leading-6 text-gray-700">{line.replace(/^•\s*/, '')}</p>)}
      </div>
    </div>
  );
}

const PMAX_GRADIENTS = [
  ['#0B4A31', '#0f766e'],
  ['#EB541E', '#b91c1c'],
  ['#1e3a8a', '#0ea5e9'],
  ['#4c1d95', '#7c3aed'],
  ['#92400e', '#f59e0b'],
  ['#0f172a', '#334155'],
];

function pmaxGradient(name: string) {
  if (!name) return `linear-gradient(135deg, ${PMAX_GRADIENTS[0][0]}, ${PMAX_GRADIENTS[0][1]})`;
  let hash = 0;
  for (let index = 0; index < name.length; index++) hash = (hash * 31 + name.charCodeAt(index)) >>> 0;
  const [start, end] = PMAX_GRADIENTS[hash % PMAX_GRADIENTS.length];
  return `linear-gradient(135deg, ${start}, ${end})`;
}

function PmaxAssetCard({ creative }: { creative: PmaxImageCreative }) {
  const [broken, setBroken] = useState(false);
  const showImage = Boolean(creative.imageUrl) && !broken;
  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition-all hover:shadow-xl">
      <div className="relative flex aspect-square items-center justify-center bg-gray-50" style={showImage ? undefined : { background: pmaxGradient(creative.name) }}>
        {showImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={creative.imageUrl} alt={creative.name} className="h-full w-full object-contain" onError={() => setBroken(true)} />
        ) : <ImageIcon className="h-10 w-10 text-white/70" />}
        {creative.type ? <span className="absolute left-2 top-2 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">{creative.type.replace(/_/g, ' ')}</span> : null}
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <p className="line-clamp-2 text-sm font-semibold text-brand-dark" title={creative.name}>{creative.name}</p>
        <div className="mt-auto grid grid-cols-4 gap-2 border-t border-gray-50 pt-2 text-center">
          {([
            ['Spend', fmtCurrency(creative.spend)],
            ['Clicks', fmtNumber(creative.clicks)],
            ['CTR', creative.impressions > 0 ? fmtPercent(creative.clicks / creative.impressions) : '—'],
            ['CPC', creative.cpc > 0 ? fmtMoneyPrecise(creative.cpc) : '—'],
          ] as [string, string][]).map(([label, value]) => (
            <div key={label}>
              <div className="text-xs font-bold tabular-nums text-brand-dark">{value}</div>
              <div className="text-[9px] font-medium uppercase tracking-widest text-gray-400">{label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function BrandBlock({ block, ai }: { block: SpartacoCreativeBrandBlock; ai?: SpartacoBrandAiInsight }) {
  const label = BRAND_LABELS[block.brand] ?? block.brand;
  const hasAds = block.ads.length > 0;
  const creatives = block.ads.map(toMetaCreative);
  const deepDiveCandidates = (ai?.referenceAds ?? []).map((creative) => ({
    id: creative.adId,
    name: creative.adName || creative.campaignName,
    platformName: creative.adName,
    imageUrl: creative.imageUrl,
    videoUrl: creative.videoUrl,
    previewKind: metaPreviewKind(
      creative.imageUrl,
      creative.videoUrl,
      creative.isVideo,
      isConfirmedMetaCatalogCreative(creative),
    ),
    validateImageDimensions: true,
    spend: creative.spend,
    impressions: 0,
    clicks: 0,
    conversions: creative.leads,
  }));
  const insightWindow = ai?.periodStart && ai?.periodEnd
    ? `${ai.periodStart} – ${ai.periodEnd}`
    : ai?.asOf ?? '';

  return (
    <section className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-8 w-1.5 rounded-full bg-brand-forest" />
        <h2 className="text-2xl font-bold tracking-tight text-brand-dark">{label}</h2>
        <span className="text-sm font-medium text-gray-400">
          {hasAds ? `${block.ads.length} Meta ads` : block.googleAds.length > 0 ? 'Google Search only' : 'No data'}
        </span>
      </div>

      {!hasAds && block.googleAds.length === 0 && block.googlePmax.length === 0 ? (
        <div className="rounded-[2rem] border border-dashed border-gray-200 bg-white px-8 py-10 text-center">
          <p className="text-sm text-gray-400">No Meta or Google ads for {label} in this period. Try a wider date range.</p>
        </div>
      ) : (
        <>
          {hasAds ? (
            <>
              <CreativeDeepDiveSections
                insight={ai ?? null}
                candidates={deepDiveCandidates}
                objective="leads"
                conversionLabel="Leads"
                costLabel="Cost / Lead"
                showLeaderCards={false}
                showFullBriefDisclosure
                sourceLabel={`${label} · AI insight window${insightWindow ? ` · ${insightWindow}` : ''}`}
              />
              <section className="space-y-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Supporting context</p>
                  <h3 className="text-2xl font-bold text-brand-dark">Performance Snapshot</h3>
                </div>
                <KpiStrip block={block} />
              </section>
              <MetaAdPreviews
                creatives={creatives}
                title={`${label} — Ads & Selected-Window Performance`}
                description="These previews use the selected dashboard dates. Recommendation evidence above uses the separately labeled AI insight window."
                advertiserName={label}
                metricMode="leads"
                conversionLabel={{ conversion: 'Leads', cpa: 'CPL' }}
              />
            </>
          ) : null}
          <GoogleAdPreviews creatives={block.googleAds} title={`${label} — Google Search Ads`} advertiserName={label} />
          {block.googlePmax.length > 0 ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <LayoutGrid className="h-5 w-5 text-brand-forest" />
                <h3 className="text-lg font-bold text-brand-dark">{label} — Performance Max</h3>
                <span className="text-sm text-gray-400">{block.googlePmax.length} assets</span>
              </div>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
                {block.googlePmax.map((creative) => <PmaxAssetCard key={creative.id} creative={creative} />)}
              </div>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}

export default function SpartacoCreativeAnalysisClient({ data }: { data: SpartacoCreativeAnalysis }) {
  const exportData = {
    filters: data.params,
    brandSummary: data.brands.map(({ brand, summary }) => ({ brand, ...summary })),
    metaAds: data.brands.flatMap(({ brand, ads }) => ads.map((ad) => ({ ...ad, brand }))),
    googleSearchAds: data.brands.flatMap(({ brand, googleAds }) => googleAds.map((ad) => ({ ...ad, brand }))),
    googlePmaxCreatives: data.brands.flatMap(({ brand, googlePmax }) => googlePmax.map((ad) => ({ ...ad, brand }))),
    creativeInsight: data.insight,
    aiInsights: Object.values(data.aiInsights),
  };

  return (
    <div className="mx-auto max-w-7xl space-y-8 pb-20">
      <div className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-brand-dark">Spartaco — Ad Analysis</h1>
            <p className="mt-1 text-gray-500">Creative-level lead-gen performance across Jameson, Huskie &amp; Ronin</p>
          </div>
          <DashboardXlsxDownloadButton data={exportData} title="Spartaco Ad Analysis" />
        </div>
        <SpartacoFilterBar
          mode={data.mode}
          options={{ brands: ['Jameson', 'Huskie', 'Ronin'], channels: [], focuses: [], campaigns: [] }}
          initialParams={data.params}
          currentTab="creatives"
        />
      </div>

      {Object.keys(data.aiInsights).length === 0 ? (
        <CopywriterNoteCard note={data.insight.copywriterNote} asOf={data.insight.asOf} />
      ) : null}

      {data.brands.map((block) => (
        <BrandBlock key={block.brand} block={block} ai={data.aiInsights[block.brand]} />
      ))}
    </div>
  );
}
