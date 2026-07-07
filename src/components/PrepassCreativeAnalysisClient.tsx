'use client';

import React, { useState } from 'react';
import {
  Sparkles,
  Trophy,
  DollarSign,
  Eye,
  MousePointer2,
  Target,
  Award,
  Image as ImageIcon,
  AlertCircle,
} from 'lucide-react';
import FilterBar from '@/components/FilterBar';
import { MetaAdPreviews, GoogleAdPreviews } from '@/components/AdPreviews';
import { cn, fmtNumber, fmtCurrency, fmtPercent, fmtCompact, fmtMoneyPrecise } from '@/lib/utils';
import type { MetaCreative, PrepassCreativeAnalysis, PrepassCreativeFocusBlock, PrepassFocusAiInsight, PrepassImageCreative } from '@/services/analytics';

const MIN_CHAMPION_SPEND = 200;

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

// ─── AI insight card ────────────────────────────────────────────────────────

function fmtAsOf(iso: string) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function VisionInsightHeader({ asOf }: { asOf: string }) {
  return (
    <div className="rounded-[2rem] border border-gray-100 bg-white shadow-sm overflow-hidden">
      <div className="flex items-center justify-between gap-4 px-8 py-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-brand-forest/10 text-brand-forest">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-brand-dark">AI Creative Insights</h3>
            <p className="text-sm text-gray-400 font-medium mt-0.5">
              Generated daily by analyzing the actual ad creatives — images &amp; video frames — from the last 30 days. See each focus below.
            </p>
          </div>
        </div>
        {asOf && <span className="text-xs font-medium text-gray-400 shrink-0">as of {fmtAsOf(asOf)}</span>}
      </div>
    </div>
  );
}

