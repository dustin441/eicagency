'use client';

import React from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts';
import {
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  DollarSign,
  MousePointer2,
  Eye,
  Target,
  TrendingDown,
  AlertTriangle,
  BarChart2,
  Link2,
  Clock,
  ChevronDown,
  Sparkles,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import ChannelTable from '@/components/ChannelTable';
import FilterBar from '@/components/FilterBar';
import TrendChart from '@/components/TrendChart';
import type { DashboardStats, WeeklyExecutiveReadout } from '@/services/analytics';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function pct(current: number, prev: number): string {
  if (prev === 0) return current > 0 ? '+100%' : '0%';
  const change = ((current - prev) / prev) * 100;
  return `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`;
}

function trendDir(current: number, prev: number): 'up' | 'down' {
  return current >= prev ? 'up' : 'down';
}

// ─── Component ────────────────────────────────────────────────────────────────

interface DashboardClientProps {
  initialData: DashboardStats;
  weeklyReadout: WeeklyExecutiveReadout;
}

function fmtDateRange(start: string, end: string) {
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  const s = new Date(start + 'T12:00:00').toLocaleDateString('en-US', opts);
  const e = new Date(end   + 'T12:00:00').toLocaleDateString('en-US', opts);
  return `${s} – ${e}`;
}

export default function DashboardClient({ initialData: d, weeklyReadout }: DashboardClientProps) {
  const ctr = d.totalImpressions > 0 ? (d.totalClicks / d.totalImpressions) * 100 : 0;
  const prevCtr = d.prevImpressions > 0 ? (d.prevClicks / d.prevImpressions) * 100 : 0;
  const cpc = d.totalClicks > 0 ? d.totalSpend / d.totalClicks : 0;
  const prevCpc = d.prevClicks > 0 ? d.prevSpend / d.prevClicks : 0;

  const stats = [
    {
      name: 'Impressions',
      value: d.totalImpressions >= 1_000_000
        ? `${(d.totalImpressions / 1_000_000).toFixed(1)}M`
        : `${(d.totalImpressions / 1000).toFixed(0)}k`,
      change: pct(d.totalImpressions, d.prevImpressions),
      trend: trendDir(d.totalImpressions, d.prevImpressions),
      color: 'text-purple-600',
      icon: Eye,
      dataKey: 'spend',
    },
    {
      name: 'Clicks',
      value: Math.round(d.totalClicks).toLocaleString(),
      change: pct(d.totalClicks, d.prevClicks),
      trend: trendDir(d.totalClicks, d.prevClicks),
      color: 'text-blue-600',
      icon: MousePointer2,
      dataKey: 'spend',
    },
    {
      name: 'CTR',
      value: `${ctr.toFixed(2)}%`,
      change: pct(ctr, prevCtr),
      trend: trendDir(ctr, prevCtr),
      color: 'text-emerald-600',
      icon: Target,
      dataKey: 'spend',
    },
    {
      name: 'Spend',
      value: `$${Math.round(d.totalSpend).toLocaleString()}`,
      change: pct(d.totalSpend, d.prevSpend),
      trend: trendDir(d.totalSpend, d.prevSpend),
      color: 'text-brand-forest',
      icon: DollarSign,
      dataKey: 'spend',
    },
    {
      name: 'CPC',
      value: cpc > 0 ? `$${cpc.toFixed(2)}` : '—',
      change: pct(cpc, prevCpc),
      trend: trendDir(prevCpc, cpc), // inverted: lower CPC = better
      color: 'text-cyan-600',
      icon: TrendingDown,
      dataKey: 'spend',
    },
    {
      name: 'Leads',
      value: Math.round(d.platformConversions).toLocaleString(),
      change: pct(d.platformConversions, d.prevConversions),
      trend: trendDir(d.platformConversions, d.prevConversions),
      color: 'text-brand-orange',
      icon: BarChart2,
      dataKey: 'mql',
    },
    {
      name: 'Cost Per Lead',
      value: d.platformConversions > 0 ? `$${Math.round(d.totalSpend / d.platformConversions).toLocaleString()}` : '—',
      change: pct(
        d.prevConversions > 0 ? d.prevSpend / d.prevConversions : 0,
        d.platformConversions > 0 ? d.totalSpend / d.platformConversions : 0,
      ),
      trend: d.platformConversions > 0 && d.prevConversions > 0
        ? trendDir(d.prevSpend / d.prevConversions, d.totalSpend / d.platformConversions)
        : 'up' as const,
      color: 'text-brand-forest',
      icon: TrendingDown,
      dataKey: 'spend',
    },
  ];

  // Funnel stages — 4 stage: Lead → MQL → SQL → Closed Won
  const mqlRate = d.platformConversions > 0 ? (d.totalMqls / d.platformConversions) * 100 : 0;
  const sqlRate = d.totalMqls > 0 ? (d.totalSqls / d.totalMqls) * 100 : 0;
  const wonRate = d.totalSqls > 0 ? (d.totalWon / d.totalSqls) * 100 : 0;
  const topVal = d.platformConversions || 1;

  const funnelStages = [
    {
      label: 'Leads',
      value: d.platformConversions,
      widthPct: 100,
      color: 'bg-purple-50 border-purple-200 text-purple-700',
    },
    {
      label: 'MQLs',
      value: d.totalMqls,
      widthPct: Math.min((d.totalMqls / topVal) * 100, 100),
      color: 'bg-brand-forest/10 border-brand-forest/20 text-brand-forest',
    },
    {
      label: 'SQLs',
      value: d.totalSqls,
      widthPct: Math.min((d.totalSqls / topVal) * 100, 100),
      color: 'bg-blue-50 border-blue-200 text-blue-600',
    },
    {
      label: 'Closed Won',
      value: d.totalWon,
      widthPct: Math.min((d.totalWon / topVal) * 100, 100),
      color: 'bg-brand-forest/15 border-brand-forest/40 text-brand-forest',
      isNorthStar: true,
    },
  ];

  const funnelConnectors = [
    { rate: d.platformConversions > 0 ? `${mqlRate.toFixed(1)}%` : '—', avgDays: null as number | null, toLabel: 'MQL' },
    { rate: d.totalMqls > 0 ? `${sqlRate.toFixed(1)}%` : '—', avgDays: d.avgDaysMqlToSql > 0 ? d.avgDaysMqlToSql : null, toLabel: 'SQL' },
    { rate: d.totalSqls > 0 ? `${wonRate.toFixed(1)}%` : '—', avgDays: d.avgDaysSqlToWon > 0 ? d.avgDaysSqlToWon : null, toLabel: 'Close' },
  ];

  const { start, end } = d.filterParams;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-20">
      {/* Page Heading */}
      <div>
        <h1 className="text-3xl font-bold text-brand-dark tracking-tight">Overall Performance</h1>
        <p className="text-gray-500 mt-1">{fmtDateRange(start, end)} · All channels &amp; segments</p>
      </div>

      {/* Weekly Executive Readout */}
      {weeklyReadout.overallStory && <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-gray-50 flex items-center gap-3">
          <div className="p-2 bg-brand-forest/10 rounded-xl">
            <Sparkles className="w-5 h-5 text-brand-forest" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-brand-dark">Weekly Executive Readout</h3>
            <p className="text-sm text-gray-400 font-medium mt-0.5">
              {weeklyReadout.currentStart
                ? `${fmtDateRange(weeklyReadout.currentStart, weeklyReadout.currentEnd)}`
                : 'Updated by N8N weekly workflow'}
            </p>
          </div>
        </div>
        <div className="p-8 grid xl:grid-cols-[1.2fr,0.9fr,0.9fr] gap-6 border-b border-gray-50">
          <div className="bg-gray-50 rounded-3xl p-6">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-gray-400 mb-3">Overall Story</p>
            <p className="text-base leading-7 text-gray-700">{weeklyReadout.overallStory}</p>
            <div className="mt-5 pt-5 border-t border-gray-200 space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-gray-400">Execution Context</p>
              {weeklyReadout.executionContext.map((item) => (
                <div key={item} className="text-sm text-gray-600 flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-brand-orange shrink-0" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-emerald-100 bg-emerald-50/60 p-6">
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-700">Wins</p>
            </div>
            <div className="space-y-3">
              {weeklyReadout.wins.map((item) => (
                <div key={item} className="text-sm leading-6 text-emerald-900 flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-amber-100 bg-amber-50/70 p-6">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-amber-700">Opportunities</p>
            </div>
            <div className="space-y-3">
              {weeklyReadout.opportunities.map((item) => (
                <div key={item} className="text-sm leading-6 text-amber-900 flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="p-8 grid xl:grid-cols-2 gap-6">
          <div className="rounded-3xl border border-blue-100 bg-blue-50/60 p-6">
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle2 className="w-5 h-5 text-blue-600" />
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-blue-700">What Was Accomplished</p>
            </div>
            <div className="space-y-3">
              {weeklyReadout.accomplishments.map((item) => (
                <div key={item} className="text-sm leading-6 text-blue-950 flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-blue-500 shrink-0" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-brand-orange/20 bg-brand-orange/5 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Target className="w-5 h-5 text-brand-orange" />
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand-orange">Focus For Next Week</p>
            </div>
            <div className="space-y-3">
              {weeklyReadout.focusNextWeek.map((item) => (
                <div key={item} className="text-sm leading-6 text-brand-dark flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-brand-orange shrink-0" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs text-gray-400">
              This section is currently generated from live performance and execution data. The phase-2 Monday automation can replace or append strategist-authored priorities here.
            </p>
          </div>
        </div>
      </div>}

      {/* Filter Bar */}
      <FilterBar showFocus />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.name}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: i * 0.06 }}
            className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-xl hover:scale-[1.02] transition-all group overflow-hidden relative"
          >
            <div className="flex items-center justify-between mb-4">
              <div className={cn('p-2 rounded-xl bg-gray-50 group-hover:scale-110 transition-transform', stat.color)}>
                <stat.icon className="w-5 h-5" />
              </div>
              <div className={cn(
                'flex items-center text-xs font-bold px-2 py-1 rounded-full',
                stat.trend === 'up' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
              )}>
                {stat.trend === 'up'
                  ? <ArrowUpRight className="w-3 h-3 mr-0.5" />
                  : <ArrowDownRight className="w-3 h-3 mr-0.5" />}
                {stat.change}
              </div>
            </div>
            <div className="text-2xl font-bold text-brand-dark mb-1 tabular-nums">{stat.value}</div>
            <div className="text-xs font-medium text-gray-400 uppercase tracking-widest">{stat.name}</div>

            {/* Per-metric sparkline */}
            <div className="absolute bottom-0 left-0 right-0 h-14 opacity-10 group-hover:opacity-20 transition-opacity pointer-events-none">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={d.dailyData.slice(-14)}>
                  <Area type="monotone" dataKey={stat.dataKey} stroke="none" fill={stat.trend === 'up' ? '#10b981' : '#ef4444'} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Cost Efficiency */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
        <h3 className="text-base font-bold text-brand-dark mb-4">Cost Efficiency</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {(() => {
            function cpDelta(cSpend: number, cUnits: number, pSpend: number, pUnits: number) {
              if (cUnits === 0 || pUnits === 0) return null;
              const curr = cSpend / cUnits; const prev = pSpend / pUnits;
              if (prev === 0) return null;
              const p = ((curr - prev) / prev) * 100;
              return { label: `${p >= 0 ? '+' : ''}${p.toFixed(1)}%`, isImprovement: p < 0 };
            }
            const metrics = [
              { label: 'Cost Per Lead', cost: d.platformConversions > 0 ? d.totalSpend / d.platformConversions : null, count: d.platformConversions, prevCount: d.prevConversions, countLabel: 'Leads', costDelta: cpDelta(d.totalSpend, d.platformConversions, d.prevSpend, d.prevConversions) },
              { label: 'Cost Per MQL',  cost: d.totalMqls > 0 ? d.totalSpend / d.totalMqls : null,                     count: d.totalMqls,           prevCount: d.prevMqls,        countLabel: 'MQLs',  costDelta: cpDelta(d.totalSpend, d.totalMqls, d.prevSpend, d.prevMqls) },
              { label: 'Cost Per SQL',  cost: d.totalSqls > 0 ? d.totalSpend / d.totalSqls : null,                     count: d.totalSqls,           prevCount: d.prevSqls,        countLabel: 'SQLs',  costDelta: cpDelta(d.totalSpend, d.totalSqls, d.prevSpend, d.prevSqls) },
              { label: 'Cost Per Won',  cost: d.totalWon  > 0 ? d.totalSpend / d.totalWon  : null,                     count: d.totalWon,            prevCount: d.prevWon,         countLabel: 'Won',   costDelta: cpDelta(d.totalSpend, d.totalWon, d.prevSpend, d.prevWon) },
            ];
            function countDelta(curr: number, prev: number) {
              if (prev === 0) return null;
              const p = ((curr - prev) / prev) * 100;
              return { label: `${p >= 0 ? '+' : ''}${p.toFixed(1)}%`, isUp: p >= 0 };
            }
            return metrics.map((m) => {
              const cd = countDelta(m.count, m.prevCount);
              const isWon = m.label === 'Cost Per Won';
              return (
              <div key={m.label} className={cn('rounded-2xl p-5 flex flex-col gap-3', isWon ? 'bg-brand-forest/5 border-2 border-brand-forest/25 ring-1 ring-brand-forest/10' : 'bg-gray-50')}>
                <div className="flex items-start justify-between">
                  <div className="flex flex-col gap-1">
                    <p className={cn('text-xs font-bold uppercase tracking-widest leading-tight', isWon ? 'text-brand-forest' : 'text-gray-400')}>{m.label}</p>
                    {isWon && <span className="text-[9px] font-bold uppercase tracking-widest text-brand-forest bg-brand-forest/10 px-1.5 py-0.5 rounded-full w-fit">North Star</span>}
                  </div>
                  {m.costDelta ? (
                    <div className={cn('flex items-center text-xs font-bold px-2 py-0.5 rounded-full shrink-0', m.costDelta.isImprovement ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600')}>
                      {m.costDelta.isImprovement ? <ArrowDownRight className="w-3 h-3 mr-0.5" /> : <ArrowUpRight className="w-3 h-3 mr-0.5" />}
                      {m.costDelta.label}
                    </div>
                  ) : <span className="text-xs text-gray-300 font-semibold">—</span>}
                </div>
                <p className="text-2xl font-bold text-brand-dark tabular-nums">{m.cost !== null ? `$${Math.round(m.cost).toLocaleString()}` : '—'}</p>
                <div className="flex items-center justify-between pt-1 border-t border-gray-200">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xl font-bold text-brand-forest tabular-nums">{Math.round(m.count).toLocaleString()}</span>
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
            });
          })()}
        </div>
      </div>

      {/* Main Charts */}
      <div className="grid lg:grid-cols-3 gap-8">
        <TrendChart
          dailyData={d.dailyData}
          dateRange={fmtDateRange(start, end)}
          defaultMetric="platformConversions"
        />

        {/* Funnel Distribution */}
        <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm flex flex-col">
          <div className="mb-8">
            <h3 className="text-xl font-bold text-brand-dark">Funnel Distribution</h3>
            <p className="text-sm text-gray-400 font-medium">Conversion rate &amp; time to deal by stage</p>
          </div>

          <div className="space-y-0 flex-1">
            {funnelStages.map((stage, i) => (
              <div key={stage.label}>
                {/* Stage bar */}
                <div className={cn(stage.isNorthStar && 'rounded-2xl bg-brand-forest/5 p-3 -mx-3 border border-brand-forest/15')}>
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-2">
                      <span className={cn('text-sm font-bold', stage.isNorthStar ? 'text-brand-forest' : 'text-gray-700')}>{stage.label}</span>
                      {stage.isNorthStar && <span className="text-[10px] font-bold uppercase tracking-widest text-brand-forest bg-brand-forest/10 px-2 py-0.5 rounded-full">North Star</span>}
                    </div>
                    <span className="text-base font-bold text-brand-dark tabular-nums">{Math.round(stage.value).toLocaleString()}</span>
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

                {/* Connector */}
                {i < funnelStages.length - 1 && (() => {
                  const conn = funnelConnectors[i];
                  return (
                    <div className="flex items-center gap-2 py-1.5 pl-2">
                      <ChevronDown className="w-3.5 h-3.5 text-gray-300 shrink-0" />
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                          {conn.rate} converted
                        </span>
                        {conn.avgDays !== null && (
                          <span className="flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100">
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
      </div>

      {/* Channel Breakdown Table */}
      <ChannelTable initialChannels={d.channels} />

      {/* LinkedIn Campaigns */}
      {d.linkedinCampaigns.length > 0 && (
        <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-8 border-b border-gray-50 flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-xl">
              <Link2 className="w-5 h-5 text-blue-700" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-brand-dark">LinkedIn Campaigns</h3>
              <p className="text-sm text-gray-400 font-medium mt-0.5">Sorted by spend · Current period</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {['Campaign', 'Spend', 'Impressions', 'Clicks', 'CTR', 'Leads', 'CPL'].map(h => (
                    <th key={h} className="text-left px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {d.linkedinCampaigns.map((c, i) => {
                  const ctrVal = c.impressions > 0 ? ((c.clicks / c.impressions) * 100).toFixed(2) + '%' : '—';
                  const cplVal = c.leads > 0 ? '$' + Math.round(c.spend / c.leads).toLocaleString() : '—';
                  return (
                    <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4 font-medium text-brand-dark max-w-xs"><span className="line-clamp-1 block" title={c.name}>{c.name}</span></td>
                      <td className="px-6 py-4 font-bold text-brand-dark tabular-nums">${Math.round(c.spend).toLocaleString()}</td>
                      <td className="px-6 py-4 text-gray-600 tabular-nums">{c.impressions >= 1_000_000 ? `${(c.impressions / 1_000_000).toFixed(1)}M` : `${(c.impressions / 1000).toFixed(0)}k`}</td>
                      <td className="px-6 py-4 text-gray-600 tabular-nums">{Math.round(c.clicks).toLocaleString()}</td>
                      <td className="px-6 py-4 text-gray-600 tabular-nums">{ctrVal}</td>
                      <td className="px-6 py-4 font-semibold text-brand-forest tabular-nums">{Math.round(c.leads).toLocaleString()}</td>
                      <td className="px-6 py-4 text-gray-600 tabular-nums">{cplVal}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
