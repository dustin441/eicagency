'use client';

import React, { useMemo, useState } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  DollarSign, MousePointerClick, Percent, Target, TrendingUp, Trophy,
  Sparkles, Search, Image as ImageIcon, LayoutGrid, Filter, AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import FilterBar from '@/components/FilterBar';
import { MetaAdPreviews } from '@/components/AdPreviews';
import type {
  PrepassCreativeAnalysis, MetaCreative, GoogleSearchAd, GoogleDisplayAd, CreativeInsight,
} from '@/services/analytics';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt$(n: number) { return `$${Math.round(n).toLocaleString()}`; }
function fmt$2(n: number) { return `$${n.toFixed(2)}`; }
function fmtN(n: number) { return Math.round(n).toLocaleString(); }
function ctrFmt(clicks: number, impr: number) { return impr > 0 ? `${((clicks / impr) * 100).toFixed(2)}%` : '—'; }
function perUnit(spend: number, units: number) { return units > 0 ? fmt$(spend / units) : '—'; }

const MIN_CHAMPION_SPEND = 500;

const FOCUS_OPTIONS = [
  { value: 'all', label: 'All Segments' },
  { value: 'SMB', label: 'SMB' },
  { value: 'ABM', label: 'ABM' },
  { value: 'FD360', label: 'FD360' },
];

// "By Campaign" view: condense the same creative (same ad name) that is duplicated
// across ad sets within a campaign into one card, keyed by (campaign + ad name).
// Input is pre-sorted by spend desc, so the first row per key is the highest-spend
// variant and supplies the preview image/copy.
function aggregateByCampaign(ads: MetaCreative[]): MetaCreative[] {
  const map = new Map<string, MetaCreative & { _count: number }>();
  for (const a of ads) {
    const key = `${a.campaign}||${(a.name || a.adId || '').trim() || '(unnamed)'}`;
    const e = map.get(key);
    if (!e) {
      map.set(key, { ...a, _count: 1 });
    } else {
      e.spend += a.spend; e.leads += a.leads; e.clicks += a.clicks; e.impressions += a.impressions;
      e.mqls = (e.mqls ?? 0) + (a.mqls ?? 0);
      e.sqls = (e.sqls ?? 0) + (a.sqls ?? 0);
      e.won = (e.won ?? 0) + (a.won ?? 0);
      e._count += 1;
      if ((!e.finalCreativeLink || e.finalCreativeLink === 'null') && a.finalCreativeLink) e.finalCreativeLink = a.finalCreativeLink;
    }
  }
  return Array.from(map.values())
    .map(({ _count, ...rest }) => ({
      ...rest,
      adset: _count > 1 ? `${_count} ad sets (aggregated)` : rest.adset,
    }))
    .sort((a, b) => b.spend - a.spend);
}

// ─── KPI strip ────────────────────────────────────────────────────────────────

function Kpi({ label, value, icon: Icon, accent, northStar }: {
  label: string; value: string; icon: React.ComponentType<{ className?: string }>;
  accent?: boolean; northStar?: boolean;
}) {
  return (
    <div className={cn(
      'bg-white p-5 rounded-2xl border shadow-sm flex flex-col gap-2',
      northStar ? 'border-brand-forest/30' : 'border-gray-100',
    )}>
      <div className="flex items-center justify-between">
        <div className={cn('p-1.5 rounded-lg bg-gray-50', accent ? 'text-brand-forest' : 'text-gray-400')}>
          <Icon className="w-4 h-4" />
        </div>
        {northStar && (
          <span className="text-[9px] font-bold uppercase tracking-widest text-brand-forest bg-brand-forest/10 px-1.5 py-0.5 rounded-full">North Star</span>
        )}
      </div>
      <div className="text-xl font-bold text-brand-dark tabular-nums">{value}</div>
      <div className={cn('text-[10px] font-bold uppercase tracking-widest', northStar ? 'text-brand-forest' : 'text-gray-400')}>{label}</div>
    </div>
  );
}

// ─── AI Insight callout ───────────────────────────────────────────────────────

