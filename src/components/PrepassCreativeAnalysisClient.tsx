'use client';

import React, { useState } from 'react';
import {
  DollarSign,
  Eye,
  MousePointer2,
  Target,
  Award,
  Image as ImageIcon,
} from 'lucide-react';
import FilterBar from '@/components/FilterBar';
import { MetaAdPreviews, GoogleAdPreviews } from '@/components/AdPreviews';
import CreativeDeepDiveSections from '@/components/CreativeDeepDiveSections';
import { isConfirmedMetaCatalogCreative, metaPreviewKind } from '@/lib/creative-deep-dive';
import { cn, fmtNumber, fmtCurrency, fmtPercent, fmtCompact, fmtMoneyPrecise } from '@/lib/utils';
import type { PrepassCreativeAnalysis, PrepassCreativeFocusBlock, PrepassFocusAiInsight, PrepassImageCreative } from '@/services/analytics';

const FOCUS_LABELS: Record<string, string> = {
  SMB: 'SMB Segments',
  ABM: 'ABM Focus',
  FD360: 'FD360 Campaigns',
};

const FOCUS_DESCRIPTIONS: Record<string, string> = {
  SMB: 'High-volume self-serve lead gen',
  ABM: 'Account-based, fleet-targeted outreach',
  FD360: 'Full-funnel demo campaigns',
};

// ─── KPI strip ──────────────────────────────────────────────────────────────

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
      <div className="flex items-center justify-between mb-3">
        <div className={cn('p-2 rounded-xl bg-gray-50 group-hover:scale-110 transition-transform', color)}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <div className="text-2xl font-bold text-brand-dark tabular-nums mb-1">{value}</div>
      <div className="flex items-center gap-2">
        <span
          className={cn(
            'text-xs font-medium uppercase tracking-widest',
            isNorthStar ? 'text-brand-forest' : 'text-gray-400'
          )}
        >
          {title}
        </span>
        {isNorthStar && (
          <span className="text-[9px] font-bold uppercase tracking-widest text-brand-forest bg-brand-forest/10 px-1.5 py-0.5 rounded-full">
            North Star
          </span>
        )}
      </div>
    </div>
  );
}

function KpiStrip({ block }: { block: PrepassCreativeFocusBlock }) {
  const s = block.summary;
  const cards = [
    { title: 'Spend', value: fmtCurrency(s.spend), icon: DollarSign, color: 'text-indigo-700' },
    { title: 'Impressions', value: fmtCompact(s.impressions), icon: Eye, color: 'text-slate-700' },
    { title: 'Clicks', value: fmtNumber(s.clicks), icon: MousePointer2, color: 'text-blue-700' },
    { title: 'CTR', value: fmtPercent(s.ctr), icon: Target, color: 'text-emerald-700' },
    { title: 'MQLs', value: fmtNumber(s.mqls), icon: Award, color: 'text-brand-orange' },
    { title: 'Cost / MQL', value: s.cpMql > 0 ? fmtMoneyPrecise(s.cpMql) : '—', icon: DollarSign, color: 'text-cyan-700' },
    { title: 'SQLs', value: fmtNumber(s.sqls), icon: Award, color: 'text-brand-orange' },
    { title: 'Cost / Won', value: s.cpWon > 0 ? fmtMoneyPrecise(s.cpWon) : '—', icon: DollarSign, color: 'text-brand-forest', isNorthStar: true },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-4">
      {cards.map((c) => (
        <StatCard key={c.title} {...c} />
      ))}
    </div>
  );
}

// ─── Image creative cards (Google Display / Performance Max) ────────────────

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

function ImageMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-bold text-brand-dark tabular-nums">{value}</div>
      <div className="text-[9px] font-medium uppercase tracking-widest text-gray-400">{label}</div>
    </div>
  );
}

function ImageCreativeCard({ c, showCopy }: { c: PrepassImageCreative; showCopy?: boolean }) {
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
          <ImageMetric label="Spend" value={fmtCurrency(c.spend)} />
          <ImageMetric label="Clicks" value={fmtNumber(c.clicks)} />
          <ImageMetric label="CTR" value={fmtPercent(c.ctr)} />
          <ImageMetric label="CPC" value={c.cpc > 0 ? fmtMoneyPrecise(c.cpc) : '—'} />
        </div>
      </div>
    </div>
  );
}

