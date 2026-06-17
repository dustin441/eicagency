'use client';

import React, { useState } from 'react';
import {
  Sparkles,
  Trophy,
  DollarSign,
  Eye,
  MousePointer2,
  Target,
  ShoppingCart,
  Image as ImageIcon,
  AlertCircle,
} from 'lucide-react';
import SpartacoFilterBar from '@/components/SpartacoFilterBar';
import { MetaAdPreviews, GoogleAdPreviews } from '@/components/AdPreviews';
import { cn, fmtNumber, fmtCurrency, fmtPercent, fmtCompact, fmtMoneyPrecise } from '@/lib/utils';
import type { MetaCreative } from '@/services/analytics';
import type {
  SpartacoCreativeAnalysis,
  SpartacoCreativeBrandBlock,
  SpartacoMetaAd,
} from '@/services/spartaco-analytics';

const MIN_CHAMPION_SPEND = 200;

// Display "Ruski" alongside the underlying Huskie account name (per client naming).
const BRAND_LABELS: Record<string, string> = {
  Jameson: 'Jameson',
  Huskie: 'Ruski (Huskie)',
  Ronin: 'Ronin',
};

function hasImg(link: string) {
  return Boolean(link && link !== 'null' && link !== 'undefined');
}

function toMetaCreative(ad: SpartacoMetaAd): MetaCreative {
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
    previewUrl: ad.previewUrl,
    spend: ad.cost,
    leads: ad.leads,
    clicks: ad.clicks,
    impressions: ad.impressions,
  };
}

// ─── KPI strip (Leads) ──────────────────────────────────────────────────────────

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

function KpiStrip({ block }: { block: SpartacoCreativeBrandBlock }) {
  const s = block.summary;
  const cards = [
    { title: 'Spend', value: fmtCurrency(s.spend), icon: DollarSign, color: 'text-indigo-700' },
    { title: 'Impressions', value: fmtCompact(s.impressions), icon: Eye, color: 'text-slate-700' },
    { title: 'Clicks', value: fmtNumber(s.clicks), icon: MousePointer2, color: 'text-blue-700' },
    { title: 'CTR', value: fmtPercent(s.ctr), icon: Target, color: 'text-emerald-700' },
    { title: 'CPC', value: s.cpc > 0 ? fmtMoneyPrecise(s.cpc) : '—', icon: DollarSign, color: 'text-cyan-700' },
    { title: 'Leads', value: fmtNumber(s.leads), icon: ShoppingCart, color: 'text-brand-orange' },
    { title: 'Cost / Lead', value: s.cpl > 0 ? fmtMoneyPrecise(s.cpl) : '—', icon: DollarSign, color: 'text-brand-forest', isNorthStar: true },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-4">
      {cards.map((c) => (
        <StatCard key={c.title} {...c} />
      ))}
    </div>
  );
}

// ─── AI insight cards ───────────────────────────────────────────────────────────

function fmtAsOf(iso: string) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function CopywriterNoteCard({ note, asOf }: { note: string[]; asOf: string }) {
  if (note.length === 0) return null;
  return (
    <div className="rounded-[2rem] border border-gray-100 bg-white shadow-sm overflow-hidden">
      <div className="flex items-center justify-between gap-4 px-8 py-6 border-b border-gray-50">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-brand-forest/10 text-brand-forest">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-brand-dark">AI Creative Insights</h3>
            <p className="text-sm text-gray-400 font-medium mt-0.5">
              Cross-account copywriter note from the Creative Deep Dive
            </p>
          </div>
        </div>
        {asOf && <span className="text-xs font-medium text-gray-400 shrink-0">as of {fmtAsOf(asOf)}</span>}
      </div>
      <div className="px-8 py-6 space-y-2">
        {note.map((line, i) =>
          line.startsWith('•') ? (
            <div key={i} className="flex gap-2 text-sm leading-6 text-gray-700">
              <span className="mt-2 h-1.5 w-1.5 rounded-full shrink-0 bg-brand-forest" />
              <span>{line.replace(/^•\s*/, '')}</span>
            </div>
          ) : line.toLowerCase().startsWith('prioritize') ? (
            <p key={i} className="text-sm font-bold text-brand-forest pt-2">{line}</p>
          ) : (
            <p key={i} className="text-sm leading-6 text-gray-700">{line}</p>
          )
        )}
      </div>
    </div>
  );
}

