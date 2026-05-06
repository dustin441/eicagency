'use client';

import React from 'react';
import Link from 'next/link';
import {
  ArrowUpRight, ArrowDownRight,
  DollarSign, MousePointer2, Eye, Target,
  TrendingDown, BarChart2, Clock, ChevronDown,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import ChannelTable from '@/components/ChannelTable';
import MonthlyTrendChart from '@/components/MonthlyTrendChart';
import { MetaAdPreviews, GoogleAdPreviews } from '@/components/AdPreviews';
import type { MonthlyReportStats } from '@/services/analytics';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt$(n: number) { return `$${Math.round(n).toLocaleString()}`; }
function fmtN(n: number) { return Math.round(n).toLocaleString(); }
function fmtImpr(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  return String(Math.round(n));
}

function pct(curr: number, prev: number) {
  if (prev === 0) return curr > 0 ? '+100%' : '0%';
  const c = ((curr - prev) / prev) * 100;
  return `${c >= 0 ? '+' : ''}${c.toFixed(1)}%`;
}
function up(curr: number, prev: number) { return curr >= prev; }

function cpDelta(cS: number, cU: number, pS: number, pU: number) {
  if (cU === 0 || pU === 0) return null;
  const c = cS / cU; const p = pS / pU;
  if (p === 0) return null;
  const d = ((c - p) / p) * 100;
  return { label: `${d >= 0 ? '+' : ''}${d.toFixed(1)}%`, isImprovement: d < 0 };
}
function countDelta(curr: number, prev: number) {
  if (prev === 0) return null;
  const p = ((curr - prev) / prev) * 100;
  return { label: `${p >= 0 ? '+' : ''}${p.toFixed(1)}%`, isUp: p >= 0 };
}

// ─── Focus filter pills ───────────────────────────────────────────────────────

const FOCUS_OPTIONS = [
  { value: 'all',   label: 'All Segments' },
  { value: 'SMB',   label: 'SMB' },
  { value: 'ABM',   label: 'ABM' },
  { value: 'FD360', label: 'FD360' },
];

function FocusFilter({ currentFocus }: { currentFocus: string }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs font-bold text-gray-400 uppercase tracking-widest mr-1">Segment</span>
      {FOCUS_OPTIONS.map(opt => {
        const active = opt.value === currentFocus;
        return (
          <Link
            key={opt.value}
            href={opt.value === 'all' ? '/dashboard/monthly-report' : `/dashboard/monthly-report?focus=${opt.value}`}
            className={cn(
              'px-4 py-1.5 rounded-full text-xs font-bold border transition-all',
              active
                ? 'bg-brand-forest text-white border-brand-forest shadow-sm'
                : 'bg-white text-gray-500 border-gray-200 hover:border-brand-forest/40 hover:text-brand-forest',
            )}
          >
            {opt.label}
          </Link>
        );
      })}
    </div>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  name, value, change, isUp, icon: Icon, color, delay,
}: {
  name: string; value: string; change: string; isUp: boolean;
  icon: React.ComponentType<{ className?: string }>; color: string; delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-xl hover:scale-[1.02] transition-all group"
    >
      <div className="flex items-center justify-between mb-4">
        <div className={cn('p-2 rounded-xl bg-gray-50 group-hover:scale-110 transition-transform', color)}>
          <Icon className="w-5 h-5" />
        </div>
        {change !== '—' ? (
          <div className={cn(
            'flex items-center text-xs font-bold px-2 py-1 rounded-full',
            isUp ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600',
          )}>
            {isUp ? <ArrowUpRight className="w-3 h-3 mr-0.5" /> : <ArrowDownRight className="w-3 h-3 mr-0.5" />}
            {change}
          </div>
        ) : (
          <span className="text-xs text-gray-300 font-semibold">—</span>
        )}
      </div>
      <div className="text-2xl font-bold text-brand-dark mb-1 tabular-nums">{value}</div>
      <div className="text-xs font-medium text-gray-400 uppercase tracking-widest">{name}</div>
    </motion.div>
  );
}