function ImageGrid({ title, description, creatives, showCopy }: { title: string; description?: string; creatives: PrepassImageCreative[]; showCopy?: boolean }) {
  if (creatives.length === 0) return null;
  return (
    <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
      <div className="p-8 border-b border-gray-50">
        <h3 className="text-xl font-bold text-brand-dark">{title}</h3>
        {description && <p className="text-sm text-gray-400 font-medium mt-0.5">{description}</p>}
      </div>
      <div className="p-6 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
        {creatives.map((c) => (
          <ImageCreativeCard key={c.id} c={c} showCopy={showCopy} />
        ))}
      </div>
    </div>
  );
}

// ─── Per-focus block ──────────────────────────────────────────────────────────

function FocusBlock({ block, ai }: { block: PrepassCreativeFocusBlock; ai?: PrepassFocusAiInsight }) {
  const label = FOCUS_LABELS[block.focus] ?? block.focus;
  const hasAds = block.ads.length > 0;
  const deepDiveCandidates = block.ads.map((creative, index) => {
    const imageUrl = creative.permanentImageUrl || creative.finalCreativeLink;
    const isCatalogPreview = isConfirmedMetaCatalogCreative(creative);
    return {
      id: creative.name || `${block.focus}-${index}`,
      name: creative.headline || creative.name,
      platformName: creative.name,
      headline: creative.headline,
      primaryText: creative.primaryText,
      imageUrl,
      videoUrl: creative.videoUrl,
      externalPreviewUrl: creative.previewUrl,
      previewKind: metaPreviewKind(imageUrl, creative.videoUrl, creative.isVideo, isCatalogPreview),
      spend: creative.spend,
      impressions: creative.impressions,
      clicks: creative.clicks,
      conversions: creative.mqls ?? 0,
    };
  });

  return (
    <section className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-8 w-1.5 rounded-full bg-brand-forest" />
        <div>
          <h2 className="text-2xl font-bold text-brand-dark tracking-tight">{label}</h2>
          <p className="text-sm text-gray-400 font-medium">{FOCUS_DESCRIPTIONS[block.focus]}</p>
        </div>
        <span className="text-sm text-gray-400 font-medium ml-auto">
          {hasAds ? `${block.ads.length} Meta ads` : block.googleAds.length > 0 ? 'Google Search only' : 'No data'}
        </span>
      </div>

      {!hasAds && block.googleAds.length === 0 && block.displayAds.length === 0 && block.pmaxAds.length === 0 ? (
        <div className="rounded-[2rem] border border-dashed border-gray-200 bg-white px-8 py-10 text-center">
          <p className="text-sm text-gray-400">No ads for {label} in this period. Try a wider date range.</p>
        </div>
      ) : (
        <>
          {hasAds && (
            <>
              <CreativeDeepDiveSections
                insight={ai ?? null}
                candidates={deepDiveCandidates}
                objective="leads"
                conversionLabel="MQLs"
                costLabel="Cost / MQL"
                showFullBriefDisclosure
                sourceLabel={`${label} · Current dashboard window`}
              />
              <section className="space-y-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Supporting context</p>
                  <h3 className="text-2xl font-bold text-brand-dark">Performance Snapshot</h3>
                </div>
                <KpiStrip block={block} />
              </section>
              <MetaAdPreviews
                creatives={block.ads}
                title={`${label} — Ads & Performance Evidence`}
                description="Scroll-through proof for the recommendations above: each creative preview includes spend, CTR, MQLs, and Cost/MQL so the team can see exactly which ads drove the insight."
                advertiserName={label}
                metricMode="leads"
                showFunnel
              />
            </>
          )}
          <GoogleAdPreviews creatives={block.googleAds} title={`${label} — Google Search Ads`} advertiserName="PrePass" />
          <ImageGrid
            title={`${label} — Google Display Ads`}
            description="Responsive Display ad creatives (image + copy), aggregated by ad."
            creatives={block.displayAds}
            showCopy
          />
          <ImageGrid
            title={`${label} — Performance Max Assets`}
            description="Image assets running in Performance Max. Spend/clicks are Google's asset-group attribution — use for ranking, not totals."
            creatives={block.pmaxAds}
          />
        </>
      )}
    </section>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PrepassCreativeAnalysisClient({ data }: { data: PrepassCreativeAnalysis }) {
  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-20">
      <div className="space-y-4">
        <div>
          <h1 className="text-3xl font-bold text-brand-dark tracking-tight">Ad Analysis</h1>
          <p className="text-gray-500 mt-1">Creative-level performance across SMB, ABM &amp; FD360 — each ad shown once, aggregated across ad sets and campaigns</p>
        </div>

        <FilterBar showFocus={false} showChannel={false} />
      </div>

      {data.focuses.map((block) => (
        <FocusBlock key={block.focus} block={block} ai={data.aiInsights[block.focus]} />
      ))}
    </div>
  );
}
