'use client';

import React, { useState, useTransition } from 'react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';
import { ComposableMap, Geographies, Geography } from 'react-simple-maps';
import { TrendingUp, TrendingDown, Pencil, Check, X, CheckCircle2, AlertTriangle, ClipboardList, ChevronDown, ChevronUp } from 'lucide-react';
import type { GoodGameDashboardData, GoodGameTimePoint, GoodGameFocusStats, GoodGameBudgetPacing, GoodGameWeeklyReadout, StockistStateRow } from '@/services/goodgame-analytics';
import FilterBar from '@/components/FilterBar';
import { MetaAdPreviews } from '@/components/AdPreviews';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt$(n: number) {
  return '$' + n.toLocaleString('en-US', { maximumFractionDigits: 0 });
}
function fmt$2(n: number) {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtN(n: number) {
  return n.toLocaleString('en-US', { maximumFractionDigits: 0 });
}
function fmtX(n: number) {
  return n.toFixed(2) + 'x';
}
function fmtPct(n: number) {
  return n.toFixed(2) + '%';
}
function fmtShort(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return String(Math.round(n));
}
function delta(curr: number, prev: number) {
  if (prev === 0) return null;
  return ((curr - prev) / prev) * 100;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function DeltaBadge({ curr, prev, invert = false, forceNeutral = false }: { curr: number; prev: number; invert?: boolean; forceNeutral?: boolean }) {
  const d = delta(curr, prev);
  if (d === null) return null;
  const positive = invert ? d < 0 : d > 0;
  const neutral = forceNeutral || Math.abs(d) < 0.5;
  const str = (d >= 0 ? '+' : '') + d.toFixed(1) + '%';
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-semibold px-1.5 py-0.5 rounded-full ${
      neutral ? 'bg-gray-100 text-gray-500' :
      positive ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'
    }`}>
      {neutral ? (d >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />) : positive ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
      {str}
    </span>
  );
}

function KpiCard({
  label, value, prev, format, invert = false, highlight = false, forceNeutral = false, goal, goalFmt,
}: {
  label: string; value: number; prev: number;
  format: (n: number) => string; invert?: boolean; highlight?: boolean; forceNeutral?: boolean;
  goal?: number; goalFmt?: (v: number) => string;
}) {
  const onTrack = goal !== undefined ? (invert ? value <= goal : value >= goal) : null;
  return (
    <div className={`bg-white rounded-xl border shadow-sm p-5 flex flex-col gap-2 ${highlight ? 'border-brand-forest ring-1 ring-brand-forest/20' : 'border-gray-100'}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">{label}</p>
        {highlight && (
          <span className="text-[10px] font-bold text-brand-forest bg-brand-forest/10 px-2 py-0.5 rounded-full shrink-0">North Star</span>
        )}
      </div>
      <p className="text-2xl font-bold text-gray-900">{format(value)}</p>
      <DeltaBadge curr={value} prev={prev} invert={invert} forceNeutral={forceNeutral} />
      {goal !== undefined && goalFmt && (
        <div className="mt-1 pt-2 border-t border-gray-100 flex items-center justify-between gap-1">
          <span className="text-xs text-gray-600">Goal: {goalFmt(goal)}</span>
          <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${onTrack ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-700'}`}>
            {onTrack ? '✓ On Track' : '✗ Off Track'}
          </span>
        </div>
      )}
    </div>
  );
}

function ReadoutColumn({
  title,
  items,
  icon,
}: {
  title: string;
  items: string[];
  icon: React.ReactNode;
}) {
  if (!items.length) return null;

  return (
    <div className="rounded-2xl border border-gray-100 bg-gray-50 p-5">
      <div className="flex items-center gap-2 text-sm font-bold text-gray-900">
        {icon}
        {title}
      </div>
      <ul className="mt-3 space-y-2">
        {items.map((item, index) => (
          <li key={`${title}-${index}`} className="text-sm leading-6 text-gray-600">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function WeeklyExecutiveSummary({ readout }: { readout: GoodGameWeeklyReadout | null }) {
  const [expanded, setExpanded] = useState(false);

  if (!readout) {
    return (
      <section className="rounded-[2rem] border border-gray-100 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Weekly Executive Summary</p>
        <p className="mt-2 text-sm text-gray-500">No weekly executive summary has been published yet.</p>
      </section>
    );
  }

  const period = `${readout.periodStart} to ${readout.periodEnd}`;

  return (
    <section className="rounded-[2rem] border border-gray-100 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Weekly Executive Summary</p>
          <h2 className="mt-2 text-xl font-bold text-gray-900">Good Game - Nappy Boy Dranks</h2>
          <p className="mt-1 text-xs font-medium text-gray-400">{period}</p>
        </div>
        <button
          type="button"
          onClick={() => setExpanded(value => !value)}
          className="inline-flex w-fit items-center gap-2 rounded-full border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 transition-colors hover:border-gray-300 hover:bg-gray-50"
        >
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          {expanded ? 'Hide details' : 'Show details'}
        </button>
      </div>

      {readout.overallStory && (
        <p className="mt-5 max-w-5xl text-sm leading-7 text-gray-700">{readout.overallStory}</p>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <ReadoutColumn title="Wins" items={readout.wins} icon={<CheckCircle2 size={16} className="text-emerald-600" />} />
        <ReadoutColumn title="Opportunities" items={readout.opportunities} icon={<AlertTriangle size={16} className="text-amber-500" />} />
        <ReadoutColumn title="Next Week" items={readout.focusNextWeek} icon={<ClipboardList size={16} className="text-brand-orange" />} />
      </div>

      {expanded && (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <ReadoutColumn title="Accomplishments" items={readout.accomplishments} icon={<CheckCircle2 size={16} className="text-brand-forest" />} />
          <ReadoutColumn title="Context" items={readout.executionContext} icon={<ClipboardList size={16} className="text-gray-500" />} />
        </div>
      )}
    </section>
  );
}

// ─── Trend Chart ──────────────────────────────────────────────────────────────

const GG_METRICS: { key: string; label: string; color: string; fmt: (v: number) => string }[] = [
  { key: 'clicks',           label: 'Site Clicks',        color: '#EB541E', fmt: (v) => Math.round(v).toLocaleString() },
  { key: 'landingPageViews', label: 'LP Views',           color: '#0EA5E9', fmt: (v) => Math.round(v).toLocaleString() },
  { key: 'impressions',      label: 'Impressions',        color: '#8B5CF6', fmt: (v) => fmtShort(v) },
  { key: 'purchases',        label: 'Purchases',          color: '#10B981', fmt: (v) => Math.round(v).toLocaleString() },
  { key: 'revenue',          label: 'Revenue',            color: '#3B82F6', fmt: (v) => `$${Math.round(v).toLocaleString()}` },
  { key: 'ctr',              label: 'CTR',                color: '#F59E0B', fmt: (v) => `${v.toFixed(2)}%` },
  { key: 'cpc',              label: 'CPC',                color: '#EC4899', fmt: (v) => `$${v.toFixed(2)}` },
  { key: 'costPerLpv',       label: 'Cost / LP View',     color: '#64748B', fmt: (v) => `$${v.toFixed(2)}` },
  { key: 'roas',             label: 'ROAS',               color: '#6366F1', fmt: (v) => `${v.toFixed(2)}x` },
  { key: 'views75',          label: '75% Views',          color: '#14B8A6', fmt: (v) => Math.round(v).toLocaleString() },
  { key: 'costPer75',        label: 'Cost / 75% View',    color: '#F97316', fmt: (v) => `$${v.toFixed(2)}` },
];

type BucketPoint = {
  label: string;
  spend: number;
  impressions: number;
  clicks: number;
  landingPageViews: number;
  purchases: number;
  revenue: number;
  ctr: number;
  cpc: number;
  costPerLpv: number;
  roas: number;
  views75: number;
  costPer75: number;
};

function bucketData(data: GoodGameTimePoint[], type: 'daily' | 'weekly' | 'monthly'): BucketPoint[] {
  const acc = new Map<string, { spend: number; impressions: number; clicks: number; landingPageViews: number; purchases: number; revenue: number; views75: number }>();

  for (const d of data) {
    let key: string;
    if (type === 'daily') {
      key = d.label;
    } else if (type === 'weekly') {
      const dt = new Date(d.label + 'T12:00:00');
      const dow = dt.getDay();
      const diff = dow === 0 ? -6 : 1 - dow;
      dt.setDate(dt.getDate() + diff);
      key = dt.toISOString().split('T')[0];
    } else {
      key = d.label.slice(0, 7);
    }
    const e = acc.get(key) ?? { spend: 0, impressions: 0, clicks: 0, landingPageViews: 0, purchases: 0, revenue: 0, views75: 0 };
    e.spend += d.spend;
    e.impressions += d.impressions;
    e.clicks += d.clicks;
    e.landingPageViews += d.landingPageViews;
    e.purchases += d.purchases;
    e.revenue += d.revenue;
    e.views75 += d.views75;
    acc.set(key, e);
  }

  return Array.from(acc.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, v]) => ({
      label,
      ...v,
      ctr:        v.impressions > 0     ? (v.clicks / v.impressions) * 100 : 0,
      cpc:        v.clicks > 0          ? v.spend / v.clicks               : 0,
      costPerLpv: v.landingPageViews > 0 ? v.spend / v.landingPageViews    : 0,
      roas:       v.spend > 0           ? v.revenue / v.spend              : 0,
      costPer75:  v.views75 > 0         ? v.spend / v.views75              : 0,
    }));
}

function tickLabel(label: string, type: 'daily' | 'weekly' | 'monthly') {
  const d = new Date(label + 'T12:00:00');
  if (type === 'monthly') return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function GoodGameTrendChart({ data, start, end }: { data: GoodGameTimePoint[]; start: string; end: string }) {
  const [activeMetrics, setActiveMetrics] = useState<Set<string>>(new Set(['purchases']));

  function toggleMetric(key: string) {
    setActiveMetrics(prev => {
      const next = new Set(prev);
      if (next.has(key)) { if (next.size > 1) next.delete(key); }
      else next.add(key);
      return next;
    });
  }

  const days = Math.round(
    (new Date(end + 'T12:00:00').getTime() - new Date(start + 'T12:00:00').getTime()) / 86_400_000
  ) + 1;
  const bucketType: 'daily' | 'weekly' | 'monthly' = days <= 14 ? 'daily' : days <= 90 ? 'weekly' : 'monthly';
  const bucketLabel = bucketType === 'daily' ? 'Daily' : bucketType === 'weekly' ? 'Weekly' : 'Monthly';

  const chartData = bucketData(data, bucketType);
  const activeList = GG_METRICS.filter(m => activeMetrics.has(m.key));

  const dateRangeStr = [
    new Date(start + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    new Date(end + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
  ].join(' – ');

  return (
    <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm">
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-xl font-bold text-[#0f172a]">Spend vs. Metrics</h3>
            <p className="text-sm text-gray-400 font-medium">{dateRangeStr} · {bucketLabel}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-3 h-3 rounded-full bg-[#0B4A31]/20 border border-[#0B4A31]" />
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Spend</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {GG_METRICS.map(m => {
            const active = activeMetrics.has(m.key);
            return (
              <button
                key={m.key}
                onClick={() => toggleMetric(m.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
                  active ? 'text-white border-transparent' : 'bg-gray-50 border-gray-200 text-gray-400 hover:border-gray-300 hover:text-gray-600'
                }`}
                style={active ? { backgroundColor: m.color, borderColor: m.color } : {}}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: active ? 'rgba(255,255,255,0.8)' : m.color }} />
                {m.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="h-[320px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#9CA3AF', fontSize: 10, fontWeight: 600 }}
              dy={10}
              interval="preserveStartEnd"
              tickFormatter={v => tickLabel(v, bucketType)}
            />
            <YAxis
              yAxisId="left"
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#9CA3AF', fontSize: 10, fontWeight: 600 }}
              tickFormatter={v => `$${(v / 1000).toFixed(0)}k`}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#9CA3AF', fontSize: 10, fontWeight: 600 }}
            />
            <Tooltip
              contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px', fontSize: '13px' }}
              formatter={(value, name) => {
                if (name === 'spend') return [`$${Number(value).toLocaleString()}`, 'Spend'];
                const m = GG_METRICS.find(x => x.key === name);
                return m ? [m.fmt(Number(value)), m.label] : [String(value), String(name)];
              }}
              labelFormatter={label => tickLabel(String(label), bucketType)}
            />
            <Bar yAxisId="left" dataKey="spend" fill="#0B4A31" fillOpacity={0.12} stroke="#0B4A31" radius={[4, 4, 0, 0]} barSize={16} />
            {activeList.map(m => (
              <Line
                key={m.key}
                yAxisId="right"
                type="monotone"
                dataKey={m.key}
                stroke={m.color}
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 5, fill: m.color, strokeWidth: 2, stroke: '#fff' }}
              />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─── Channel Table ────────────────────────────────────────────────────────────

function ChannelTable({ rows }: { rows: GoodGameDashboardData['channelRows'] }) {
  return (
    <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
      <div className="p-8 border-b border-gray-50">
        <h3 className="text-xl font-bold text-[#0f172a]">Channel Breakdown</h3>
        <p className="text-sm text-gray-400 font-medium mt-1">Performance by channel · Selected period</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Channel</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Impressions</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Site Clicks</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">LP Views</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">CTR</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Cost</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">CPC</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Purchases</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Revenue</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">ROAS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {rows.map((row) => {
              const ctr = row.impressions > 0 ? (row.clicks / row.impressions) * 100 : 0;
              const prevCtr = row.prevImpressions > 0 ? (row.prevClicks / row.prevImpressions) * 100 : 0;
              const cpc = row.clicks > 0 ? row.spend / row.clicks : 0;
              const prevCpc = row.prevClicks > 0 ? row.prevSpend / row.prevClicks : 0;
              const roas = row.spend > 0 ? row.revenue / row.spend : 0;
              const prevRoas = row.prevSpend > 0 ? row.prevRevenue / row.prevSpend : 0;
              return (
                <tr key={row.channel} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${
                      row.channel === 'Meta' ? 'bg-blue-50 text-blue-700' : row.channel === 'StackAdapt' ? 'bg-purple-50 text-purple-700' : 'bg-red-50 text-red-700'
                    }`}>
                      {row.channel}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <p className="text-gray-600">{fmtShort(row.impressions)}</p>
                    <DeltaBadge curr={row.impressions} prev={row.prevImpressions} />
                  </td>
                  <td className="px-4 py-4 text-right">
                    <p className="text-gray-600">{fmtN(row.clicks)}</p>
                    <DeltaBadge curr={row.clicks} prev={row.prevClicks} />
                  </td>
                  <td className="px-4 py-4 text-right">
                    <p className="text-gray-600">{fmtN(row.landingPageViews)}</p>
                    <DeltaBadge curr={row.landingPageViews} prev={row.prevLandingPageViews} />
                  </td>
                  <td className="px-4 py-4 text-right">
                    <p className="text-gray-600">{fmtPct(ctr)}</p>
                    <DeltaBadge curr={ctr} prev={prevCtr} />
                  </td>
                  <td className="px-4 py-4 text-right">
                    <p className="font-semibold text-gray-800">{fmt$(row.spend)}</p>
                    <DeltaBadge curr={row.spend} prev={row.prevSpend} forceNeutral />
                  </td>
                  <td className="px-4 py-4 text-right">
                    <p className="text-gray-600">{cpc > 0 ? fmt$2(cpc) : '—'}</p>
                    {cpc > 0 && <DeltaBadge curr={cpc} prev={prevCpc} invert />}
                  </td>
                  <td className="px-4 py-4 text-right">
                    <p className="text-gray-600">{fmtN(row.purchases)}</p>
                    <DeltaBadge curr={row.purchases} prev={row.prevPurchases} />
                  </td>
                  <td className="px-4 py-4 text-right">
                    <p className="text-gray-600">{fmt$(row.revenue)}</p>
                    <DeltaBadge curr={row.revenue} prev={row.prevRevenue} />
                  </td>
                  <td className="px-4 py-4 text-right">
                    <p className="font-semibold text-gray-800">{roas > 0 ? fmtX(roas) : '—'}</p>
                    {roas > 0 && <DeltaBadge curr={roas} prev={prevRoas} />}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Budget Edit ─────────────────────────────────────────────────────────────

function BudgetEdit({
  current,
  updateBudget,
}: {
  current: number;
  updateBudget: (n: number) => Promise<{ error?: string }>;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(current));
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();

  function save() {
    const n = parseFloat(value.replace(/[^0-9.]/g, ''));
    if (isNaN(n) || n <= 0) { setError('Enter a valid amount'); return; }
    setError('');
    startTransition(async () => {
      const res = await updateBudget(n);
      if (res.error) setError(res.error);
      else setEditing(false);
    });
  }

  if (!editing) {
    return (
      <button
        onClick={() => { setValue(String(current)); setEditing(true); }}
        className="ml-1 text-gray-400 hover:text-brand-forest transition-colors"
        title="Edit budget"
      >
        <Pencil size={13} />
      </button>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 ml-2">
      <span className="text-gray-400 text-sm">$</span>
      <input
        autoFocus
        type="number"
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
        className="w-24 border border-gray-300 rounded px-2 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-forest"
      />
      <button onClick={save} disabled={isPending} className="text-emerald-600 hover:text-emerald-700">
        <Check size={15} />
      </button>
      <button onClick={() => setEditing(false)} className="text-gray-400 hover:text-gray-600">
        <X size={15} />
      </button>
      {error && <span className="text-xs text-red-500">{error}</span>}
    </span>
  );
}

// ─── Budget Pacing ────────────────────────────────────────────────────────────

function BudgetPacing({
  pacing,
  isAdmin,
  updateBudget,
}: {
  pacing: GoodGameBudgetPacing;
  isAdmin: boolean;
  updateBudget: (n: number) => Promise<{ error?: string }>;
}) {
  const { budget, metaSpend, googleSpend, stackadaptSpend, totalSpend, monthStart, monthEnd } = pacing;
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const idealPct = ((now.getDate() - 1) / daysInMonth) * 100; // yesterday — today's data not yet synced
  const monthLabel = new Date(monthStart + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const hasBudget = budget !== null && budget > 0;
  const pct = hasBudget ? Math.min((totalSpend / budget!) * 100, 100) : 0;
  const onTrack = hasBudget ? totalSpend / budget! >= idealPct / 100 - 0.05 : false;

  return (
    <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-bold text-[#0f172a]">Budget Pacing</h3>
          <p className="text-sm text-gray-400 font-medium mt-1">{monthLabel} · {monthStart} – {monthEnd}</p>
        </div>
        {hasBudget && (
          <span className={`text-xs font-semibold px-3 py-1.5 rounded-full ${
            onTrack ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
          }`}>
            {onTrack ? 'On Track' : 'Behind Pace'}
          </span>
        )}
      </div>

      {/* Spend vs budget */}
      <div className="flex items-end justify-between mb-2">
        <div>
          <span className="text-3xl font-bold text-gray-900">{fmt$(totalSpend)}</span>
          <span className="text-sm text-gray-400 ml-2">spent</span>
        </div>
        <div className="text-right flex items-center gap-1">
          <span className="text-sm text-gray-500">of </span>
          {hasBudget ? (
            <>
              <span className="text-sm font-semibold text-gray-700">{fmt$(budget!)} budget</span>
              {isAdmin && <BudgetEdit current={budget!} updateBudget={updateBudget} />}
            </>
          ) : (
            <>
              <span className="text-sm text-gray-400">no budget set</span>
              {isAdmin && <BudgetEdit current={0} updateBudget={updateBudget} />}
            </>
          )}
        </div>
      </div>

      {/* Main progress bar */}
      <div className="relative h-3 bg-gray-100 rounded-full overflow-hidden mb-1">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #0B4A31, #1a7a52)' }}
        />
        {hasBudget && (
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-gray-400/60"
            style={{ left: `${Math.min(idealPct, 99)}%` }}
          />
        )}
      </div>
      <div className="flex justify-between text-xs text-gray-400 mb-6">
        <span>{hasBudget ? `${pct.toFixed(1)}% spent` : '—'}</span>
        <span>{hasBudget ? `${idealPct.toFixed(1)}% ideal pace` : ''}</span>
      </div>

      {/* Platform split */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-blue-50/60 rounded-2xl p-4">
          <p className="text-xs font-semibold text-blue-700 mb-1">Meta</p>
          <p className="text-xl font-bold text-gray-900">{fmt$(metaSpend)}</p>
          {hasBudget && (
            <>
              <div className="mt-2 h-1.5 bg-blue-100 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min((metaSpend / budget!) * 100, 100)}%` }} />
              </div>
              <p className="text-[11px] text-gray-400 mt-1">{((metaSpend / budget!) * 100).toFixed(1)}% of budget</p>
            </>
          )}
        </div>
        <div className="bg-red-50/60 rounded-2xl p-4">
          <p className="text-xs font-semibold text-brand-orange mb-1">Google</p>
          <p className="text-xl font-bold text-gray-900">{fmt$(googleSpend)}</p>
          {hasBudget && (
            <>
              <div className="mt-2 h-1.5 bg-orange-100 rounded-full overflow-hidden">
                <div className="h-full bg-brand-orange rounded-full" style={{ width: `${Math.min((googleSpend / budget!) * 100, 100)}%` }} />
              </div>
              <p className="text-[11px] text-gray-400 mt-1">{((googleSpend / budget!) * 100).toFixed(1)}% of budget</p>
            </>
          )}
        </div>
        <div className="bg-purple-50/60 rounded-2xl p-4">
          <p className="text-xs font-semibold text-purple-700 mb-1">StackAdapt</p>
          <p className="text-xl font-bold text-gray-900">{fmt$(stackadaptSpend)}</p>
          {hasBudget && (
            <>
              <div className="mt-2 h-1.5 bg-purple-100 rounded-full overflow-hidden">
                <div className="h-full bg-purple-500 rounded-full" style={{ width: `${Math.min((stackadaptSpend / budget!) * 100, 100)}%` }} />
              </div>
              <p className="text-[11px] text-gray-400 mt-1">{((stackadaptSpend / budget!) * 100).toFixed(1)}% of budget</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Focus Section ────────────────────────────────────────────────────────────

const FOCUS_META: Record<string, { color: string; description: string }> = {
  Engagement: { color: '#8B5CF6', description: 'Video engagement · 75% view-through performance' },
  Traffic:    { color: '#3B82F6', description: 'Traffic campaigns · Site clicks & landing page efficiency' },
  Conversion: { color: '#10B981', description: 'Conversion campaigns · Purchase & ROAS metrics' },
};

function FocusSection({ stats }: { stats: GoodGameFocusStats[] }) {
  const tabs = (['Engagement', 'Traffic', 'Conversion'] as const).filter(f =>
    f === 'Conversion' || stats.some(s => s.focus === f)
  );
  const [activeTab, setActiveTab] = useState<string>(tabs[0] ?? 'Engagement');
  const stat = stats.find(s => s.focus === activeTab);
  const meta = FOCUS_META[activeTab];

  return (
    <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-8 border-b border-gray-50">
        <h3 className="text-xl font-bold text-[#0f172a]">Campaign Focus Breakdown</h3>
        <p className="text-sm text-gray-400 font-medium mt-1">Performance by objective · Current vs prior period</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-100">
        {tabs.map(tab => {
          const hasStat = stats.some(s => s.focus === tab);
          const active = activeTab === tab;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex items-center gap-2 px-8 py-4 text-sm font-semibold border-b-2 transition-all ${
                active
                  ? 'border-current -mb-px'
                  : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
              style={active ? { color: FOCUS_META[tab].color, borderColor: FOCUS_META[tab].color } : {}}
            >
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: active ? FOCUS_META[tab].color : '#D1D5DB' }}
              />
              {tab}
              {!hasStat && (
                <span className="text-[10px] font-bold bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded-full ml-1">Soon</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="p-8">
        {!stat ? (
          <div className="text-center py-12">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ backgroundColor: `${meta.color}15` }}
            >
              <span className="text-2xl">🚀</span>
            </div>
            <p className="text-base font-semibold text-gray-500">Conversion campaigns coming soon</p>
            <p className="text-sm text-gray-400 mt-1">Data will appear here once Conversion campaigns are active</p>
          </div>
        ) : activeTab === 'Engagement' ? (
          <div className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">{meta.description}</p>
            {stat.prevSpend === 0 && stat.prevImpressions === 0 && (
              <div className="flex items-center gap-2.5 bg-amber-50 border border-amber-100 rounded-xl px-4 py-2.5 text-xs font-medium text-amber-700">
                <span className="text-amber-500 text-base leading-none">⚡</span>
                No comparison data for this period — these campaigns are newer than the comparison window. Try <span className="font-bold ml-1">Last 14 Days</span>.
              </div>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              <KpiCard label="Spend"            value={stat.spend}       prev={stat.prevSpend}       format={fmt$}     forceNeutral />
              <KpiCard label="Impressions"      value={stat.impressions} prev={stat.prevImpressions} format={fmtShort} />
              <KpiCard label="75% Views"        value={stat.views75}     prev={stat.prevViews75}     format={fmtN} />
              <KpiCard label="Cost per 75% View" value={stat.costPer75} prev={stat.prevViews75 > 0 ? stat.prevSpend / stat.prevViews75 : 0} format={fmt$2} invert goal={0.10} goalFmt={fmt$2} />
              <KpiCard label="Thruplays"        value={stat.thruplays}   prev={stat.prevThruplays}   format={fmtN} />
            </div>
          </div>
        ) : activeTab === 'Traffic' ? (
          <div className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">{meta.description}</p>
            {stat.prevSpend === 0 && stat.prevImpressions === 0 && (
              <div className="flex items-center gap-2.5 bg-amber-50 border border-amber-100 rounded-xl px-4 py-2.5 text-xs font-medium text-amber-700">
                <span className="text-amber-500 text-base leading-none">⚡</span>
                No comparison data for this period — these campaigns are newer than the comparison window. Try <span className="font-bold ml-1">Last 14 Days</span>.
              </div>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <KpiCard label="Spend"       value={stat.spend}       prev={stat.prevSpend}       format={fmt$}     forceNeutral />
              <KpiCard label="Impressions" value={stat.impressions} prev={stat.prevImpressions} format={fmtShort} />
              <KpiCard label="Site Clicks" value={stat.clicks}      prev={stat.prevClicks}      format={fmtN} />
              <KpiCard label="CPC"         value={stat.cpc}         prev={stat.prevClicks > 0 ? stat.prevSpend / stat.prevClicks : 0} format={fmt$2} invert />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ─── Stockist Search Heatmap ─────────────────────────────────────────────────

const GEO_URL = 'https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json';

function interpolateGreen(t: number): string {
  // #D1FAE5 (light) → #0B4A31 (brand-forest dark)
  const r = Math.round(209 + (11 - 209) * t);
  const g = Math.round(250 + (74 - 250) * t);
  const b = Math.round(229 + (49 - 229) * t);
  return `rgb(${r},${g},${b})`;
}

type MapTooltip = { name: string; searches: number; x: number; y: number } | null;

function StockistSearchMap({ data }: { data: StockistStateRow[] }) {
  const [tooltip, setTooltip] = useState<MapTooltip>(null);

  const stateMap = new Map(data.map(d => [d.state, d.searches]));
  const maxSearches = Math.max(...data.map(d => d.searches), 1);
  const totalSearches = data.reduce((s, d) => s + d.searches, 0);

  function getColor(name: string): string {
    const n = stateMap.get(name) ?? 0;
    if (n === 0) return '#F3F4F6';
    const t = Math.log(n + 1) / Math.log(maxSearches + 1);
    return interpolateGreen(t);
  }

  const top5 = [...data].sort((a, b) => b.searches - a.searches).slice(0, 5);

  return (
    <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-8">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h3 className="text-xl font-bold text-[#0f172a]">Store Finder Search Activity</h3>
          <p className="text-sm text-gray-400 font-medium mt-1">
            Where customers are searching for Good Game · {fmtN(totalSearches)} total searches
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0 mt-1">
          <span className="text-xs text-gray-400 font-medium">Low</span>
          <div className="flex gap-0.5">
            {[0.1, 0.3, 0.5, 0.7, 0.9].map(t => (
              <div key={t} className="w-5 h-3 rounded-sm" style={{ backgroundColor: interpolateGreen(t) }} />
            ))}
          </div>
          <span className="text-xs text-gray-400 font-medium">High</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Map */}
        <div className="lg:col-span-3 relative">
          <ComposableMap
            projection="geoAlbersUsa"
            className="w-full"
            style={{ height: 'auto' }}
          >
            <Geographies geography={GEO_URL}>
              {({ geographies }) =>
                geographies.map(geo => {
                  const name: string = geo.properties.name;
                  const searches = stateMap.get(name) ?? 0;
                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      fill={getColor(name)}
                      stroke="#fff"
                      strokeWidth={0.8}
                      style={{
                        default: { outline: 'none' },
                        hover: { outline: 'none', opacity: 0.85 },
                        pressed: { outline: 'none' },
                      }}
                      onMouseEnter={(e: React.MouseEvent) => {
                        setTooltip({ name, searches, x: e.clientX, y: e.clientY });
                      }}
                      onMouseMove={(e: React.MouseEvent) => {
                        setTooltip(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : null);
                      }}
                      onMouseLeave={() => setTooltip(null)}
                    />
                  );
                })
              }
            </Geographies>
          </ComposableMap>

          {tooltip && (
            <div
              className="fixed z-50 pointer-events-none bg-white border border-gray-200 rounded-xl shadow-lg px-3 py-2 text-sm"
              style={{ left: tooltip.x + 12, top: tooltip.y - 40 }}
            >
              <p className="font-semibold text-gray-900">{tooltip.name}</p>
              <p className="text-gray-500">
                {tooltip.searches > 0 ? `${fmtN(tooltip.searches)} searches` : 'No searches'}
              </p>
            </div>
          )}
        </div>

        {/* Top states list */}
        <div className="lg:col-span-1">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-4">Top States</p>
          <div className="space-y-3">
            {top5.map((row, i) => (
              <div key={row.state}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center text-[10px] font-bold text-gray-500">
                      {i + 1}
                    </span>
                    {row.state}
                  </span>
                  <span className="text-sm font-bold text-gray-900">{fmtN(row.searches)}</span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${(row.searches / maxSearches) * 100}%`,
                      backgroundColor: interpolateGreen(Math.log(row.searches + 1) / Math.log(maxSearches + 1)),
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-400 font-medium">
              {data.length} states with searches
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function GoodGameDashboardClient({
  data,
  isAdmin,
  updateBudget,
}: {
  data: GoodGameDashboardData;
  isAdmin: boolean;
  updateBudget: (n: number) => Promise<{ error?: string }>;
}) {
  const { summary, prevSummary, timeSeries, channelRows, campaignRows, focusStats, metaCreatives, budgetPacing, weeklyReadout, stockistHeatmap } = data;
  const hasPurchases = summary.purchases > 0 || campaignRows.some(r => r.purchases > 0);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Good Game</h1>
        <p className="text-sm text-gray-500 mt-1">Meta + Google + StackAdapt Performance · Good Game Energy by T-Pain</p>
      </div>

      <FilterBar
        channelOptions={[
          { value: 'all',        label: 'All Channels' },
          { value: 'Google',     label: 'Google Ads'   },
          { value: 'Meta',       label: 'Meta Ads'     },
          { value: 'StackAdapt', label: 'StackAdapt'   },
        ]}
      />

      <WeeklyExecutiveSummary readout={weeklyReadout} />

      {/* Budget Pacing */}
      <BudgetPacing pacing={budgetPacing} isAdmin={isAdmin} updateBudget={updateBudget} />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-5 gap-4">
        <KpiCard label="Impressions"    value={summary.impressions}           prev={prevSummary.impressions}           format={fmtShort} />
        <KpiCard label="Site Clicks"    value={summary.clicks}                prev={prevSummary.clicks}                format={fmtN} />
        <KpiCard label="LP Views"       value={summary.landingPageViews}      prev={prevSummary.landingPageViews}      format={fmtN} />
        <KpiCard label="CTR"            value={summary.ctr}                   prev={prevSummary.ctr}                   format={fmtPct} />
        <KpiCard label="Cost"           value={summary.spend}                 prev={prevSummary.spend}                 format={fmt$} forceNeutral />
        <KpiCard label="CPC"            value={summary.cpc}                   prev={prevSummary.cpc}                   format={fmt$2} invert />
        <KpiCard label="Cost / LP View" value={summary.costPerLandingPageView} prev={prevSummary.costPerLandingPageView} format={fmt$2} invert goal={0.75} goalFmt={fmt$2} />
        <KpiCard label="Purchases"      value={summary.purchases}             prev={prevSummary.purchases}             format={fmtN} />
        <KpiCard label="Revenue"        value={summary.revenue}               prev={prevSummary.revenue}               format={fmt$} />
        <KpiCard label="ROAS"           value={summary.roas}                  prev={prevSummary.roas}                  format={fmtX} highlight />
      </div>

      {/* Trend Chart */}
      {timeSeries.length > 1 && (
        <GoodGameTrendChart data={timeSeries} start={data.filterParams.start} end={data.filterParams.end} />
      )}

      {/* Channel Breakdown */}
      {channelRows.length > 0 && <ChannelTable rows={channelRows} />}

      {/* Focus Breakdown */}
      {focusStats.length > 0 && <FocusSection stats={focusStats} />}

      {/* Campaign Performance */}
      {campaignRows.length > 0 && (
        <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-8 border-b border-gray-50">
            <h3 className="text-xl font-bold text-[#0f172a]">Campaign Performance</h3>
            <p className="text-sm text-gray-400 font-medium mt-1">Top campaigns by spend · Selected period</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Campaign</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Channel</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Spend</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Impressions</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Site Clicks</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">LP Views</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">CTR</th>
                  {hasPurchases && (
                    <>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Purchases</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Revenue</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">ROAS</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {campaignRows.map((row, i) => (
                  <tr key={i} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-gray-900 max-w-xs truncate">{row.campaign}</td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${
                        row.channel === 'Meta' ? 'bg-blue-50 text-blue-700' : row.channel === 'StackAdapt' ? 'bg-purple-50 text-purple-700' : 'bg-red-50 text-red-700'
                      }`}>
                        {row.channel}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right font-semibold text-gray-700">{fmt$(row.spend)}</td>
                    <td className="px-4 py-4 text-right text-gray-500">{fmtShort(row.impressions)}</td>
                    <td className="px-4 py-4 text-right text-gray-500">{fmtN(row.clicks)}</td>
                    <td className="px-4 py-4 text-right text-gray-500">{fmtN(row.landingPageViews)}</td>
                    <td className="px-4 py-4 text-right text-gray-500">{fmtPct(row.ctr)}</td>
                    {hasPurchases && (
                      <>
                        <td className="px-4 py-4 text-right text-gray-500">{fmtN(row.purchases)}</td>
                        <td className="px-4 py-4 text-right text-gray-500">{fmt$(row.revenue)}</td>
                        <td className="px-4 py-4 text-right font-semibold text-gray-700">{fmtX(row.roas)}</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Stockist Search Heatmap */}
      {stockistHeatmap.length > 0 && (
        <StockistSearchMap data={stockistHeatmap} />
      )}

      {/* Meta Ad Creatives — shown when Meta is in scope */}
      {metaCreatives.length > 0 && (
        <MetaAdPreviews
          creatives={metaCreatives}
          title="Meta Ad Creatives"
          description="Ad-level performance · Video ads open in Facebook Ad Library"
          advertiserName="Good Game"
        />
      )}
    </div>
  );
}