function BrandVerdictCard({ verdict }: { verdict: string }) {
  if (!verdict) return null;
  return (
    <div className="rounded-2xl border border-gray-100 bg-gray-50/60 p-5">
      <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-brand-forest">
        <ImageIcon className="h-3.5 w-3.5" />
        Video vs Image — Deep Dive
      </div>
      <div className="space-y-1">
        {verdict.split('\n').map((line, i) => (
          <p
            key={i}
            className={cn('text-sm leading-6', line.includes('→') ? 'font-semibold text-brand-dark' : 'text-gray-600')}
          >
            {line}
          </p>
        ))}
      </div>
    </div>
  );
}

// ─── Champion (top performer) cards ──────────────────────────────────────────────

type Champion = { label: string; metric: string; ad: SpartacoMetaAd };

function ctrOf(ad: SpartacoMetaAd) {
  return ad.impressions > 0 ? ad.clicks / ad.impressions : 0;
}
function cplOf(ad: SpartacoMetaAd) {
  return ad.leads > 0 ? ad.cost / ad.leads : 0;
}

function pickChampions(ads: SpartacoMetaAd[]): Champion[] {
  const eligible = ads.filter((a) => a.cost >= MIN_CHAMPION_SPEND);
  if (eligible.length === 0) return [];

  const best = (pool: SpartacoMetaAd[], cmp: (a: SpartacoMetaAd, b: SpartacoMetaAd) => number) =>
    pool.length ? [...pool].sort(cmp)[0] : null;

  const champs: Champion[] = [];

  const cplPool = eligible.filter((a) => cplOf(a) > 0);
  const bestCpl = best(cplPool, (a, b) => cplOf(a) - cplOf(b));
  if (bestCpl) champs.push({ label: 'Best Cost / Lead', metric: fmtMoneyPrecise(cplOf(bestCpl)), ad: bestCpl });

  const mostLeads = best(eligible.filter((a) => a.leads > 0), (a, b) => b.leads - a.leads);
  if (mostLeads) champs.push({ label: 'Most Leads', metric: `${fmtNumber(mostLeads.leads)} leads`, ad: mostLeads });

  const bestCtr = best(eligible.filter((a) => ctrOf(a) > 0), (a, b) => ctrOf(b) - ctrOf(a));
  if (bestCtr) champs.push({ label: 'Best CTR', metric: fmtPercent(ctrOf(bestCtr)), ad: bestCtr });

  return champs;
}

function ChampionThumb({ ad }: { ad: SpartacoMetaAd }) {
  const [err, setErr] = useState(false);
  const showImage = hasImg(ad.finalCreativeLink) && !err;
  return (
    <div className="h-44 bg-gray-50 relative overflow-hidden flex items-center justify-center">
      {showImage ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={ad.finalCreativeLink}
          alt={ad.adName}
          className="w-full h-full object-contain"
          onError={() => setErr(true)}
        />
      ) : (
        <div className="flex flex-col items-center justify-center text-gray-300">
          <ImageIcon className="w-8 h-8" />
        </div>
      )}
    </div>
  );
}