// Lightly render the deep-dive markdown-ish text: bullets + emphasis stripped.
function InsightBody({ text }: { text: string }) {
  const clean = (s: string) => s.replace(/\*\*(.+?)\*\*/g, '$1').replace(/\*(.+?)\*/g, '$1');
  const lines = text.split('\n');
  return (
    <div className="space-y-1.5 text-sm leading-relaxed">
      {lines.map((raw, i) => {
        const line = raw.trimEnd();
        if (!line.trim()) return <div key={i} className="h-1" />;
        if (/^#{1,6}\s/.test(line)) {
          return <p key={i} className="font-bold text-brand-dark mt-2">{clean(line.replace(/^#{1,6}\s/, ''))}</p>;
        }
        if (/^\s*[•\-]\s/.test(line)) {
          return (
            <div key={i} className="flex gap-2 pl-1">
              <span className="text-brand-orange shrink-0">•</span>
              <span className="text-gray-700">{clean(line.replace(/^\s*[•\-]\s/, ''))}</span>
            </div>
          );
        }
        return <p key={i} className="text-gray-700">{clean(line)}</p>;
      })}
    </div>
  );
}

// Two differentiated, non-duplicated blocks. Meta = image-vs-video verdict + Meta
// common traits/tests; Google = Search copy themes/tests. The "best ads" lists are
// intentionally omitted — those are visible in the previews below.
function InsightCallout({ insight, scope }: { insight: CreativeInsight | null; scope: 'meta' | 'google' }) {
  if (!insight) return null;
  const isMeta = scope === 'meta';
  const verdict = isMeta ? insight.metaFormatVerdict : '';
  const tests = isMeta ? insight.metaTests : insight.googleTests;
  // Meta falls back to raw only on a total parse failure; Google never does, so the
  // full blob is never shown twice.
  const fallback = isMeta && !verdict && !tests ? insight.raw : '';
  if (!verdict && !tests && !fallback) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-br from-brand-forest to-[#0a3a27] text-white rounded-[2rem] p-7 shadow-sm"
    >
      <div className="flex items-center gap-2.5 mb-4">
        <div className="p-2 rounded-xl bg-white/10">
          <Sparkles className="w-5 h-5 text-brand-orange" />
        </div>
        <div>
          <h3 className="text-lg font-bold leading-tight">AI Creative Insights — {isMeta ? 'Meta' : 'Google'}</h3>
          <p className="text-[11px] text-white/50 font-medium">
            From the PrePass Creative Deep Dive{insight.generatedAt ? ` · ${new Date(insight.generatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : ''}
          </p>
        </div>
      </div>
      <div className="bg-white/95 text-gray-800 rounded-2xl p-5 space-y-4">
        {verdict && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-brand-orange mb-2">Winning format — Image vs Video</p>
            <InsightBody text={verdict} />
          </div>
        )}
        {tests && (
          <div className={cn(verdict && 'pt-4 border-t border-gray-100')}>
            <p className="text-[10px] font-bold uppercase tracking-widest text-brand-orange mb-2">
              {isMeta ? 'What top ads have in common & what to test' : 'Search copy themes & what to test'}
            </p>
            <InsightBody text={tests} />
          </div>
        )}
        {fallback && <InsightBody text={fallback} />}
      </div>
    </motion.div>
  );
}

// ─── Champion (best-by-metric) preview cards ──────────────────────────────────

type ChampionMetric = { id: string; label: string; count: (a: MetaCreative) => number; countLabel: string };

const CHAMPION_METRICS: ChampionMetric[] = [
  { id: 'cpl',   label: 'Best CPL',       count: a => a.leads,       countLabel: 'Leads' },
  { id: 'cpmql', label: 'Best Cost / MQL', count: a => a.mqls ?? 0,  countLabel: 'MQLs' },
  { id: 'cpsql', label: 'Best Cost / SQL', count: a => a.sqls ?? 0,  countLabel: 'SQLs' },
  { id: 'cpwon', label: 'Best Cost / Won', count: a => a.won ?? 0,   countLabel: 'Won' },
];

type Champion = { metric: ChampionMetric; ad: MetaCreative; costPer: number; count: number };

function ChampionCard({ champ }: { champ: Champion }) {
  const { ad, costPer, count, metric } = champ;
  const hasImage = Boolean(ad.finalCreativeLink && ad.finalCreativeLink !== 'null' && ad.finalCreativeLink !== 'undefined');
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl border border-brand-forest/20 shadow-sm overflow-hidden flex flex-col hover:shadow-lg transition-shadow"
    >
      <div className="flex items-center gap-1.5 px-4 py-2 bg-brand-forest text-white">
        <Trophy className="w-3.5 h-3.5 text-brand-orange" />
        <span className="text-[11px] font-bold uppercase tracking-widest">{metric.label}</span>
      </div>
      <div className="w-full bg-[#f0f0f0] flex items-center justify-center overflow-hidden" style={{ minHeight: 120 }}>
        {hasImage ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={ad.finalCreativeLink} alt={ad.name} className="w-full h-auto block" style={{ maxHeight: '200px', objectFit: 'contain' }} />
        ) : (
          <div className="w-full flex items-center justify-center p-6 text-center" style={{ minHeight: 120, background: 'linear-gradient(135deg, #0B4A31 0%, #0a3a27 100%)' }}>
            <p className="text-white text-sm font-semibold line-clamp-3">{ad.headline || ad.name || 'Ad creative'}</p>
          </div>
        )}
      </div>
      <div className="px-4 py-2.5 border-t border-gray-100">
        <p className="text-xs font-bold text-gray-900 line-clamp-1" title={ad.name}>{ad.name || '(unnamed ad)'}</p>
        <p className="text-[10px] text-gray-400 line-clamp-1 mt-0.5">{ad.campaign}</p>
      </div>
      <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 flex items-end justify-between">
        <div>
          <p className="text-2xl font-bold text-brand-forest tabular-nums leading-none">{fmt$2(costPer)}</p>
          <p className="text-[10px] text-gray-400 font-medium mt-1">{fmtN(count)} {metric.countLabel} · {fmt$(ad.spend)} spent</p>
        </div>
        {ad.isVideo && <span className="text-[9px] font-bold uppercase tracking-widest text-gray-400">Video</span>}
      </div>
    </motion.div>
  );
}

function ChampionSection({ ads }: { ads: MetaCreative[] }) {
  const eligible = ads.filter(a => a.spend >= MIN_CHAMPION_SPEND);
  const champions: Champion[] = [];
  if (eligible.length > 0) {
    for (const metric of CHAMPION_METRICS) {
      const pool = eligible.filter(a => metric.count(a) > 0);
      if (pool.length === 0) continue; // no conversions of this type in the period → skip card
      const best = pool.reduce((b, a) => (a.spend / metric.count(a) < b.spend / metric.count(b) ? a : b));
      champions.push({ metric, ad: best, costPer: best.spend / metric.count(best), count: metric.count(best) });
    }
  }

  return (
    <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
      <div className="p-8 border-b border-gray-50 flex items-center gap-3">
        <div className="p-2.5 rounded-2xl bg-gray-50 text-brand-forest"><Trophy className="w-5 h-5" /></div>
        <div>
          <h3 className="text-xl font-bold text-[#0f172a]">Top Performers by Cost</h3>
          <p className="text-sm text-gray-400 font-medium mt-0.5">Best ad per funnel stage · ads with {fmt$(MIN_CHAMPION_SPEND)}+ spend only</p>
        </div>
      </div>
      {eligible.length === 0 ? (
        <div className="p-12 flex flex-col items-center justify-center text-center gap-3">
          <div className="p-3 rounded-2xl bg-amber-50 text-amber-500"><AlertCircle className="w-7 h-7" /></div>
          <p className="text-sm text-gray-500 font-medium max-w-md">
            No ads have reached {fmt$(MIN_CHAMPION_SPEND)} in spend for this segment and date range. Widen the date range to surface top performers.
          </p>
        </div>
      ) : (
        <div className="p-8 grid sm:grid-cols-2 xl:grid-cols-4 gap-6">
          {champions.map(c => <ChampionCard key={c.metric.id} champ={c} />)}
        </div>
      )}
    </div>
  );
}

// ─── Google Search SERP mockup ────────────────────────────────────────────────

function GoogleSearchCard({ ad, totalSpend, rank }: { ad: GoogleSearchAd; totalSpend: number; rank: number }) {
  const cpc = ad.clicks > 0 ? ad.spend / ad.clicks : 0;
  const title = ad.headlines.slice(0, 3).join(' | ') || 'PrePass';
  const desc = ad.descriptions.slice(0, 2).join(' ');
  const spendPct = totalSpend > 0 ? ((ad.spend / totalSpend) * 100).toFixed(0) : '0';

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col hover:shadow-lg transition-shadow"
    >
      <div className="p-5 flex-1">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-[#0B4A31] flex items-center justify-center shrink-0">
              <span className="text-white font-black text-[8px]">PP</span>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-800 leading-none">PrePass</p>
              <p className="text-[10px] text-gray-400 leading-none mt-0.5">https://www.prepass.com</p>
            </div>
          </div>
          {rank <= 3 && (
            <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              <Trophy className="w-3 h-3" /> #{rank} spend
            </span>
          )}
        </div>

        <div className="flex items-start gap-2 mb-1.5">
          <span className="shrink-0 mt-0.5 text-[10px] font-bold border border-[#1a7f37] text-[#1a7f37] px-1.5 py-px rounded leading-none">Ad</span>
          <h3 className="text-[15px] text-[#1558d6] leading-snug font-normal hover:underline cursor-pointer">{title}</h3>
        </div>
        <p className="text-sm text-gray-600 leading-snug mb-3">{desc || '—'}</p>

        {/* All populated assets so copywriters can see every headline/description */}
        {ad.headlines.length > 0 && (
          <div className="mb-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Headlines ({ad.headlines.length})</p>
            <div className="flex flex-wrap gap-1">
              {ad.headlines.map((h, i) => (
                <span key={i} className="text-[11px] text-gray-600 bg-gray-50 border border-gray-100 rounded-full px-2 py-0.5">{h}</span>
              ))}
            </div>
          </div>
        )}
        {ad.descriptions.length > 0 && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Descriptions ({ad.descriptions.length})</p>
            <ul className="space-y-0.5">
              {ad.descriptions.map((d, i) => (
                <li key={i} className="text-[11px] text-gray-500 leading-snug">• {d}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="px-5 pb-2 border-t border-gray-50 pt-2">
        <span className="text-[11px] text-gray-400 font-medium line-clamp-1">{ad.campaign}</span>
      </div>
      <div className="grid grid-cols-4 divide-x divide-gray-100 border-t border-gray-100">
        <div className="flex flex-col items-center py-2.5 px-1">
          <span className="text-sm font-bold text-[#0f172a] tabular-nums">{fmt$(ad.spend)}</span>
          <span className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider mt-0.5">Spend</span>
          <span className="text-[10px] text-gray-400 mt-0.5">{spendPct}% of total</span>
        </div>
        <div className="flex flex-col items-center py-2.5 px-1">
          <span className="text-sm font-bold text-[#0f172a] tabular-nums">{fmtN(ad.clicks)}</span>
          <span className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider mt-0.5">Clicks</span>
        </div>
        <div className="flex flex-col items-center py-2.5 px-1">
          <span className="text-sm font-bold text-[#0f172a] tabular-nums">{cpc > 0 ? fmt$(cpc) : '—'}</span>
          <span className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider mt-0.5">CPC</span>
        </div>
        <div className="flex flex-col items-center py-2.5 px-1">
          <span className="text-sm font-bold text-[#0f172a] tabular-nums">{ctrFmt(ad.clicks, ad.impressions)}</span>
          <span className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider mt-0.5">CTR</span>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Google Display image card ────────────────────────────────────────────────

function GoogleDisplayCard({ ad }: { ad: GoogleDisplayAd }) {
  const cpc = ad.clicks > 0 ? ad.spend / ad.clicks : 0;
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col hover:shadow-lg transition-shadow"
    >
      <div className="w-full bg-[#f0f0f0] flex items-center justify-center overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={ad.imageUrl} alt={ad.adName} className="w-full h-auto block" style={{ maxHeight: '280px', objectFit: 'contain' }} />
      </div>
      <div className="px-4 py-2.5 border-t border-gray-100">
        <p className="text-xs font-bold text-gray-900 line-clamp-1">{ad.adName || 'Display ad'}</p>
        <p className="text-[10px] text-gray-400 line-clamp-1 mt-0.5">{ad.campaign}</p>
      </div>
      <div className="grid grid-cols-4 divide-x divide-gray-100 border-t border-gray-100">
        <div className="flex flex-col items-center py-2.5 px-1">
          <span className="text-sm font-bold text-[#0f172a] tabular-nums">{fmt$(ad.spend)}</span>
          <span className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider mt-0.5">Spend</span>
        </div>
        <div className="flex flex-col items-center py-2.5 px-1">
          <span className="text-sm font-bold text-[#0f172a] tabular-nums">{fmtN(ad.clicks)}</span>
          <span className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider mt-0.5">Clicks</span>
        </div>
        <div className="flex flex-col items-center py-2.5 px-1">
          <span className="text-sm font-bold text-[#0f172a] tabular-nums">{cpc > 0 ? fmt$(cpc) : '—'}</span>
          <span className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider mt-0.5">CPC</span>
        </div>
        <div className="flex flex-col items-center py-2.5 px-1">
          <span className="text-sm font-bold text-[#0f172a] tabular-nums">{ctrFmt(ad.clicks, ad.impressions)}</span>
          <span className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider mt-0.5">CTR</span>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Section shell ────────────────────────────────────────────────────────────

function SectionCard({ title, subtitle, icon: Icon, children }: {
  title: string; subtitle?: string; icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
      <div className="p-8 border-b border-gray-50 flex items-center gap-3">
        <div className="p-2.5 rounded-2xl bg-gray-50 text-brand-forest"><Icon className="w-5 h-5" /></div>
        <div>
          <h3 className="text-xl font-bold text-[#0f172a]">{title}</h3>
          {subtitle && <p className="text-sm text-gray-400 font-medium mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

function EmptyState({ icon: Icon, message }: { icon: React.ComponentType<{ className?: string }>; message: string }) {
  return (
    <div className="p-12 flex flex-col items-center justify-center text-center gap-3">
      <div className="p-3 rounded-2xl bg-gray-50 text-gray-300"><Icon className="w-7 h-7" /></div>
      <p className="text-sm text-gray-400 font-medium max-w-md">{message}</p>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function CreativeAnalysisClient({ data }: { data: PrepassCreativeAnalysis }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [groupByCampaign, setGroupByCampaign] = useState(false);

  const focus = data.focus || 'all';

  const setFocus = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === 'all') params.delete('focus'); else params.set('focus', value);
    router.push(`${pathname}?${params.toString()}`);
  };

  // Meta cards respect the group-by toggle; KPI totals + champions do not change.
  const metaForCards = useMemo(
    () => (groupByCampaign ? aggregateByCampaign(data.metaAds) : data.metaAds),
    [data.metaAds, groupByCampaign],
  );

  // ── Meta KPI totals ──
  const m = useMemo(() => data.metaAds.reduce((acc, a) => {
    acc.spend += a.spend; acc.clicks += a.clicks; acc.impressions += a.impressions;
    acc.mqls += a.mqls ?? 0; acc.sqls += a.sqls ?? 0; acc.won += a.won ?? 0;
    return acc;
  }, { spend: 0, clicks: 0, impressions: 0, mqls: 0, sqls: 0, won: 0 }), [data.metaAds]);

  // ── Google KPI totals (search + display) ──
  const g = useMemo(() => {
    const t = { spend: 0, clicks: 0, impressions: 0, results: 0 };
    for (const a of data.googleSearchAds) { t.spend += a.spend; t.clicks += a.clicks; t.impressions += a.impressions; t.results += a.results; }
    for (const a of data.googleDisplayAds) { t.spend += a.spend; t.clicks += a.clicks; t.impressions += a.impressions; t.results += a.conversions; }
    return t;
  }, [data.googleSearchAds, data.googleDisplayAds]);

  const totalGSearchSpend = data.googleSearchAds.reduce((s, a) => s + a.spend, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-brand-dark">Creative Analysis</h1>
        <p className="text-gray-400 font-medium mt-1">Meta &amp; Google ad creatives, AI insights, and ad-level funnel performance.</p>
      </div>

      {/* Date filter */}
      <FilterBar showChannel={false} />

      {/* Page filters: focus + grouping */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-wrap items-center gap-6">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Focus</span>
          <div className="flex items-center gap-1">
            {FOCUS_OPTIONS.map(o => (
              <button
                key={o.value}
                onClick={() => setFocus(o.value)}
                className={cn(
                  'px-3 py-1.5 rounded-full text-xs font-bold border transition-all',
                  focus === o.value
                    ? 'bg-brand-forest text-white border-brand-forest'
                    : 'text-gray-500 border-gray-200 hover:border-brand-forest/40 hover:text-brand-forest',
                )}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Meta grouping</span>
          <div className="flex items-center bg-gray-100 rounded-xl p-1 gap-1">
            <button
              onClick={() => setGroupByCampaign(false)}
              className={cn('px-3 py-1.5 rounded-lg text-xs font-bold transition-all', !groupByCampaign ? 'bg-white text-[#0f172a] shadow-sm' : 'text-gray-400 hover:text-gray-600')}
            >
              By Ad
            </button>
            <button
              onClick={() => setGroupByCampaign(true)}
              className={cn('px-3 py-1.5 rounded-lg text-xs font-bold transition-all', groupByCampaign ? 'bg-white text-[#0f172a] shadow-sm' : 'text-gray-400 hover:text-gray-600')}
            >
              By Campaign
            </button>
          </div>
        </div>
      </div>

      {/* ── META ──────────────────────────────────────────────────────────── */}
      <h2 className="text-sm font-bold uppercase tracking-widest text-gray-400 pt-2">Meta Ads</h2>

      {/* Meta KPI strip — full funnel */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Kpi label="Spend" value={fmt$(m.spend)} icon={DollarSign} />
        <Kpi label="Clicks" value={fmtN(m.clicks)} icon={MousePointerClick} />
        <Kpi label="CPC" value={m.clicks > 0 ? fmt$(m.spend / m.clicks) : '—'} icon={DollarSign} />
        <Kpi label="CTR" value={ctrFmt(m.clicks, m.impressions)} icon={Percent} />
        <Kpi label="MQL" value={fmtN(m.mqls)} icon={Target} accent />
        <Kpi label="SQL" value={fmtN(m.sqls)} icon={Target} accent />
        <Kpi label="Won" value={fmtN(m.won)} icon={Trophy} accent northStar />
        <Kpi label="Cost / MQL" value={perUnit(m.spend, m.mqls)} icon={TrendingUp} accent />
        <Kpi label="Cost / SQL" value={perUnit(m.spend, m.sqls)} icon={TrendingUp} accent />
        <Kpi label="Cost / Won" value={perUnit(m.spend, m.won)} icon={TrendingUp} accent northStar />
      </div>

      <InsightCallout insight={data.insight} scope="meta" />

      {/* Champion previews — best ad per funnel stage (min $500 spend) */}
      <ChampionSection ads={data.metaAds} />

      {metaForCards.length > 0 ? (
        <MetaAdPreviews
          creatives={metaForCards}
          showFunnel
          advertiserName="PrePass"
          attributionMode={groupByCampaign ? 'campaign' : 'adset'}
          title="Meta Ad Creatives"
          description={`${metaForCards.length} ${groupByCampaign ? 'creatives (by campaign)' : 'ads'} · MQL/SQL/Won attributed by ad ID`}
        />
      ) : (
        <EmptyState icon={LayoutGrid} message="No Meta ad creatives for this segment and date range." />
      )}

      {/* ── GOOGLE ────────────────────────────────────────────────────────── */}
      <h2 className="text-sm font-bold uppercase tracking-widest text-gray-400 pt-4">Google Ads</h2>

      {/* Google KPI strip — no funnel (MQL/SQL/Won are Meta-only) */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Kpi label="Spend" value={fmt$(g.spend)} icon={DollarSign} />
        <Kpi label="Clicks" value={fmtN(g.clicks)} icon={MousePointerClick} />
        <Kpi label="CPC" value={g.clicks > 0 ? fmt$(g.spend / g.clicks) : '—'} icon={DollarSign} />
        <Kpi label="CTR" value={ctrFmt(g.clicks, g.impressions)} icon={Percent} />
        <Kpi label="Cost / Result" value={perUnit(g.spend, g.results)} icon={TrendingUp} accent />
      </div>

      <InsightCallout insight={data.insight} scope="google" />

      <SectionCard
        title="Google Search Ads"
        icon={Search}
        subtitle="Responsive search ads — headlines & descriptions ranked by investment"
      >
        {data.googleSearchAds.length > 0 ? (
          <div className="p-8 grid sm:grid-cols-2 xl:grid-cols-3 gap-6">
            {data.googleSearchAds.slice(0, 12).map((ad, i) => (
              <GoogleSearchCard key={ad.adId || i} ad={ad} totalSpend={totalGSearchSpend} rank={i + 1} />
            ))}
          </div>
        ) : (
          <EmptyState icon={Search} message="No Google Search ads for this segment and date range." />
        )}
      </SectionCard>

      <SectionCard
        title="Google Display Ads"
        icon={ImageIcon}
        subtitle="Display image creatives ranked by investment"
      >
        {data.googleDisplayAds.length > 0 ? (
          <div className="p-8 grid sm:grid-cols-2 xl:grid-cols-3 gap-6">
            {data.googleDisplayAds.slice(0, 12).map((ad, i) => (
              <GoogleDisplayCard key={ad.adId || i} ad={ad} />
            ))}
          </div>
        ) : (
          <EmptyState icon={ImageIcon} message="No Google Display image ads in this date range. (Display creative sync currently has data through Feb 2026.)" />
        )}
      </SectionCard>
    </div>
  );
}
