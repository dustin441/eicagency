'use client';

import React, { useState } from 'react';
import {
  Sparkles,
  DollarSign,
  Eye,
  MousePointer2,
  Target,
  Search as SearchIcon,
  Image as ImageIcon,
  LayoutGrid,
  Info,
  Swords,
  ExternalLink,
  Lightbulb,
} from 'lucide-react';
import { GoogleAdPreviews } from '@/components/AdPreviews';
import { cn, fmtNumber, fmtCurrency, fmtPercent, fmtCompact, fmtMoneyPrecise } from '@/lib/utils';
import type {
  NsiCreativeAnalysis,
  NsiCreativeKpis,
  NsiImageCreative,
  NsiChannelInsight,
  NsiPmaxTextAsset,
  NsiCompetitorAd,
  NsiCompetitorIntel,
} from '@/services/nsi-creative-analytics';

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

function fmtAsOf(iso: string) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
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

function KpiStrip({ kpis, spendLabel = 'Spend' }: { kpis: NsiCreativeKpis; spendLabel?: string }) {
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

// ─── AI insight card ─────────────────────────────────────────────────────────

function ChannelInsightCard({ ai }: { ai: NsiChannelInsight }) {
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
                  <span className="font-semibold text-brand-dark">{label}:</span> <span>{body}</span>
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

// ─── Image creative cards (Display / PMax) ───────────────────────────────────

function ImageCreativeCard({ c, showCopy }: { c: NsiImageCreative; showCopy?: boolean }) {
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

function ImageGrid({ creatives, showCopy }: { creatives: NsiImageCreative[]; showCopy?: boolean }) {
  if (creatives.length === 0) return null;
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
      {creatives.map((c) => (
        <ImageCreativeCard key={c.id} c={c} showCopy={showCopy} />
      ))}
    </div>
  );
}

function PmaxTextAssets({ assets }: { assets: NsiPmaxTextAsset[] }) {
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

// ─── Competitor ad intelligence ──────────────────────────────────────────────

function CompetitorAdCard({ ad }: { ad: NsiCompetitorAd }) {
  const [broken, setBroken] = useState(false);
  const showImg = ad.imageUrl && !broken;
  return (
    <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden flex flex-col">
      {/* Creative preview */}
      <div
        className="relative aspect-square bg-gray-50 flex items-center justify-center"
        style={showImg ? undefined : { background: gradientFor(ad.competitor || ad.headline) }}
      >
        {showImg ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={ad.imageUrl}
            alt={ad.headline || ad.competitor}
            className="w-full h-full object-cover"
            onError={() => setBroken(true)}
          />
        ) : (
          <ImageIcon className="w-10 h-10 text-white/70" />
        )}
        <span className="absolute top-2 left-2 max-w-[70%] truncate text-[10px] font-bold uppercase tracking-wider bg-black/55 text-white px-2 py-0.5 rounded-full">
          {ad.competitor || 'Competitor'}
        </span>
        {ad.relevanceScore > 0 && (
          <span className="absolute top-2 right-2 text-[10px] font-bold bg-brand-orange text-white px-2 py-0.5 rounded-full">
            {ad.relevanceScore}/100 fit
          </span>
        )}
        {ad.adFormat && (
          <span className="absolute bottom-2 left-2 text-[10px] font-medium uppercase tracking-wider bg-white/85 text-brand-dark px-2 py-0.5 rounded-full">
            {ad.adFormat}
          </span>
        )}
        {ad.daysRunning > 0 && (
          <span className="absolute bottom-2 right-2 text-[10px] font-bold uppercase tracking-wider bg-brand-forest/90 text-white px-2 py-0.5 rounded-full">
            Running {ad.daysRunning}d
          </span>
        )}
      </div>

      <div className="p-4 space-y-3 flex-1 flex flex-col">
        {/* Headline + body */}
        {ad.headline && <p className="text-sm font-semibold text-brand-dark leading-5" title={ad.headline}>{ad.headline}</p>}
        {ad.body && <p className="text-xs text-gray-500 line-clamp-2" title={ad.body}>{ad.body}</p>}

        {/* AI critique */}
        <div className="space-y-2.5 pt-1">
          {ad.visualAnalysis && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-brand-forest flex items-center gap-1">
                <ImageIcon className="w-3 h-3" /> Graphic
              </p>
              <p className="text-xs leading-5 text-gray-700">{ad.visualAnalysis}</p>
            </div>
          )}
          {ad.headlineAnalysis && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-brand-forest flex items-center gap-1">
                <Target className="w-3 h-3" /> Headline
              </p>
              <p className="text-xs leading-5 text-gray-700">{ad.headlineAnalysis}</p>
            </div>
          )}
          {ad.recommendation && (
            <div className="rounded-xl bg-brand-orange/[0.06] border border-brand-orange/15 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-brand-orange flex items-center gap-1">
                <Lightbulb className="w-3 h-3" /> Use as reference
              </p>
              <p className="text-xs leading-5 text-gray-700 mt-0.5">{ad.recommendation}</p>
            </div>
          )}
        </div>

        {ad.landingPageUrl && (
          <a
            href={ad.landingPageUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-auto inline-flex items-center gap-1 text-[11px] font-semibold text-brand-forest hover:underline pt-1"
          >
            <ExternalLink className="w-3 h-3" /> Landing page
          </a>
        )}
      </div>
    </div>
  );
}

function CompetitorSection({ intel, summary }: { intel: NsiCompetitorIntel; summary?: NsiChannelInsight }) {
  return (
    <section className="space-y-6">
      <SectionHeader
        icon={Swords}
        title="Competitor Ad Intelligence"
        subtitle={intel.hasData ? `${intel.analyzed} relevant competitor ad${intel.analyzed === 1 ? '' : 's'}` : 'no relevant ads yet'}
      />
      <p className="text-sm text-gray-500 -mt-2 max-w-3xl">
        AI-vetted competitor creatives that match what NSI offers. Each is reviewed purely on its{' '}
        <span className="font-medium text-brand-dark">graphic execution</span> and{' '}
        <span className="font-medium text-brand-dark">headline</span> — use them as creative reference, not as a metric.
      </p>
      {summary?.hasData && <ChannelInsightCard ai={summary} />}
      {!intel.hasData ? (
        <div className="rounded-[2rem] border border-dashed border-gray-200 bg-white px-8 py-10 text-center">
          <p className="text-sm text-gray-400">
            No relevant competitor ads surfaced yet. The daily analysis filters scraped competitor ads down to the ones
            that match what NSI offers.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {intel.ads.map((ad) => (
            <CompetitorAdCard key={ad.id} ad={ad} />
          ))}
        </div>
      )}
    </section>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NsiCreativeAnalysisClient({ data }: { data: NsiCreativeAnalysis }) {
  const { search, display, pmax, insights, competitors } = data;

  return (
    <div className="space-y-10 max-w-7xl mx-auto pb-20">
      <div>
        <h1 className="text-3xl font-bold text-brand-dark tracking-tight">NSI — Ad Analysis</h1>
        <p className="text-gray-500 mt-1">
          Creative-level Google Ads performance across Search, Display &amp; Performance Max
        </p>
      </div>

      {/* AI header */}
      <div className="rounded-[2rem] border border-gray-100 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between gap-4 px-8 py-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-brand-forest/10 text-brand-forest">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-brand-dark">AI Creative Insights</h3>
              <p className="text-sm text-gray-400 font-medium mt-0.5">
                Generated daily by analyzing the actual ad creatives — images &amp; copy — from the last{' '}
                {data.periodDays} days. See each channel below.
              </p>
            </div>
          </div>
          {data.asOf && <span className="text-xs font-medium text-gray-400 shrink-0">as of {fmtAsOf(data.asOf)}</span>}
        </div>
      </div>

      {/* Search */}
      <section className="space-y-6">
        <SectionHeader icon={SearchIcon} title="Search" subtitle={`${search.google.length} responsive search ads`} />
        {search.google.length === 0 ? (
          <EmptyState label="Search" />
        ) : (
          <>
            <KpiStrip kpis={search.kpis} />
            {insights.Search?.hasData && <ChannelInsightCard ai={insights.Search} />}
            <GoogleAdPreviews creatives={search.google} title="NSI — Google Search Ads" />
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
            {insights.Display?.hasData && <ChannelInsightCard ai={insights.Display} />}
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
            {insights.PMax?.hasData && <ChannelInsightCard ai={insights.PMax} />}
            <ImageGrid creatives={pmax.creatives} />
            <PmaxTextAssets assets={pmax.textAssets} />
          </>
        )}
      </section>

      {/* Competitor Ad Intelligence */}
      <CompetitorSection intel={competitors} summary={insights.Competitors} />
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