function ChampionCards({ ads }: { ads: SpartacoMetaAd[] }) {
  const champs = pickChampions(ads);

  return (
    <div className="rounded-[2rem] border border-gray-100 bg-white shadow-sm overflow-hidden">
      <div className="px-8 py-6 border-b border-gray-50 flex items-center gap-3">
        <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
          <Trophy className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-brand-dark">Top Performers by Cost</h3>
          <p className="text-sm text-gray-400 font-medium mt-0.5">
            Best ads with at least {fmtCurrency(MIN_CHAMPION_SPEND)} spend in this period
          </p>
        </div>
      </div>
      {champs.length === 0 ? (
        <div className="px-8 py-6 flex items-center gap-2 text-sm text-gray-400">
          <AlertCircle className="w-4 h-4" />
          No ad reached {fmtCurrency(MIN_CHAMPION_SPEND)} spend in this period — widen the date range.
        </div>
      ) : (
        <div className="p-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {champs.map((c) => (
            <div key={c.label} className="rounded-2xl border border-gray-100 overflow-hidden bg-white">
              <div className="relative">
                <ChampionThumb ad={c.ad} />
                <span className="absolute top-2 left-2 text-[10px] font-bold uppercase tracking-wider bg-brand-forest text-white px-2 py-0.5 rounded-full">
                  {c.label}
                </span>
              </div>
              <div className="p-4">
                <div className="text-2xl font-bold text-brand-forest tabular-nums">{c.metric}</div>
                <p className="text-sm font-semibold text-brand-dark line-clamp-1 mt-1" title={c.ad.adName}>
                  {c.ad.adName || c.ad.headline || 'Untitled ad'}
                </p>
                <p className="text-xs text-gray-400 line-clamp-1 mt-0.5">{c.ad.campaignName}</p>
                <p className="text-xs text-gray-400 mt-1">{fmtCurrency(c.ad.cost)} spend</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Per-account block ────────────────────────────────────────────────────────

function BrandBlock({ block, verdict }: { block: SpartacoCreativeBrandBlock; verdict: string }) {
  const label = BRAND_LABELS[block.brand] ?? block.brand;
  const hasAds = block.ads.length > 0;
  const creatives = block.ads.map(toMetaCreative);

  return (
    <section className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-8 w-1.5 rounded-full bg-brand-forest" />
        <h2 className="text-2xl font-bold text-brand-dark tracking-tight">{label}</h2>
        <span className="text-sm text-gray-400 font-medium">
          {hasAds ? `${block.ads.length} Meta ads` : block.googleAds.length > 0 ? 'Google Search only' : 'No data'}
        </span>
      </div>

      {!hasAds && block.googleAds.length === 0 ? (
        <div className="rounded-[2rem] border border-dashed border-gray-200 bg-white px-8 py-10 text-center">
          <p className="text-sm text-gray-400">No Meta or Google ads for {label} in this period. Try a wider date range.</p>
        </div>
      ) : (
        <>
          {hasAds && (
            <>
              <KpiStrip block={block} />
              {verdict && <BrandVerdictCard verdict={verdict} />}
              <ChampionCards ads={block.ads} />
              <MetaAdPreviews
                creatives={creatives}
                title={`${label} — Meta Ad Creatives`}
                advertiserName={label}
                metricMode="leads"
                conversionLabel={{ conversion: 'Leads', cpa: 'CPL' }}
              />
            </>
          )}
          <GoogleAdPreviews creatives={block.googleAds} title={`${label} — Google Search Ads`} />
        </>
      )}
    </section>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SpartacoCreativeAnalysisClient({ data }: { data: SpartacoCreativeAnalysis }) {
  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-20">
      <div className="space-y-4">
        <div>
          <h1 className="text-3xl font-bold text-brand-dark tracking-tight">Spartaco — Ad Analysis</h1>
          <p className="text-gray-500 mt-1">Creative-level lead-gen performance across Jameson, Ruski &amp; Ronin</p>
        </div>

        <SpartacoFilterBar
          mode={data.mode}
          options={{ brands: ['Jameson', 'Huskie', 'Ronin'], channels: [], focuses: [], campaigns: [] }}
          initialParams={data.params}
          currentTab="creatives"
        />
      </div>

      <CopywriterNoteCard note={data.insight.copywriterNote} asOf={data.insight.asOf} />

      {data.brands.map((block) => (
        <BrandBlock key={block.brand} block={block} verdict={data.insight.brandVerdicts[block.brand] ?? ''} />
      ))}
    </div>
  );
}
