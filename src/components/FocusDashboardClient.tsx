'use client';

import React from 'react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  DollarSign, MousePointer2, Eye, Target,
  TrendingDown, ArrowUpRight, ArrowDownRight, Phone, FileText,
  BarChart2, CalendarDays, Clock, ChevronDown, RotateCcw,
} from 'lucide-react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import TrendChart from '@/components/TrendChart';
import { MetaAdPreviews, GoogleAdPreviews } from '@/components/AdPreviews';
import ChannelTable from '@/components/ChannelTable';
import type { FocusStats } from '@/services/analytics';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt$(n: number) { return `$${Math.round(n).toLocaleString()}`; }
function fmtN(n: number) { return Math.round(n).toLocaleString(); }
function pct(curr: number, prev: number) {
  if (prev === 0) return curr > 0 ? '+100%' : '0%';
  const c = ((curr - prev) / prev) * 100;
  return `${c >= 0 ? '+' : ''}${c.toFixed(1)}%`;
}
function up(curr: number, prev: number) { return curr >= prev; }
function fmtDateRange(start: string, end: string) {
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  const s = new Date(start + 'T12:00:00').toLocaleDateString('en-US', opts);
  const e = new Date(end   + 'T12:00:00').toLocaleDateString('en-US', opts);
  return `${s} – ${e}`;
}
function fmtDateFull(date: string) {
  return new Date(date + 'T12:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

const FOCUS_LABELS: Record<string, string> = {
  SMB: 'SMB Segments',
  ABM: 'ABM Focus',
  FD360: 'FD360 Campaigns',
};

const FOCUS_PATHS: Record<string, string> = {
  SMB: '/dashboard/smb',
  ABM: '/dashboard/abm',
  FD360: '/dashboard/fd360',
};

function FocusDateSelector({ d }: { d: FocusStats }) {
  const path = FOCUS_PATHS[d.focus] ?? '/dashboard';
  return (
    <div className="bg-white border border-gray-100 shadow-sm rounded-3xl p-5">
      <form method="GET" action={path} className="flex flex-col lg:flex-row lg:items-end gap-4">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div className="p-2 rounded-xl bg-brand-forest/10 shrink-0">
            <CalendarDays className="w-5 h-5 text-brand-forest" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-brand-dark">Performance Date Range</p>
            <p className="text-xs text-gray-500 mt-1">
              Comparing {fmtDateFull(d.filterParams.start)} – {fmtDateFull(d.filterParams.end)} to{' '}
              {fmtDateFull(d.filterParams.compStart)} – {fmtDateFull(d.filterParams.compEnd)}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(140px,auto)_auto_auto] gap-3 lg:w-auto">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Start</span>
            <input
              type="date"
              name="start"
              defaultValue={d.filterParams.start}
              className="h-10 rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm font-semibold text-brand-dark focus:outline-none focus:ring-2 focus:ring-brand-orange/20"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-bold uppercase tracking-widest text-gray-400">End</span>
            <input
              type="date"
              name="end"
              defaultValue={d.filterParams.end}
              className="h-10 rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm font-semibold text-brand-dark focus:outline-none focus:ring-2 focus:ring-brand-orange/20"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Channel</span>
            <select
              name="channel"
              defaultValue={d.filterParams.channel ?? 'all'}
              className="h-10 rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm font-semibold text-brand-dark focus:outline-none focus:ring-2 focus:ring-brand-orange/20"
            >
              <option value="all">All Channels</option>
              <option value="Google">Google Ads</option>
              <option value="Meta">Meta Ads</option>
            </select>
          </label>
          <button
            type="submit"
            className="h-10 self-end rounded-xl bg-brand-forest px-4 text-sm font-bold text-white hover:bg-brand-forest/90 transition-colors"
          >
            Apply
          </button>
          <Link
            href={path}
            className="h-10 self-end rounded-xl border border-gray-200 px-3 text-gray-500 hover:text-brand-forest hover:border-brand-forest/30 transition-colors flex items-center justify-center"
            aria-label="Reset filters"
          >
            <RotateCcw className="w-4 h-4" />
          </Link>
        </div>
      </form>
    </div>
  );
}

// ─── Budget Pacing Bar ────────────────────────────────────────────────────────

function BudgetPacing({ d }: { d: FocusStats }) {
  const totalSpent  = d.googleBudgetSpent + d.metaBudgetSpent;
  const pctUsed     = d.budget > 0 ? (totalSpent / d.budget) * 100 : 0;
  const barPct      = Math.min(pctUsed, 100);
  const overage     = totalSpent - d.budget;          // positive = over, negative = under
  const isOver      = overage > 0;

  const now          = new Date();
  const monthName    = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const daysInMonth  = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const dayOfMonth   = now.getDate();
  const expectedPct  = (dayOfMonth / daysInMonth) * 100;
  const expectedSpend = d.budget * (expectedPct / 100);
  const pacingDelta  = totalSpent - expectedSpend;    // positive = ahead of pace

  // Bar color: red if over budget, orange if >90% of expected, green otherwise
  const barColor = isOver
    ? 'bg-red-500'
    : pctUsed > expectedPct + 10
    ? 'bg-brand-orange'
    : 'bg-brand-forest';

  return (
    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Budget Pacing</p>
          <p className="text-sm font-semibold text-gray-500 mt-0.5">{monthName} · Day {dayOfMonth} of {daysInMonth}</p>
        </div>
        {/* Over / Under badge */}
        <div className={cn(
          'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold',
          isOver ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-700'
        )}>
          {isOver ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
          {isOver ? 'Over' : 'Under'} by {fmt$(Math.abs(overage))}
        </div>
      </div>

      {/* Key numbers */}
      <div className="grid grid-cols-3 gap-4 mb-5">
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Monthly Budget</p>
          <p className="text-xl font-bold text-brand-dark tabular-nums">{fmt$(d.budget)}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Spent (MTD)</p>
          <p className="text-xl font-bold text-brand-dark tabular-nums">{fmt$(totalSpent)}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Remaining</p>
          <p className={cn('text-xl font-bold tabular-nums', isOver ? 'text-red-500' : 'text-emerald-600')}>
            {isOver ? `−${fmt$(Math.abs(overage))}` : fmt$(d.budget - totalSpent)}
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="relative h-3 bg-gray-100 rounded-full overflow-visible mb-1">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${barPct}%` }}
          transition={{ duration: 1, ease: 'easeOut' }}
          className={cn('h-full rounded-full', barColor)}
        />
        {/* Expected pace marker */}
        <div
          className="absolute -top-1 bottom-0 w-0.5 h-5 bg-gray-400 rounded-full"
          style={{ left: `${Math.min(expectedPct, 100)}%` }}
          title={`On-pace target: ${fmt$(expectedSpend)}`}
        />
      </div>
      <div className="flex justify-between text-xs text-gray-400 mt-2 mb-4">
        <span className="tabular-nums">{pctUsed.toFixed(1)}% used</span>
        <div className="flex items-center gap-1">
          <span className="inline-block w-2 h-2 bg-gray-400 rounded-full" />
          <span>On-pace target: {fmt$(expectedSpend)} ({expectedPct.toFixed(0)}%)</span>
        </div>
        <span className={cn('font-semibold tabular-nums', pacingDelta > 0 ? 'text-brand-orange' : 'text-emerald-600')}>
          {pacingDelta > 0 ? '+' : ''}{fmt$(pacingDelta)} vs pace
        </span>
      </div>

      {/* Platform split */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gray-50 rounded-xl p-3">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Google Spend</p>
          <p className="text-base font-bold text-brand-dark tabular-nums">{fmt$(d.googleBudgetSpent)}</p>
          {d.budget > 0 && (
            <p className="text-xs text-gray-400 mt-0.5">{((d.googleBudgetSpent / d.budget) * 100).toFixed(1)}% of budget</p>
          )}
        </div>
        <div className="bg-gray-50 rounded-xl p-3">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Meta Spend</p>
          <p className="text-base font-bold text-brand-dark tabular-nums">{fmt$(d.metaBudgetSpent)}</p>
          {d.budget > 0 && (
            <p className="text-xs text-gray-400 mt-0.5">{((d.metaBudgetSpent / d.budget) * 100).toFixed(1)}% of budget</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  name, value, change, isUp, icon: Icon, color, delay, neutral,
}: {
  name: string; value: string; change: string; isUp: boolean;
  icon: React.ComponentType<{ className?: string }>; color: string; delay: number;
  neutral?: boolean;
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
            neutral ? 'bg-gray-100 text-gray-500' :
            isUp ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
          )}>
            {!neutral && (isUp ? <ArrowUpRight className="w-3 h-3 mr-0.5" /> : <ArrowDownRight className="w-3 h-3 mr-0.5" />)}
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

// ─── Cost Efficiency Row ───────────────────────────────────────────────────────

function cpDelta(currSpend: number, currUnits: number, prevSpend: number, prevUnits: number): { label: string; isImprovement: boolean } | null {
  if (currUnits === 0 || prevUnits === 0) return null;
  const curr = currSpend / currUnits;
  const prev = prevSpend / prevUnits;
  if (prev === 0) return null;
  const pct = ((curr - prev) / prev) * 100;
  // For cost-per metrics, down = good (green), up = bad (red)
  return { label: `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`, isImprovement: pct < 0 };
}

function countDelta(curr: number, prev: number) {
  if (prev === 0) return null;
  const p = ((curr - prev) / prev) * 100;
  return { label: `${p >= 0 ? '+' : ''}${p.toFixed(1)}%`, isUp: p >= 0 };
}

function CostEfficiency({ d }: { d: FocusStats }) {
  const metrics = [
    {
      label: 'Cost Per Lead',
      cost: d.platformConversions > 0 ? d.totalSpend / d.platformConversions : null,
      count: d.platformConversions,
      prevCount: d.prevConversions,
      countLabel: 'Leads',
      delta: cpDelta(d.totalSpend, d.platformConversions, d.prevSpend, d.prevConversions),
    },
    {
      label: 'Cost Per MQL',
      cost: d.totalMqls > 0 ? d.totalSpend / d.totalMqls : null,
      count: d.totalMqls,
      prevCount: d.prevMqls,
      countLabel: 'MQLs',
      delta: cpDelta(d.totalSpend, d.totalMqls, d.prevSpend, d.prevMqls),
    },
    {
      label: 'Cost Per SQL',
      cost: d.totalSqls > 0 ? d.totalSpend / d.totalSqls : null,
      count: d.totalSqls,
      prevCount: d.prevSqls,
      countLabel: 'SQLs',
      delta: cpDelta(d.totalSpend, d.totalSqls, d.prevSpend, d.prevSqls),
    },
    {
      label: 'Cost Per Won',
      cost: d.totalWon > 0 ? d.totalSpend / d.totalWon : null,
      count: d.totalWon,
      prevCount: d.prevWon,
      countLabel: 'Won',
      delta: cpDelta(d.totalSpend, d.totalWon, d.prevSpend, d.prevWon),
    },
  ];

  return (
    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
      <h3 className="text-base font-bold text-brand-dark mb-4">Cost Efficiency</h3>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((m) => {
          const isWon = m.label === 'Cost Per Won';
          return (
          <div key={m.label} className={cn('rounded-2xl p-5 flex flex-col gap-3', isWon ? 'bg-brand-forest/5 border-2 border-brand-forest/25 ring-1 ring-brand-forest/10' : 'bg-gray-50')}>
            <div className="flex items-start justify-between">
              <div className="flex flex-col gap-1">
                <p className={cn('text-xs font-bold uppercase tracking-widest leading-tight', isWon ? 'text-brand-forest' : 'text-gray-400')}>{m.label}</p>
                {isWon && <span className="text-[9px] font-bold uppercase tracking-widest text-brand-forest bg-brand-forest/10 px-1.5 py-0.5 rounded-full w-fit">North Star</span>}
              </div>
              {m.delta ? (
                <div className={cn(
                  'flex items-center text-xs font-bold px-2 py-0.5 rounded-full shrink-0',
                  m.delta.isImprovement ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
                )}>
                  {m.delta.isImprovement
                    ? <ArrowDownRight className="w-3 h-3 mr-0.5" />
                    : <ArrowUpRight   className="w-3 h-3 mr-0.5" />}
                  {m.delta.label}
                </div>
              ) : (
                <span className="text-xs text-gray-300 font-semibold">—</span>
              )}
            </div>
            <p className="text-2xl font-bold text-brand-dark tabular-nums">
              {m.cost !== null ? fmt$(m.cost) : '—'}
            </p>
            <div className="flex items-center justify-between pt-1 border-t border-gray-200">
              <div className="flex items-center gap-1.5">
                <span className="text-xl font-bold text-brand-forest tabular-nums">{fmtN(m.count)}</span>
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{m.countLabel}</span>
              </div>
              {(() => { const cd = countDelta(m.count, m.prevCount); return cd && (
                <div className={cn('flex items-center text-xs font-bold px-2 py-0.5 rounded-full', cd.isUp ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600')}>
                  {cd.isUp ? <ArrowUpRight className="w-3 h-3 mr-0.5" /> : <ArrowDownRight className="w-3 h-3 mr-0.5" />}
                  {cd.label}
                </div>
              ); })()}
            </div>
          </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Funnel ───────────────────────────────────────────────────────────────────

function FunnelPanel({ d }: { d: FocusStats }) {
  const mqlRate = d.platformConversions > 0 ? (d.totalMqls / d.platformConversions) * 100 : 0;
  const sqlRate = d.totalMqls > 0 ? (d.totalSqls / d.totalMqls) * 100 : 0;
  const wonRate = d.totalSqls > 0 ? (d.totalWon / d.totalSqls) * 100 : 0;

  // Funnel narrows: each bar is proportional to volume relative to top-of-funnel
  const topVal = d.platformConversions || 1;
  const stages = [
    {
      label: 'Leads',
      value: d.platformConversions,
      widthPct: 100,
      color: 'bg-purple-50 border-purple-200 text-purple-700',
      sub: null as null | { icon: typeof Phone; label: string; value: number; color: string }[],
    },
    {
      label: 'MQLs',
      value: d.totalMqls,
      widthPct: Math.min((d.totalMqls / topVal) * 100, 100),
      color: 'bg-brand-forest/10 border-brand-forest/20 text-brand-forest',
      sub: [
        { icon: Phone, label: 'Call', value: d.callMqls, color: 'text-blue-500' },
        { icon: FileText, label: 'Form', value: d.enrollmentMqls, color: 'text-purple-500' },
      ],
    },
    {
      label: 'SQLs',
      value: d.totalSqls,
      widthPct: Math.min((d.totalSqls / topVal) * 100, 100),
      color: 'bg-blue-50 border-blue-200 text-blue-600',
      sub: [
        { icon: Phone, label: 'Call', value: d.callSqls, color: 'text-blue-500' },
        { icon: FileText, label: 'Form', value: d.enrollmentSqls, color: 'text-purple-500' },
      ],
    },
    {
      label: 'Closed Won',
      value: d.totalWon,
      widthPct: Math.min((d.totalWon / topVal) * 100, 100),
      color: 'bg-brand-forest/15 border-brand-forest/40 text-brand-forest',
      isNorthStar: true,
      sub: [
        { icon: Phone, label: 'Call', value: d.callWon, color: 'text-blue-500' },
        { icon: FileText, label: 'Form', value: d.enrollmentWon, color: 'text-purple-500' },
      ],
    },
  ];

  // Connectors between each pair of stages
  const connectors = [
    {
      rate: d.platformConversions > 0 ? `${mqlRate.toFixed(1)}%` : '—',
      label: 'Lead → MQL',
      avgDays: null as number | null,
    },
    {
      rate: d.totalMqls > 0 ? `${sqlRate.toFixed(1)}%` : '—',
      label: 'MQL → SQL',
      avgDays: d.avgDaysMqlToSql > 0 ? d.avgDaysMqlToSql : null,
    },
    {
      rate: d.totalSqls > 0 ? `${wonRate.toFixed(1)}%` : '—',
      label: 'SQL → Close',
      avgDays: d.avgDaysSqlToWon > 0 ? d.avgDaysSqlToWon : null,
    },
  ];

  return (
    <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm">
      <h3 className="text-xl font-bold text-brand-dark mb-1">Funnel Distribution</h3>
      <p className="text-sm text-gray-400 font-medium mb-6">Conversion rate &amp; time to deal by stage</p>
      <div className="space-y-0">
        {stages.map((stage, i) => (
          <div key={stage.label}>
            {/* Stage bar */}
            <div className={cn(stage.isNorthStar && 'rounded-2xl bg-brand-forest/5 p-3 -mx-3 border border-brand-forest/15')}>
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-2">
                  <span className={cn('text-sm font-bold', stage.isNorthStar ? 'text-brand-forest' : 'text-gray-700')}>{stage.label}</span>
                  {stage.isNorthStar && <span className="text-[10px] font-bold uppercase tracking-widest text-brand-forest bg-brand-forest/10 px-2 py-0.5 rounded-full">North Star</span>}
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
              {stage.sub && (
                <div className="flex gap-4 mt-1.5 pl-1">
                  {stage.sub.map(({ icon: Icon, label, value, color }) => (
                    <div key={label} className="flex items-center gap-1.5">
                      <Icon className={cn('w-3 h-3', color)} />
                      <span className="text-xs text-gray-400">{label}: <strong className="text-gray-600">{fmtN(value)}</strong></span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Connector (between stages) */}
            {i < stages.length - 1 && (() => {
              const conn = connectors[i];
              return (
                <div className="flex items-center gap-2 py-2 pl-2">
                  <div className="flex flex-col items-center shrink-0">
                    <ChevronDown className="w-3.5 h-3.5 text-gray-300" />
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                      {conn.rate} converted
                    </span>
                    {conn.avgDays !== null && (
                      <span className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-blue-600 border border-blue-100">
                        <Clock className="w-3 h-3" />
                        avg {conn.avgDays.toFixed(1)}d to {conn.label.split('→ ')[1]}
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


// ─── Main Component ───────────────────────────────────────────────────────────

export default function FocusDashboardClient({ data: d }: { data: FocusStats }) {
  const { start, end } = d.filterParams;
  const totalCtr = d.totalImpressions > 0 ? (d.totalClicks / d.totalImpressions) * 100 : 0;
  const prevCtr  = d.prevImpressions  > 0 ? (d.prevClicks  / d.prevImpressions)  * 100 : 0;
  const cpc      = d.totalClicks > 0 ? d.totalSpend / d.totalClicks : 0;
  const prevCpc  = d.prevClicks  > 0 ? d.prevSpend  / d.prevClicks  : 0;

  const kpis = [
    {
      name: 'Impressions',
      value: d.totalImpressions >= 1_000_000 ? `${(d.totalImpressions / 1_000_000).toFixed(1)}M` : `${(d.totalImpressions / 1000).toFixed(0)}k`,
      change: pct(d.totalImpressions, d.prevImpressions), isUp: up(d.totalImpressions, d.prevImpressions), icon: Eye, color: 'text-purple-600',
    },
    { name: 'Clicks',  value: fmtN(d.totalClicks), change: pct(d.totalClicks, d.prevClicks), isUp: up(d.totalClicks, d.prevClicks), icon: MousePointer2, color: 'text-blue-600' },
    { name: 'CTR',     value: `${totalCtr.toFixed(2)}%`, change: pct(totalCtr, prevCtr),     isUp: up(totalCtr, prevCtr),           icon: Target,        color: 'text-emerald-600' },
    { name: 'Spend',   value: fmt$(d.totalSpend),   change: pct(d.totalSpend, d.prevSpend),  isUp: up(d.totalSpend, d.prevSpend),   icon: DollarSign,    color: 'text-brand-forest' },
    { name: 'CPC',     value: cpc > 0 ? `$${cpc.toFixed(2)}` : '—', change: pct(cpc, prevCpc), isUp: up(prevCpc, cpc), icon: TrendingDown, color: 'text-cyan-600' },
    { name: 'Leads',   value: fmtN(d.platformConversions), change: pct(d.platformConversions, d.prevConversions), isUp: up(d.platformConversions, d.prevConversions), icon: BarChart2, color: 'text-brand-orange' },
    {
      name: 'Cost Per Lead',
      value: d.platformConversions > 0 ? `$${Math.round(d.totalSpend / d.platformConversions).toLocaleString()}` : '—',
      change: pct(
        d.prevConversions > 0 ? d.prevSpend / d.prevConversions : 0,
        d.platformConversions > 0 ? d.totalSpend / d.platformConversions : 0,
      ),
      isUp: d.platformConversions > 0 && d.prevConversions > 0
        ? up(d.prevSpend / d.prevConversions, d.totalSpend / d.platformConversions)
        : true,
      icon: TrendingDown,
      color: 'text-brand-forest',
    },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-20">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-brand-dark tracking-tight">{FOCUS_LABELS[d.focus] ?? d.focus}</h1>
          <p className="text-gray-500 mt-1">{fmtDateRange(start, end)} · Filtered by focus segment</p>
        </div>
      </div>

      {/* Date Selector */}
      <FocusDateSelector d={d} />

      {/* Budget Pacing */}
      <BudgetPacing d={d} />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4">
        {kpis.map((k, i) => <KpiCard key={k.name} {...k} delay={i * 0.05} />)}
      </div>

      {/* Cost Efficiency */}
      <CostEfficiency d={d} />

      {/* Trend Chart + Funnel */}
      <div className="grid lg:grid-cols-3 gap-8">
        <TrendChart dailyData={d.dailyData} dateRange={fmtDateRange(start, end)} defaultMetric="mql" />
        <FunnelPanel d={d} />
      </div>

      {/* Channel Breakdown Table */}
      <ChannelTable initialChannels={d.channels} />

      {/* Product Performance Table */}
      <ChannelTable
        initialChannels={d.products}
        firstColumnLabel="Product"
        title="Product Performance"
        subtitle="Metrics by product line · Badges show change vs. comparison period"
      />

      {/* Meta Creatives */}
      <MetaAdPreviews creatives={d.metaCreatives} advertiserName="PrePass" logoUrl="/prepass-social-logo.jpg" />

      {/* Google Search Creatives */}
      <GoogleAdPreviews creatives={d.googleCreatives} />

    </div>
  );
}
