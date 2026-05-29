'use client';

import React, { useState, useTransition } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import {
  Pencil, Check, X, TrendingUp, TrendingDown, Minus,
  ChevronDown, ChevronUp, CheckCircle2, AlertTriangle, ClipboardList,
} from 'lucide-react';
import type { BridgewayDashboardData } from '@/services/bridgeway-analytics';
import FilterBar from '@/components/FilterBar';

// ─── helpers ────────────────────────────────────────────────────────────────

function fmt$(n: number) {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
function fmtN(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
function fmtPct(n: number) {
  return n.toFixed(2) + '%';
}
function delta(curr: number, prev: number) {
  if (prev === 0) return null;
  return ((curr - prev) / prev) * 100;
}
function fmtDelta(d: number | null) {
  if (d === null) return null;
  return (d >= 0 ? '+' : '') + d.toFixed(1) + '%';
}

// ─── sub-components ──────────────────────────────────────────────────────────

function DeltaBadge({ curr, prev, invert = false }: { curr: number; prev: number; invert?: boolean }) {
  const d = delta(curr, prev);
  if (d === null) return null;
  const positive = invert ? d < 0 : d > 0;
  const neutral = Math.abs(d) < 0.5;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-semibold px-1.5 py-0.5 rounded-full ${
      neutral ? 'bg-gray-100 text-gray-500' :
      positive ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'
    }`}>
      {neutral ? <Minus size={10} /> : positive ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
      {fmtDelta(d)}
    </span>
  );
}

function KpiCard({
  label, value, prev, format, invert = false, goal, goalFmt,
}: {
  label: string; value: number; prev: number;
  format: (n: number) => string; invert?: boolean;
  goal?: number; goalFmt?: (v: number) => string;
}) {
  const onTrack = goal !== undefined ? (invert ? value <= goal : value >= goal) : null;
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex flex-col gap-2">
      <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">{label}</p>
      <p className="text-2xl font-bold text-gray-900">{format(value)}</p>
      <DeltaBadge curr={value} prev={prev} invert={invert} />
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
    <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
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

function WeeklyExecutiveSummary({ readout }: { readout: BridgewayDashboardData['weeklyReadout'] }) {
  const [expanded, setExpanded] = useState(false);

  if (!readout) {
    return (
      <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Weekly Executive Summary</h3>
        <p className="text-sm text-gray-400">No weekly executive summary yet. It will appear here once published.</p>
      </section>
    );
  }

  return (
    <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Weekly Executive Summary</p>
          <h2 className="mt-2 text-xl font-bold text-gray-900">Bridgeway Insurance</h2>
          <p className="mt-1 text-xs font-medium text-gray-400">{readout.periodStart} - {readout.periodEnd}</p>
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

// ─── Trend Chart ─────────────────────────────────────────────────────────────

const METRIC_LABELS: Record<string, string> = {
  conversions: '60+ Sec Calls',
  impressions: 'Impressions',
  clicks: 'Clicks',
  costPerConversion: 'Cost / 60+ Sec Call',
};

function TrendChart({ timeSeries }: { timeSeries: BridgewayDashboardData['timeSeries'] }) {
  const [activeMetric, setActiveMetric] = useState<'conversions' | 'impressions' | 'clicks' | 'costPerConversion'>('conversions');

  const metrics = [
    { key: 'conversions' as const,        label: '60+ Sec Calls',      color: '#0B4A31' },
    { key: 'impressions' as const,        label: 'Impressions',         color: '#6366f1' },
    { key: 'clicks' as const,             label: 'Clicks',              color: '#f59e0b' },
    { key: 'costPerConversion' as const,  label: 'Cost / 60+ Sec Call', color: '#ec4899' },
  ];

  const activeLabel = METRIC_LABELS[activeMetric];

  const data = timeSeries.map(d => ({
    date: d.label.slice(5),
    Spend: d.spend,
    [activeLabel]: d[activeMetric],
  }));

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-700">Spend & Performance</h3>
        <div className="flex gap-1">
          {metrics.map(m => (
            <button
              key={m.key}
              onClick={() => setActiveMetric(m.key)}
              className={`px-3 py-1 text-xs font-medium rounded-full border transition-colors ${
                activeMetric === m.key
                  ? 'border-brand-forest bg-brand-forest/5 text-brand-forest'
                  : 'border-gray-200 text-gray-500 hover:border-gray-300'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <AreaChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="bwSpendGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#EB541E" stopOpacity={0.15} />
              <stop offset="95%" stopColor="#EB541E" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="bwMetricGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#0B4A31" stopOpacity={0.12} />
              <stop offset="95%" stopColor="#0B4A31" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9ca3af' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
          <YAxis yAxisId="spend" orientation="left" tick={{ fontSize: 11, fill: '#9ca3af' }} tickLine={false} axisLine={false} tickFormatter={v => '$' + (v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v)} />
          <YAxis yAxisId="metric" orientation="right" tick={{ fontSize: 11, fill: '#9ca3af' }} tickLine={false} axisLine={false} tickFormatter={v => activeMetric === 'costPerConversion' ? '$' + Number(v).toFixed(0) : fmtN(Number(v))} />
          <Tooltip
            contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)' }}
            formatter={(value, name) => [
              value == null ? '—' : name === 'Spend' ? fmt$(Number(value)) : fmtN(Number(value)),
              String(name),
            ]}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Area yAxisId="spend" type="monotone" dataKey="Spend" stroke="#EB541E" strokeWidth={2} fill="url(#bwSpendGrad)" dot={false} />
          <Area yAxisId="metric" type="monotone" dataKey={activeLabel} stroke="#0B4A31" strokeWidth={2} fill="url(#bwMetricGrad)" dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Channel Breakdown Table ─────────────────────────────────────────────────

function ChannelBreakdown({ channelRows }: { channelRows: BridgewayDashboardData['channelRows'] }) {
  type SortKey = 'spend' | 'impressions' | 'clicks' | 'conversions';
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'spend', dir: 'desc' });

  const sorted = [...channelRows].sort((a, b) => {
    const diff = a[sort.key] - b[sort.key];
    return sort.dir === 'desc' ? -diff : diff;
  });

  function toggleSort(key: SortKey) {
    setSort(prev => prev.key === key ? { key, dir: prev.dir === 'desc' ? 'asc' : 'desc' } : { key, dir: 'desc' });
  }

  const cols: { key: SortKey; label: string; fmt: (v: number) => string; prevKey: keyof typeof channelRows[0]; invert?: boolean }[] = [
    { key: 'spend',       label: 'Spend',       fmt: fmt$, prevKey: 'prevSpend' },
    { key: 'impressions', label: 'Impressions',  fmt: fmtN, prevKey: 'prevImpressions' },
    { key: 'clicks',      label: 'Clicks',       fmt: fmtN, prevKey: 'prevClicks' },
    { key: 'conversions', label: '60+ Sec Calls', fmt: fmtN, prevKey: 'prevConversions' },
  ];

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-700">Channel Breakdown</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left">
              <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Channel</th>
              {cols.map(c => (
                <th
                  key={c.key}
                  onClick={() => toggleSort(c.key)}
                  className={`px-4 py-3 text-xs font-semibold uppercase tracking-wide text-right cursor-pointer whitespace-nowrap hover:text-gray-800 transition-colors ${
                    sort.key === c.key ? 'text-brand-forest' : 'text-gray-500'
                  }`}
                >
                  {c.label}{sort.key === c.key ? (sort.dir === 'desc' ? ' ↓' : ' ↑') : ''}
                </th>
              ))}
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-right text-gray-500 whitespace-nowrap">CTR</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-right text-gray-500 whitespace-nowrap">Cost / 60+ Sec</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {sorted.map(ch => {
              const ctr = ch.impressions > 0 ? (ch.clicks / ch.impressions) * 100 : 0;
              const prevCtr = ch.prevImpressions > 0 ? (ch.prevClicks / ch.prevImpressions) * 100 : 0;
              const cpc = ch.conversions > 0 ? ch.spend / ch.conversions : 0;
              const prevCpc = ch.prevConversions > 0 ? ch.prevSpend / ch.prevConversions : 0;
              return (
                <tr key={ch.channel} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <span className="flex items-center gap-2 font-semibold text-gray-800">
                      <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${ch.channel === 'Meta' ? 'bg-blue-500' : 'bg-brand-orange'}`} />
                      {ch.channel}
                    </span>
                  </td>
                  {cols.map(c => (
                    <td key={c.key} className="px-4 py-4 text-right">
                      <div className="font-mono text-sm text-gray-800">{c.fmt(ch[c.key] as number)}</div>
                      <DeltaBadge curr={ch[c.key] as number} prev={ch[c.prevKey] as number} invert={c.invert} />
                    </td>
                  ))}
                  <td className="px-4 py-4 text-right">
                    <div className="font-mono text-sm text-gray-800">{fmtPct(ctr)}</div>
                    <DeltaBadge curr={ctr} prev={prevCtr} />
                  </td>
                  <td className="px-4 py-4 text-right">
                    <div className="font-mono text-sm text-gray-800">{cpc > 0 ? fmt$(cpc) : '—'}</div>
                    {cpc > 0 && <DeltaBadge curr={cpc} prev={prevCpc} invert />}
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

// ─── Campaign Table ──────────────────────────────────────────────────────────

function CampaignTable({ rows }: { rows: BridgewayDashboardData['campaignRows'] }) {
  const [sort, setSort] = useState<{ key: keyof typeof rows[0]; dir: 'asc' | 'desc' }>({ key: 'spend', dir: 'desc' });

  const sorted = [...rows].sort((a, b) => {
    const av = a[sort.key] as number;
    const bv = b[sort.key] as number;
    return sort.dir === 'desc' ? bv - av : av - bv;
  });

  function toggleSort(key: keyof typeof rows[0]) {
    setSort(prev => prev.key === key ? { key, dir: prev.dir === 'desc' ? 'asc' : 'desc' } : { key, dir: 'desc' });
  }

  const cols: { key: keyof typeof rows[0]; label: string; fmt: (v: number | string) => string; numeric: boolean }[] = [
    { key: 'campaign', label: 'Campaign', fmt: v => String(v), numeric: false },
    { key: 'channel',  label: 'Channel',  fmt: v => String(v), numeric: false },
    { key: 'spend',    label: 'Spend',    fmt: v => fmt$(v as number), numeric: true },
    { key: 'impressions', label: 'Impr.', fmt: v => fmtN(v as number), numeric: true },
    { key: 'clicks',   label: 'Clicks',   fmt: v => fmtN(v as number), numeric: true },
    { key: 'ctr',      label: 'CTR',      fmt: v => fmtPct(v as number), numeric: true },
    { key: 'conversions', label: '60+ Sec', fmt: v => fmtN(v as number), numeric: true },
    { key: 'costPerConversion', label: 'Cost/60s', fmt: v => (v as number) > 0 ? fmt$(v as number) : '—', numeric: true },
  ];

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-700">Campaign Performance</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left">
              {cols.map(c => (
                <th
                  key={c.key}
                  onClick={() => c.numeric && toggleSort(c.key)}
                  className={`px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500 whitespace-nowrap ${
                    c.numeric ? 'cursor-pointer hover:text-gray-800 text-right' : ''
                  } ${sort.key === c.key ? 'text-brand-forest' : ''}`}
                >
                  {c.label}
                  {sort.key === c.key && (sort.dir === 'desc' ? ' ↓' : ' ↑')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {sorted.map((row, i) => (
              <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                {cols.map(c => (
                  <td key={c.key} className={`px-4 py-3 text-gray-700 ${c.numeric ? 'text-right font-mono text-xs' : 'max-w-[260px] truncate'}`}>
                    {c.key === 'channel' ? (
                      <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                        row.channel === 'Meta' ? 'bg-blue-50 text-blue-700' : 'bg-orange-50 text-brand-orange'
                      }`}>
                        {row.channel}
                      </span>
                    ) : c.fmt(row[c.key])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Budget Pacing ────────────────────────────────────────────────────────────

function BudgetPacing({
  pacing,
  isAdmin,
  updateBudget,
}: {
  pacing: BridgewayDashboardData['budgetPacing'];
  isAdmin: boolean;
  updateBudget: (n: number) => Promise<{ error?: string }>;
}) {
  const { budget, metaSpend, googleSpend, totalSpend, monthStart, monthEnd } = pacing;
  const pct = budget ? Math.min((totalSpend / budget) * 100, 100) : 0;
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const dayOfMonth = now.getDate() - 1; // yesterday — today's data not yet synced
  const idealPct = (dayOfMonth / daysInMonth) * 100;
  const pacingStatus = budget
    ? totalSpend / budget >= idealPct / 100 - 0.05
      ? 'on-track' : 'behind'
    : null;

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-700">Budget Pacing</h3>
          <p className="text-xs text-gray-400 mt-0.5">{monthStart} – {monthEnd}</p>
        </div>
        {budget !== null && (
          <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
            pacingStatus === 'on-track' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
          }`}>
            {pacingStatus === 'on-track' ? 'On Track' : 'Behind Pace'}
          </span>
        )}
      </div>

      {budget === null ? (
        <p className="text-sm text-gray-400">Budget not configured.</p>
      ) : (
        <>
          <div className="flex items-end justify-between mb-2">
            <div>
              <span className="text-2xl font-bold text-gray-900">{fmt$(totalSpend)}</span>
              <span className="text-sm text-gray-400 ml-1">spent</span>
            </div>
            <div className="text-right">
              <span className="text-sm text-gray-500">of </span>
              <span className="text-sm font-semibold text-gray-700">{fmt$(budget)}</span>
              {isAdmin && <BudgetEdit current={budget} updateBudget={updateBudget} />}
            </div>
          </div>

          <div className="relative h-3 bg-gray-100 rounded-full overflow-hidden mb-1">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #0B4A31, #1a7a52)' }}
            />
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-gray-400/60"
              style={{ left: `${Math.min(idealPct, 99)}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-400 mb-4">
            <span>{pct.toFixed(1)}% spent</span>
            <span>{idealPct.toFixed(1)}% ideal pace</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-blue-50/60 rounded-lg p-3">
              <p className="text-xs font-semibold text-blue-700 mb-1">Meta</p>
              <p className="text-lg font-bold text-gray-900">{fmt$(metaSpend)}</p>
              <div className="mt-1.5 h-1.5 bg-blue-100 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full" style={{ width: `${budget ? Math.min((metaSpend / budget) * 100, 100) : 0}%` }} />
              </div>
            </div>
            <div className="bg-orange-50/60 rounded-lg p-3">
              <p className="text-xs font-semibold text-brand-orange mb-1">Google</p>
              <p className="text-lg font-bold text-gray-900">{fmt$(googleSpend)}</p>
              <div className="mt-1.5 h-1.5 bg-orange-100 rounded-full overflow-hidden">
                <div className="h-full bg-brand-orange rounded-full" style={{ width: `${budget ? Math.min((googleSpend / budget) * 100, 100) : 0}%` }} />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function BridgewayDashboardClient({
  data,
  isAdmin,
  updateBudget,
}: {
  data: BridgewayDashboardData;
  isAdmin: boolean;
  updateBudget: (n: number) => Promise<{ error?: string }>;
}) {
  const { summary, prevSummary, timeSeries, channelRows, campaignRows, budgetPacing, weeklyReadout } = data;

  return (
    <div className="min-h-screen bg-gray-50/50">
      <div className="bg-white border-b border-gray-100 px-6 py-5">
        <div className="max-w-7xl mx-auto flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900">Bridgeway</h1>
              <p className="text-sm text-gray-400 mt-0.5">Performance Dashboard</p>
            </div>
          </div>
          <FilterBar />
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">

        <WeeklyExecutiveSummary readout={weeklyReadout} />

        <BudgetPacing pacing={budgetPacing} isAdmin={isAdmin} updateBudget={updateBudget} />

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <KpiCard label="Spend"        value={summary.spend}              prev={prevSummary.spend}              format={fmt$} />
          <KpiCard label="Impressions"  value={summary.impressions}        prev={prevSummary.impressions}        format={fmtN} />
          <KpiCard label="Clicks"       value={summary.clicks}             prev={prevSummary.clicks}             format={fmtN} />
          <KpiCard label="CTR"          value={summary.ctr}                prev={prevSummary.ctr}                format={fmtPct} />
          <KpiCard label="60+ Sec Calls"        value={summary.conversions}        prev={prevSummary.conversions}        format={fmtN} />
          <KpiCard label="Cost / 60+ Sec Call" value={summary.costPerConversion}  prev={prevSummary.costPerConversion}  format={fmt$} invert goal={30} goalFmt={fmt$} />
        </div>

        <TrendChart timeSeries={timeSeries} />

        <ChannelBreakdown channelRows={channelRows} />

        <CampaignTable rows={campaignRows} />

      </div>
    </div>
  );
}