function FocusAiInsightCard({ ai }: { ai: PrepassFocusAiInsight }) {
  return (
    <div className="rounded-2xl border border-brand-forest/15 bg-brand-forest/[0.03] p-5 space-y-4">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-brand-forest">
        <Sparkles className="h-3.5 w-3.5" />
        AI Creative Insight
        {ai.adsAnalyzed > 0 && (
          <span className="font-medium normal-case tracking-normal text-gray-400">
            · {ai.adsAnalyzed} creative{ai.adsAnalyzed === 1 ? '' : 's'} analyzed
          </span>
        )}
      </div>

      {ai.summary && <p className="text-sm font-semibold leading-6 text-brand-dark">{ai.summary}</p>}

      {ai.videoVsImage && (
        <div className="flex gap-2 text-sm leading-6 text-gray-700">
          <ImageIcon className="mt-1 h-3.5 w-3.5 shrink-0 text-brand-forest" />
          <span><span className="font-semibold">Video vs Image:</span> {ai.videoVsImage}</span>
        </div>
      )}

      {ai.whatWorks.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-bold uppercase tracking-wider text-gray-500">What&apos;s working</p>
          <div className="space-y-1.5">
            {ai.whatWorks.map((it, i) => (
              <div key={i} className="flex gap-2 text-sm leading-6 text-gray-700">
                <span className="mt-2 h-1.5 w-1.5 rounded-full shrink-0 bg-brand-forest" />
                <span>
                  <span className="font-medium text-brand-dark">{it.point}</span>
                  {it.evidence ? <span className="text-gray-500"> — {it.evidence}</span> : null}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {ai.improvements.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-bold uppercase tracking-wider text-gray-500">Improvements to test</p>
          <div className="space-y-1.5">
            {ai.improvements.map((it, i) => (
              <div key={i} className="flex gap-2 text-sm leading-6 text-gray-700">
                <span className="mt-2 h-1.5 w-1.5 rounded-full shrink-0 bg-brand-orange" />
                <span>
                  <span className="font-medium text-brand-dark">{it.point}</span>
                  {it.why ? <span className="text-gray-500"> — {it.why}</span> : null}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {ai.nextCreativeBrief && (
        <div className="rounded-xl bg-white border border-brand-forest/10 p-4">
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-brand-forest">Creative director brief</p>
          <div className="space-y-2 text-sm leading-6 text-gray-700">
            {ai.nextCreativeBrief.split('\n').filter(Boolean).map((line, i) => {
              const [label, ...rest] = line.split(': ');
              const body = rest.join(': ');
              return body ? (
                <p key={i}>
                  <span className="font-semibold text-brand-dark">{label}:</span>{' '}
                  <span>{body}</span>
                </p>
              ) : (
                <p key={i}>{line}</p>
              );
            })}
          </div>
        </div>
      )}

      {ai.nextTests.length > 0 && (
        <div className="rounded-xl bg-white border border-gray-100 p-4">
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-brand-forest">Creatives to test next</p>
          <ol className="space-y-2">
            {ai.nextTests.map((t, i) => (
              <li key={i} className="flex gap-2.5 text-sm leading-6 text-gray-700">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-forest text-[11px] font-bold text-white">
                  {i + 1}
                </span>
                <span>
                  <span className="font-semibold text-brand-dark">{t.title}</span>
                  {t.why ? <span className="text-gray-500"> — {t.why}</span> : null}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

// ─── Champion (top performer) cards ──────────────────────────────────────────

type Champion = { label: string; metric: string; ad: MetaCreative };

function ctrOf(ad: MetaCreative) {
  return ad.impressions > 0 ? ad.clicks / ad.impressions : 0;
}
function cpMqlOf(ad: MetaCreative) {
  return (ad.mqls ?? 0) > 0 ? ad.spend / (ad.mqls ?? 0) : 0;
}

function pickChampions(ads: MetaCreative[]): Champion[] {
  const eligible = ads.filter((a) => a.spend >= MIN_CHAMPION_SPEND);
  if (eligible.length === 0) return [];

  const best = (pool: MetaCreative[], cmp: (a: MetaCreative, b: MetaCreative) => number) =>
    pool.length ? [...pool].sort(cmp)[0] : null;

  const champs: Champion[] = [];

  const cpMqlPool = eligible.filter((a) => cpMqlOf(a) > 0);
  const bestCpMql = best(cpMqlPool, (a, b) => cpMqlOf(a) - cpMqlOf(b));
  if (bestCpMql) champs.push({ label: 'Best Cost / MQL', metric: fmtMoneyPrecise(cpMqlOf(bestCpMql)), ad: bestCpMql });

  const mostMqls = best(eligible.filter((a) => (a.mqls ?? 0) > 0), (a, b) => (b.mqls ?? 0) - (a.mqls ?? 0));
  if (mostMqls) champs.push({ label: 'Most MQLs', metric: `${fmtNumber(mostMqls.mqls ?? 0)} MQLs`, ad: mostMqls });

  const bestCtr = best(eligible.filter((a) => ctrOf(a) > 0), (a, b) => ctrOf(b) - ctrOf(a));
  if (bestCtr) champs.push({ label: 'Best CTR', metric: fmtPercent(ctrOf(bestCtr)), ad: bestCtr });

  return champs;
}

function hasImg(link: string) {
  return Boolean(link && link !== 'null' && link !== 'undefined');
}

function ChampionThumb({ ad }: { ad: MetaCreative }) {
  const [err, setErr] = useState(false);
  const showImage = hasImg(ad.finalCreativeLink) && !err;
  return (
    <div className="h-44 bg-gray-50 relative overflow-hidden flex items-center justify-center">
      {showImage ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={ad.finalCreativeLink}
          alt={ad.name}
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

function ChampionCards({ ads }: { ads: MetaCreative[] }) {
  const champs = pickChampions(ads);

  return (
    <div className="rounded-[2rem] border border-gray-100 bg-white shadow-sm overflow-hidden">
      <div className="px-8 py-6 border-b border-gray-50 flex items-center gap-3">
        <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
          <Trophy className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-brand-dark">Evidence: Top Ads Behind the Insights</h3>
          <p className="text-sm text-gray-400 font-medium mt-0.5">
            The strongest performance proof points from the ads analyzed above · minimum {fmtCurrency(MIN_CHAMPION_SPEND)} spend
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
                <p className="text-sm font-semibold text-brand-dark line-clamp-1 mt-1" title={c.ad.name}>
                  {c.ad.name || c.ad.headline || 'Untitled ad'}
                </p>
                <p className="text-xs text-gray-400 line-clamp-1 mt-0.5">{c.ad.campaign}</p>
                <p className="text-xs text-gray-400 mt-1">{fmtCurrency(c.ad.spend)} spend</p>
              </div>
            </div>
          ))}
        </div>
      )}
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
              <KpiStrip block={block} />
              {ai && ai.hasData && <FocusAiInsightCard ai={ai} />}
              <ChampionCards ads={block.ads} />
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
          <GoogleAdPreviews creatives={block.googleAds} title={`${label} — Google Search Ads`} />
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

      {Object.keys(data.aiInsights).length > 0 && (
        <VisionInsightHeader
          asOf={Object.values(data.aiInsights)
            .map((a) => a.asOf)
            .filter(Boolean)
            .sort()
            .pop() ?? ''}
        />
      )}

      {data.focuses.map((block) => (
        <FocusBlock key={block.focus} block={block} ai={data.aiInsights[block.focus]} />
      ))}
    </div>
  );
}
