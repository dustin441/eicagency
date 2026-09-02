'use client';

import React, { useState } from 'react';
import {
  DollarSign,
  Eye,
  MousePointer2,
  Target,
  Search as SearchIcon,
  Image as ImageIcon,
  LayoutGrid,
  Info,
  Megaphone,
} from 'lucide-react';
import { GoogleAdPreviews, MetaAdPreviews } from '@/components/AdPreviews';
import CreativeDeepDiveSections from '@/components/CreativeDeepDiveSections';
import { hasImmutableMetaCreativeId, isConfirmedMetaCatalogCreative, metaPreviewKind, resolveMetaImageUrl } from '@/lib/creative-deep-dive';
import { cn, fmtNumber, fmtCurrency, fmtPercent, fmtCompact, fmtMoneyPrecise } from '@/lib/utils';
import type {
  ChampagneCreativeAnalysis,
  ChampagneCreativeKpis,
  ChampagneImageCreative,
  ChampagnePmaxTextAsset,
} from '@/services/champagne-creative-analytics';

// Brand-toned gradient fallbacks for creatives whose image fails to load.
const AD_GRADIENTS = [
  ['#0B4A31', '#0f766e'],
  ['#EB541E', '#b91c1c'],
  ['#1e3a8a', '#0ea5e9'],
  ['#4c1d95', '#7c3aed'],
  ['#92400e', '#f59e0b'],
  ['#0f172a', '#334155'],
];
function gradientFor(name: string): string {
  if (!name) return `linear-gradient(135deg, ${AD_GRADIENTS[0][0]}, ${AD_GRADIENTS[0][1]})`;
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  const [a, b] = AD_GRADIENTS[h % AD_GRADIENTS.length];
  return `linear-gradient(135deg, ${a}, ${b})`;
}

// ─── KPI strip ───────────────────────────────────────────────────────────────

function StatCard({
  title,
  value,
  icon: Icon,
  color,
}: {
  title: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}) {
  return (
    <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm hover:shadow-lg transition-all group">
      <div className="flex items-center justify-between mb-3">
        <div className={cn('p-2 rounded-xl bg-gray-50 group-hover:scale-110 transition-transform', color)}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <div className="text-2xl font-bold text-brand-dark tabular-nums mb-1">{value}</div>
      <div className="text-xs font-medium uppercase tracking-widest text-gray-400">{title}</div>
    </div>
  );
}

function KpiStrip({ kpis, spendLabel = 'Spend' }: { kpis: ChampagneCreativeKpis; spendLabel?: string }) {
  const cards: { title: string; value: string; icon: React.ComponentType<{ className?: string }>; color: string }[] = [
    { title: spendLabel, value: fmtCurrency(kpis.spend), icon: DollarSign, color: 'text-indigo-700' },
    { title: 'Impressions', value: fmtCompact(kpis.impressions), icon: Eye, color: 'text-slate-700' },
    { title: 'Clicks', value: fmtNumber(kpis.clicks), icon: MousePointer2, color: 'text-blue-700' },
    { title: 'CTR', value: fmtPercent(kpis.ctr), icon: Target, color: 'text-emerald-700' },
    { title: 'CPC', value: kpis.cpc > 0 ? fmtMoneyPrecise(kpis.cpc) : '—', icon: DollarSign, color: 'text-cyan-700' },
  ];
  if (kpis.costPerEngagement && kpis.costPerEngagement > 0) {
    cards.push({
      title: 'Cost / Engagement',
      value: fmtMoneyPrecise(kpis.costPerEngagement),
      icon: DollarSign,
      color: 'text-brand-orange',
    });
  }
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
      {cards.map((c) => (
        <StatCard key={c.title} {...c} />
      ))}
    </div>
  );
}

// ─── Image creative cards (Display / PMax) ───────────────────────────────────

