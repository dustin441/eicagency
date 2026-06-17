'use client';

import React from 'react';
import Link from 'next/link';
import {
  Sparkles,
  Trophy,
  DollarSign,
  Eye,
  MousePointer2,
  Target,
  ShoppingCart,
  TrendingUp,
  Image as ImageIcon,
  AlertCircle,
} from 'lucide-react';
import SpartacoFilterBar from '@/components/SpartacoFilterBar';
import { MetaAdPreviews } from '@/components/AdPreviews';
import { cn, fmtNumber, fmtCurrency, fmtPercent, fmtCompact, fmtMoneyPrecise } from '@/lib/utils';
import type { MetaCreative } from '@/services/analytics';
import type {
  SpartacoCreativeAnalysis,
  SpartacoCreativeBrandBlock,
  SpartacoCreativeMode,
  SpartacoMetaAd,
} from '@/services/spartaco-analytics';

const MIN_CHAMPION_SPEND = 200;

// Display "Ruski" alongside the underlying Huskie account name (per client naming).
const BRAND_LABELS: Record<string, string> = {
  Jameson: 'Jameson',
  Huskie: 'Ruski (Huskie)',
  Ronin: 'Ronin',
};

function toMetaCreative(ad: SpartacoMetaAd, mode: SpartacoCreativeMode): MetaCreative {
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
    leads: mode === 'LEAD' ? ad.leads : ad.purchases,
    clicks: ad.clicks,
    impressions: ad.impressions,
    sales: ad.purchases,
    revenue: ad.revenue,
  };
}

// ─── Leads / Sales toggle ───────────────────────────────────────────────────────

function ModeToggle({ data }: { data: SpartacoCreativeAnalysis }) {
  function href(mode: SpartacoCreativeMode) {
    const p = new URLSearchParams();
    p.set('start', data.params.start);
    p.set('end', data.params.end);
    p.set('comp_start', data.params.compStart);
    p.set('comp_end', data.params.compEnd);
    if (data.params.brand !== 'all') p.set('brand', data.params.brand);
    if (data.params.campaign !== 'all') p.set('campaign', data.params.campaign);
    p.set('mode', mode);
    return `/dashboard/spartaco/creatives?${p.toString()}`;
  }

  return (
    <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1 w-fit">
      {(['LEAD', 'SALES'] as SpartacoCreativeMode[]).map((m) => (
        <Link
          key={m}
          href={href(m)}
          className={cn(
            'px-4 py-1.5 rounded-lg text-xs font-bold transition-all',
            data.mode === m ? 'bg-brand-forest text-white shadow-sm' : 'text-gray-500 hover:text-brand-forest'
          )}
        >
          {m === 'LEAD' ? 'Leads' : 'Sales'}
        </Link>
      ))}
    </div>
  );
}

// ─── KPI strip ────────────────────────────────────────────────────────────────

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