// ─── Cost Efficiency ──────────────────────────────────────────────────────────

function CostEfficiency({ d }: { d: MonthlyReportStats }) {
  const metrics = [
    { label: 'Cost Per Lead', cost: d.platformConversions > 0 ? d.totalSpend / d.platformConversions : null, count: d.platformConversions, prevCount: d.prevConversions, countLabel: 'Leads', delta: cpDelta(d.totalSpend, d.platformConversions, d.prevSpend, d.prevConversions) },
    { label: 'Cost Per MQL',  cost: d.totalMqls > 0 ? d.totalSpend / d.totalMqls : null, count: d.totalMqls, prevCount: d.prevMqls, countLabel: 'MQLs', delta: cpDelta(d.totalSpend, d.totalMqls, d.prevSpend, d.prevMqls) },
    { label: 'Cost Per SQL',  cost: d.totalSqls > 0 ? d.totalSpend / d.totalSqls : null, count: d.totalSqls, prevCount: d.prevSqls, countLabel: 'SQLs', delta: cpDelta(d.totalSpend, d.totalSqls, d.prevSpend, d.prevSqls) },
    { label: 'Cost Per Won',  cost: d.totalWon  > 0 ? d.totalSpend / d.totalWon  : null, count: d.totalWon,  prevCount: d.prevWon,  countLabel: 'Won',  delta: cpDelta(d.totalSpend, d.totalWon,  d.prevSpend, d.prevWon) },
  ];
  return (
    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
      <h3 className="text-base font-bold text-brand-dark mb-4">Cost Efficiency</h3>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map(m => {
          const isWon = m.label === 'Cost Per Won';
          const cd = countDelta(m.count, m.prevCount);
          return (
            <div key={m.label} className={cn('rounded-2xl p-5 flex flex-col gap-3', isWon ? 'bg-brand-forest/5 border-2 border-brand-forest/25 ring-1 ring-brand-forest/10' : 'bg-gray-50')}>
              <div className="flex items-start justify-between">
                <div className="flex flex-col gap-1">
                  <p className={cn('text-xs font-bold uppercase tracking-widest leading-tight', isWon ? 'text-brand-forest' : 'text-gray-400')}>{m.label}</p>
                  {isWon && <span className="text-[9px] font-bold uppercase tracking-widest text-brand-forest bg-brand-forest/10 px-1.5 py-0.5 rounded-full w-fit">North Star</span>}
                </div>
                {m.delta ? (
                  <div className={cn('flex items-center text-xs font-bold px-2 py-0.5 rounded-full shrink-0', m.delta.isImprovement ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600')}>
                    {m.delta.isImprovement ? <ArrowDownRight className="w-3 h-3 mr-0.5" /> : <ArrowUpRight className="w-3 h-3 mr-0.5" />}
                    {m.delta.label}
                  </div>
                ) : <span className="text-xs text-gray-300 font-semibold">—</span>}
              </div>
              <p className="text-2xl font-bold text-brand-dark tabular-nums">{m.cost !== null ? fmt$(m.cost) : '—'}</p>
              <div className="flex items-center justify-between pt-1 border-t border-gray-200">
                <div className="flex items-center gap-1.5">
                  <span className="text-xl font-bold text-brand-forest tabular-nums">{fmtN(m.count)}</span>
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{m.countLabel}</span>
                </div>
                {cd && (
                  <div className={cn('flex items-center text-xs font-bold px-2 py-0.5 rounded-full', cd.isUp ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600')}>
                    {cd.isUp ? <ArrowUpRight className="w-3 h-3 mr-0.5" /> : <ArrowDownRight className="w-3 h-3 mr-0.5" />}
                    {cd.label}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Funnel ───────────────────────────────────────────────────────────────────

function FunnelPanel({ d }: { d: MonthlyReportStats }) {
  const mqlRate = d.platformConversions > 0 ? (d.totalMqls / d.platformConversions) * 100 : 0;
  const sqlRate = d.totalMqls > 0 ? (d.totalSqls / d.totalMqls) * 100 : 0;
  const wonRate = d.totalSqls > 0 ? (d.totalWon / d.totalSqls) * 100 : 0;
  const topVal  = d.platformConversions || 1;

  const stages = [
    { label: 'Leads',      value: d.platformConversions, widthPct: 100,                                        color: 'bg-purple-50 border-purple-200 text-purple-700' },
    { label: 'MQLs',       value: d.totalMqls,           widthPct: Math.min((d.totalMqls / topVal) * 100, 100), color: 'bg-brand-forest/10 border-brand-forest/20 text-brand-forest' },
    { label: 'SQLs',       value: d.totalSqls,           widthPct: Math.min((d.totalSqls / topVal) * 100, 100), color: 'bg-blue-50 border-blue-200 text-blue-600' },
    { label: 'Closed Won', value: d.totalWon,            widthPct: Math.min((d.totalWon  / topVal) * 100, 100), color: 'bg-brand-forest/15 border-brand-forest/40 text-brand-forest', isNorthStar: true },
  ];
  const connectors = [
    { rate: d.platformConversions > 0 ? `${mqlRate.toFixed(1)}%` : '—', avgDays: null as number | null, toLabel: 'MQL' },
    { rate: d.totalMqls > 0 ? `${sqlRate.toFixed(1)}%` : '—', avgDays: d.avgDaysMqlToSql > 0 ? d.avgDaysMqlToSql : null, toLabel: 'SQL' },
    { rate: d.totalSqls > 0 ? `${wonRate.toFixed(1)}%` : '—', avgDays: d.avgDaysSqlToWon > 0 ? d.avgDaysSqlToWon : null, toLabel: 'Close' },
  ];

  return (
    <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm">
      <h3 className="text-xl font-bold text-brand-dark mb-1">Funnel Distribution</h3>
      <p className="text-sm text-gray-400 font-medium mb-6">Conversion rate &amp; time to deal by stage</p>
      <div className="space-y-0">
        {stages.map((stage, i) => (
          <div key={stage.label}>
            <div className={cn((stage as { isNorthStar?: boolean }).isNorthStar && 'rounded-2xl bg-brand-forest/5 p-3 -mx-3 border border-brand-forest/15')}>
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-2">
                  <span className={cn('text-sm font-bold', (stage as { isNorthStar?: boolean }).isNorthStar ? 'text-brand-forest' : 'text-gray-700')}>{stage.label}</span>
                  {(stage as { isNorthStar?: boolean }).isNorthStar && <span className="text-[10px] font-bold uppercase tracking-widest text-brand-forest bg-brand-forest/10 px-2 py-0.5 rounded-full">North Star</span>}
                </div>
                <span className="text-base font-bold text-brand-dark tabular-nums">{fmtN(stage.value)}</span>
              </div>
              <div className="h-9 w-full bg-gray-50 rounded-xl overflow-hidden border border-gray-100">
                <motion.div
                  initial={{ width: 0 }}
                  whileInView={{ width: `${stage.widthPct}%` }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.9, delay: i * 0.1, ease: 'easeOut' }}
                  className={cn('h-full border-r-2 rounded-xl', stage.color)}
                />
              </div>
            </div>
            {i < stages.length - 1 && (() => {
              const conn = connectors[i];
              return (
                <div className="flex items-center gap-2 py-2 pl-2">
                  <ChevronDown className="w-3.5 h-3.5 text-gray-300 shrink-0" />
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">{conn.rate} converted</span>
                    {conn.avgDays !== null && (
                      <span className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-blue-600 border border-blue-100">
                        <Clock className="w-3 h-3" />
                        avg {conn.avgDays.toFixed(1)}d to {conn.toLabel}
                      </span>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Campaign Table ───────────────────────────────────────────────────────────

const FOCUS_COLORS: Record<string, string> = {
  SMB:   'bg-brand-forest/10 text-brand-forest border-brand-forest/20',
  ABM:   'bg-blue-50 text-blue-700 border-blue-200',
  FD360: 'bg-purple-50 text-purple-700 border-purple-200',
};

function CampaignTable({ campaigns, showFocus }: { campaigns: MonthlyReportStats['campaigns']; showFocus: boolean }) {
  if (campaigns.length === 0) return null;
  return (
    <div className="w-full bg-white border border-gray-100 shadow-sm rounded-[2.5rem] overflow-hidden">
      <div className="p-8 border-b border-gray-100">
        <h3 className="text-xl font-bold text-brand-dark">Campaign Performance</h3>
        <p className="text-sm text-gray-400 font-medium mt-0.5">Top 50 campaigns by spend · Current month</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm" style={{ minWidth: showFocus ? '1200px' : '1080px' }}>
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Campaign</th>
              {showFocus && <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Segment</th>}
              <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Platform</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Spend</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Impressions</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Clicks</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Leads</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">MQLs</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">SQLs</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Won</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Cost/MQL</th>
              <th className="px-6 py-4 text-xs font-bold text-brand-forest uppercase tracking-widest">Cost/Won ★</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {campaigns.map((c, i) => {
              const cpmql = c.mqls > 0 ? c.spend / c.mqls : null;
              const cpwon = c.won  > 0 ? c.spend / c.won  : null;
              return (
                <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-4 font-medium text-brand-dark max-w-xs">
                    <span className="line-clamp-1 block" title={c.name}>{c.name}</span>
                  </td>
                  {showFocus && (
                    <td className="px-6 py-4">
                      <span className={cn('text-xs font-bold px-2.5 py-1 rounded-full border', FOCUS_COLORS[c.focus] ?? 'bg-gray-100 text-gray-600 border-gray-200')}>
                        {c.focus}
                      </span>
                    </td>
                  )}
                  <td className="px-6 py-4 text-gray-500 font-medium">{c.platform}</td>
                  <td className="px-6 py-4 font-bold text-brand-dark tabular-nums">{fmt$(c.spend)}</td>
                  <td className="px-6 py-4 text-gray-600 tabular-nums">{fmtImpr(c.impressions)}</td>
                  <td className="px-6 py-4 text-gray-600 tabular-nums">{fmtN(c.clicks)}</td>
                  <td className="px-6 py-4 text-gray-600 tabular-nums">{fmtN(c.leads)}</td>
                  <td className="px-6 py-4 font-bold text-brand-forest tabular-nums">{fmtN(c.mqls)}</td>
                  <td className="px-6 py-4 text-gray-600 tabular-nums">{fmtN(c.sqls)}</td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-brand-orange/10 text-brand-orange border border-brand-orange/20 tabular-nums">
                      {fmtN(c.won)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-600 tabular-nums">{cpmql !== null ? fmt$(cpmql) : '—'}</td>
                  <td className="px-6 py-4 font-bold text-brand-orange tabular-nums">{cpwon !== null ? fmt$(cpwon) : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function MonthlyReportClient({ data: d }: { data: MonthlyReportStats }) {
  const ctr    = d.totalImpressions > 0 ? (d.totalClicks / d.totalImpressions) * 100 : 0;
  const prevCtr = d.prevImpressions > 0 ? (d.prevClicks  / d.prevImpressions)  * 100 : 0;
  const cpc     = d.totalClicks > 0 ? d.totalSpend / d.totalClicks : 0;
  const prevCpc = d.prevClicks  > 0 ? d.prevSpend  / d.prevClicks  : 0;

  const kpis = [
    { name: 'Impressions', value: fmtImpr(d.totalImpressions), change: pct(d.totalImpressions, d.prevImpressions), isUp: up(d.totalImpressions, d.prevImpressions), icon: Eye,          color: 'text-purple-600' },
    { name: 'Clicks',      value: fmtN(d.totalClicks),         change: pct(d.totalClicks, d.prevClicks),           isUp: up(d.totalClicks, d.prevClicks),           icon: MousePointer2, color: 'text-blue-600' },
    { name: 'CTR',         value: `${ctr.toFixed(2)}%`,        change: pct(ctr, prevCtr),                          isUp: up(ctr, prevCtr),                          icon: Target,        color: 'text-emerald-600' },
    { name: 'Spend',       value: fmt$(d.totalSpend),           change: pct(d.totalSpend, d.prevSpend),             isUp: up(d.totalSpend, d.prevSpend),             icon: DollarSign,    color: 'text-brand-forest' },
    { name: 'CPC',         value: cpc > 0 ? `$${cpc.toFixed(2)}` : '—', change: pct(cpc, prevCpc),                 isUp: up(prevCpc, cpc),                          icon: TrendingDown,  color: 'text-cyan-600' },
    { name: 'Leads',       value: fmtN(d.platformConversions), change: pct(d.platformConversions, d.prevConversions), isUp: up(d.platformConversions, d.prevConversions), icon: BarChart2, color: 'text-brand-orange' },
    {
      name: 'Cost Per Lead',
      value: d.platformConversions > 0 ? fmt$(d.totalSpend / d.platformConversions) : '—',
      change: pct(
        d.prevConversions > 0 ? d.prevSpend / d.prevConversions : 0,
        d.platformConversions > 0 ? d.totalSpend / d.platformConversions : 0,
      ),
      isUp: d.platformConversions > 0 && d.prevConversions > 0 ? up(d.prevSpend / d.prevConversions, d.totalSpend / d.platformConversions) : true,
      icon: TrendingDown, color: 'text-brand-forest',
    },
  ];

  const focusLabel = d.focus === 'all' ? 'All Segments' : d.focus;
  const showSegmentTable = d.focus === 'all';

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-20">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-brand-dark tracking-tight">{d.currentMonthLabel} Report</h1>
          <p className="text-gray-500 mt-1">
            {focusLabel} · Compared to {d.prevMonthLabel}
          </p>
        </div>
        <FocusFilter currentFocus={d.focus} />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4">
        {kpis.map((k, i) => <KpiCard key={k.name} {...k} delay={i * 0.05} />)}
      </div>

      {/* Cost Efficiency */}
      <CostEfficiency d={d} />

      {/* Trend Chart + Funnel */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <MonthlyTrendChart data={d.monthlyTrend} />
        </div>
        <FunnelPanel d={d} />
      </div>

      {/* Segment Breakdown — only when showing all segments */}
      {showSegmentTable && (
        <ChannelTable
          initialChannels={d.focusRows}
          firstColumnLabel="Segment"
          title="Segment Breakdown"
          subtitle="SMB · ABM · FD360 · Badges show change vs. prior month"
        />
      )}

      {/* Channel Breakdown */}
      <ChannelTable
        initialChannels={d.channelRows}
        firstColumnLabel="Channel"
        title="Channel Breakdown"
        subtitle="Google Ads vs. Meta Ads · Badges show change vs. prior month"
      />

      {/* Product Breakdown */}
      {d.productRows.length > 0 && (
        <ChannelTable
          initialChannels={d.productRows}
          firstColumnLabel="Product"
          title="Product Performance"
          subtitle="Metrics by product line · Badges show change vs. prior month"
        />
      )}

      {/* Campaign Performance */}
      <CampaignTable campaigns={d.campaigns} showFocus={d.focus === 'all'} />

      {/* Ad Creatives */}
      <MetaAdPreviews creatives={d.metaCreatives} advertiserName="PrePass" logoUrl="/prepass-social-logo.jpg" />
      <GoogleAdPreviews creatives={d.googleCreatives} />

    </div>
  );
}