function ImageCreativeCard({ c, showCopy }: { c: ChampagneImageCreative; showCopy?: boolean }) {
  const [broken, setBroken] = useState(false);
  const showImg = c.imageUrl && !broken;
  return (
    <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden flex flex-col">
      <div className="relative aspect-square bg-gray-50 flex items-center justify-center" style={showImg ? undefined : { background: gradientFor(c.name) }}>
        {showImg ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={c.imageUrl} alt={c.name} className="w-full h-full object-contain" onError={() => setBroken(true)} />
        ) : (
          <ImageIcon className="w-10 h-10 text-white/70" />
        )}
        {c.type && (
          <span className="absolute top-2 left-2 text-[10px] font-bold uppercase tracking-wider bg-black/55 text-white px-2 py-0.5 rounded-full">
            {c.type.replace(/_/g, ' ')}
          </span>
        )}
      </div>
      <div className="p-4 space-y-3 flex-1 flex flex-col">
        <p className="text-sm font-semibold text-brand-dark line-clamp-2" title={c.name}>{c.name}</p>
        {showCopy && (c.headlines?.length || c.descriptions?.length) ? (
          <div className="space-y-1.5">
            {c.headlines?.slice(0, 3).map((h, i) => (
              <p key={`h${i}`} className="text-xs font-medium text-gray-700 line-clamp-1" title={h}>{h}</p>
            ))}
            {c.descriptions?.slice(0, 2).map((d, i) => (
              <p key={`d${i}`} className="text-[11px] text-gray-500 line-clamp-2" title={d}>{d}</p>
            ))}
          </div>
        ) : null}
        <div className="mt-auto grid grid-cols-4 gap-2 pt-2 border-t border-gray-50 text-center">
          <Metric label="Spend" value={fmtCurrency(c.spend)} />
          <Metric label="Clicks" value={fmtNumber(c.clicks)} />
          <Metric label="CTR" value={fmtPercent(c.ctr)} />
          <Metric label="CPC" value={c.cpc > 0 ? fmtMoneyPrecise(c.cpc) : '—'} />
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-bold text-brand-dark tabular-nums">{value}</div>
      <div className="text-[9px] font-medium uppercase tracking-widest text-gray-400">{label}</div>
    </div>
  );
}

function ImageGrid({ creatives, showCopy }: { creatives: ChampagneImageCreative[]; showCopy?: boolean }) {
  if (creatives.length === 0) return null;
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
      {creatives.map((c) => (
        <ImageCreativeCard key={c.id} c={c} showCopy={showCopy} />
      ))}
    </div>
  );
}