function KpiStrip({ block, mode }: { block: SpartacoCreativeBrandBlock; mode: SpartacoCreativeMode }) {
  const s = block.summary;
  const base = [
    { title: 'Spend', value: fmtCurrency(s.spend), icon: DollarSign, color: 'text-indigo-700' },
    { title: 'Impressions', value: fmtCompact(s.impressions), icon: Eye, color: 'text-slate-700' },
    { title: 'Clicks', value: fmtNumber(s.clicks), icon: MousePointer2, color: 'text-blue-700' },
    { title: 'CTR', value: fmtPercent(s.ctr), icon: Target, color: 'text-emerald-700' },
    { title: 'CPC', value: s.cpc > 0 ? fmtMoneyPrecise(s.cpc) : '—', icon: DollarSign, color: 'text-cyan-700' },
  ];
  const leadCards = [
    { title: 'Leads', value: fmtNumber(s.leads), icon: ShoppingCart, color: 'text-brand-orange' },
    { title: 'Cost / Lead', value: s.cpl > 0 ? fmtMoneyPrecise(s.cpl) : '—', icon: DollarSign, color: 'text-brand-forest', isNorthStar: true },
  ];
  const salesCards = [
    { title: 'Purchases', value: fmtNumber(s.purchases), icon: ShoppingCart, color: 'text-brand-orange' },
    { title: 'Revenue', value: fmtCurrency(s.revenue), icon: DollarSign, color: 'text-brand-forest' },
    { title: 'ROAS', value: s.roas > 0 ? `${s.roas.toFixed(2)}x` : '—', icon: TrendingUp, color: 'text-brand-forest', isNorthStar: true },
    { title: 'Cost / Sale', value: s.costPerSale > 0 ? fmtMoneyPrecise(s.costPerSale) : '—', icon: DollarSign, color: 'text-cyan-700' },
  ];
  const cards = [...base, ...(mode === 'LEAD' ? leadCards : salesCards)];

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
function roasOf(ad: SpartacoMetaAd) {
  return ad.cost > 0 ? ad.revenue / ad.cost : 0;
}
function cpsOf(ad: SpartacoMetaAd) {
  return ad.purchases > 0 ? ad.cost / ad.purchases : 0;
}

function pickChampions(ads: SpartacoMetaAd[], mode: SpartacoCreativeMode): Champion[] {
  const eligible = ads.filter((a) => a.cost >= MIN_CHAMPION_SPEND);
  if (eligible.length === 0) return [];

  const best = (pool: SpartacoMetaAd[], cmp: (a: SpartacoMetaAd, b: SpartacoMetaAd) => number) =>
    pool.length ? [...pool].sort(cmp)[0] : null;

  const champs: Champion[] = [];

  if (mode === 'LEAD') {
    const cplPool = eligible.filter((a) => cplOf(a) > 0);
    const bestCpl = best(cplPool, (a, b) => cplOf(a) - cplOf(b));
    if (bestCpl) champs.push({ label: 'Best Cost / Lead', metric: fmtMoneyPrecise(cplOf(bestCpl)), ad: bestCpl });

    const mostLeads = best(eligible.filter((a) => a.leads > 0), (a, b) => b.leads - a.leads);
    if (mostLeads) champs.push({ label: 'Most Leads', metric: `${fmtNumber(mostLeads.leads)} leads`, ad: mostLeads });

    const bestCtr = best(eligible.filter((a) => ctrOf(a) > 0), (a, b) => ctrOf(b) - ctrOf(a));
    if (bestCtr) champs.push({ label: 'Best CTR', metric: fmtPercent(ctrOf(bestCtr)), ad: bestCtr });
  } else {
    const bestRoas = best(eligible.filter((a) => roasOf(a) > 0), (a, b) => roasOf(b) - roasOf(a));
    if (bestRoas) champs.push({ label: 'Best ROAS', metric: `${roasOf(bestRoas).toFixed(2)}x`, ad: bestRoas });

    const cpsPool = eligible.filter((a) => cpsOf(a) > 0);
    const bestCps = best(cpsPool, (a, b) => cpsOf(a) - cpsOf(b));
    if (bestCps) champs.push({ label: 'Best Cost / Sale', metric: fmtMoneyPrecise(cpsOf(bestCps)), ad: bestCps });

    const mostRevenue = best(eligible.filter((a) => a.revenue > 0), (a, b) => b.revenue - a.revenue);
    if (mostRevenue) champs.push({ label: 'Most Revenue', metric: fmtCurrency(mostRevenue.revenue), ad: mostRevenue });
  }

  return champs;
}

function ChampionCards({ ads, mode }: { ads: SpartacoMetaAd[]; mode: SpartacoCreativeMode }) {
  const champs = pickChampions(ads, mode);

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
          {champs.map((c) => {
            const hasImage = Boolean(c.ad.finalCreativeLink && c.ad.finalCreativeLink !== 'null');
            return (
              <div key={c.label} className="rounded-2xl border border-gray-100 overflow-hidden bg-white">
                <div className="h-32 bg-gray-100 relative overflow-hidden">
                  {hasImage ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={c.ad.finalCreativeLink} alt={c.ad.adName} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300">
                      <ImageIcon className="w-8 h-8" />
                    </div>
                  )}
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
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Per-account block ────────────────────────────────────────────────────────

function BrandBlock({
  block,
  mode,
  verdict,
}: {
  block: SpartacoCreativeBrandBlock;
  mode: SpartacoCreativeMode;
  verdict: string;
}) {
  const label = BRAND_LABELS[block.brand] ?? block.brand;
  const hasAds = block.ads.length > 0;

  const creatives = block.ads.map((ad) => toMetaCreative(ad, mode));

  return (
    <section className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-8 w-1.5 rounded-full bg-brand-forest" />
        <h2 className="text-2xl font-bold text-brand-dark tracking-tight">{label}</h2>
        <span className="text-sm text-gray-400 font-medium">
          {hasAds ? `${block.ads.length} ads` : 'No data'}
        </span>
      </div>

      {!hasAds ? (
        <div className="rounded-[2rem] border border-dashed border-gray-200 bg-white px-8 py-10 text-center">
          <p className="text-sm text-gray-400">
            No {mode === 'LEAD' ? 'lead' : 'sales'} Meta ads for {label} in this period. Try a wider date range
            {mode === 'SALES' ? ' or switch to Leads.' : '.'}
          </p>
        </div>
      ) : (
        <>
          <KpiStrip block={block} mode={mode} />
          {verdict && <BrandVerdictCard verdict={verdict} />}
          <ChampionCards ads={block.ads} mode={mode} />
          <MetaAdPreviews
            creatives={creatives}
            title={`${label} — Meta Ad Creatives`}
            advertiserName={label}
            metricMode={mode === 'SALES' ? 'sales' : 'leads'}
            conversionLabel={mode === 'LEAD' ? { conversion: 'Leads', cpa: 'CPL' } : { conversion: 'Sales', cpa: 'CPA' }}
          />
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
          <p className="text-gray-500 mt-1">Creative-level Meta performance across Jameson, Ruski &amp; Ronin</p>
        </div>

        <SpartacoFilterBar
          mode={data.mode}
          options={{ brands: ['Jameson', 'Huskie', 'Ronin'], channels: [], focuses: [], campaigns: [] }}
          initialParams={data.params}
          currentTab="creatives"
        />

        <ModeToggle data={data} />
      </div>

      <CopywriterNoteCard note={data.insight.copywriterNote} asOf={data.insight.asOf} />

      {data.brands.map((block) => (
        <BrandBlock key={block.brand} block={block} mode={data.mode} verdict={data.insight.brandVerdicts[block.brand] ?? ''} />
      ))}
    </div>
  );
}