function PmaxTextAssets({ assets }: { assets: ChampagnePmaxTextAsset[] }) {
  if (assets.length === 0) return null;
  return (
    <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-50">
        <h4 className="text-sm font-bold text-brand-dark">Text Assets</h4>
        <p className="text-xs text-gray-400 mt-0.5">Headlines &amp; descriptions running in Performance Max</p>
      </div>
      <div className="divide-y divide-gray-50">
        {assets.map((a) => (
          <div key={a.id} className="flex items-center gap-4 px-6 py-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-brand-forest bg-brand-forest/10 px-2 py-0.5 rounded-full shrink-0 w-32 text-center">
              {a.type.replace(/_/g, ' ')}
            </span>
            <span className="text-sm text-gray-700 flex-1">{a.text}</span>
            <span className="text-xs text-gray-400 tabular-nums shrink-0">
              {fmtCurrency(a.spend)} · {fmtNumber(a.clicks)} clicks · CPC {a.cpc > 0 ? fmtMoneyPrecise(a.cpc) : '—'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Channel section ─────────────────────────────────────────────────────────

function SectionHeader({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-8 w-1.5 rounded-full bg-brand-forest" />
      <Icon className="w-5 h-5 text-brand-forest" />
      <h2 className="text-2xl font-bold text-brand-dark tracking-tight">{title}</h2>
      <span className="text-sm text-gray-400 font-medium">{subtitle}</span>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ChampagneCreativeAnalysisClient({ data }: { data: ChampagneCreativeAnalysis }) {
  const { search, display, pmax, meta, insights } = data;

  return (
    <div className="space-y-10 max-w-7xl mx-auto pb-20">
      <div>
        <h1 className="text-3xl font-bold text-brand-dark tracking-tight">Champagne House — Ad Analysis</h1>
        <p className="text-gray-500 mt-1">
          Creative-level Google &amp; Meta Ads performance across Search, Display, Performance Max &amp; Meta
        </p>
      </div>

      {/* Meta */}
      {insights.Meta?.hasData && (
        <CreativeDeepDiveSections
          insight={insights.Meta}
          candidates={meta.filter(hasImmutableMetaCreativeId).map((creative) => {
            const imageUrl = resolveMetaImageUrl(creative);
            const isCatalogPreview = isConfirmedMetaCatalogCreative(creative);
            return {
              id: creative.adId,
              name: creative.headline || creative.name,
              platformName: creative.name,
              imageUrl,
              videoUrl: creative.videoUrl,
              externalPreviewUrl: creative.previewUrl,
              previewKind: metaPreviewKind(imageUrl, creative.videoUrl, creative.isVideo, isCatalogPreview),
              validateImageDimensions: true,
              primaryText: creative.primaryText,
              headline: creative.headline,
              destinationUrl: creative.destinationUrl,
              spend: creative.spend,
              impressions: creative.impressions,
              clicks: creative.clicks,
              conversions: creative.leads,
            };
          })}
          objective="volume"
          conversionLabel="Leads"
          costLabel="CPL"
        />
      )}

      <section className="space-y-6">
        <SectionHeader icon={Megaphone} title="Meta" subtitle={`${meta.length} ad creatives`} />
        {meta.length === 0 ? (
          <EmptyState label="Meta" />
        ) : (
          <MetaAdPreviews
            creatives={meta}
            title="Champagne House — Meta Ad Creatives"
            advertiserName="Champagne House"
            metricMode="leads"
            conversionLabel={{ conversion: 'Leads', cpa: 'CPL' }}
          />
        )}
      </section>

      {/* Search */}
      <section className="space-y-6">
        <SectionHeader icon={SearchIcon} title="Search" subtitle={`${search.google.length} responsive search ads`} />
        {search.google.length === 0 ? (
          <EmptyState label="Search" />
        ) : (
          <>
            <KpiStrip kpis={search.kpis} />
            <GoogleAdPreviews
              creatives={search.google}
              title="Champagne House — Google Search Ads"
              advertiserName="Champagne House"
            />
          </>
        )}
      </section>

      {/* Display */}
      <section className="space-y-6">
        <SectionHeader icon={ImageIcon} title="Display" subtitle={`${display.creatives.length} responsive display ads`} />
        {display.creatives.length === 0 ? (
          <EmptyState label="Display" />
        ) : (
          <>
            <KpiStrip kpis={display.kpis} />
            <ImageGrid creatives={display.creatives} showCopy />
          </>
        )}
      </section>

      {/* Performance Max */}
      <section className="space-y-6">
        <SectionHeader
          icon={LayoutGrid}
          title="Performance Max"
          subtitle={`${pmax.creatives.length} image assets`}
        />
        {pmax.creatives.length === 0 && pmax.textAssets.length === 0 ? (
          <EmptyState label="Performance Max" />
        ) : (
          <>
            <KpiStrip kpis={pmax.kpis} spendLabel="PMax Spend (campaign)" />
            <div className="flex items-start gap-2 rounded-xl border border-amber-100 bg-amber-50/60 px-4 py-3 text-xs text-amber-800">
              <Info className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                The KPI strip shows true campaign-level PMax spend &amp; clicks. Per-asset spend on the cards below is
                Google&apos;s asset-group attribution (shared across assets), so use it to <strong>compare</strong> assets,
                not to sum totals.
              </span>
            </div>
            <ImageGrid creatives={pmax.creatives} />
            <PmaxTextAssets assets={pmax.textAssets} />
          </>
        )}
      </section>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-[2rem] border border-dashed border-gray-200 bg-white px-8 py-10 text-center">
      <p className="text-sm text-gray-400">No {label} creatives in the last 30 days.</p>
    </div>
  );
}
