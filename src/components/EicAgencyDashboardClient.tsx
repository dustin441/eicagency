'use client';

import React, { useState, useTransition } from 'react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';
import { TrendingUp, TrendingDown, Pencil, Check, X, CheckCircle2, AlertTriangle, ClipboardList, ChevronDown, ChevronUp } from 'lucide-react';
import type { EicAgencyDashboardData, EicAgencyTimePoint, EicAgencyBudgetPacing, EicAgencyWeeklyReadout } from '@/services/eicagency-analytics';
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
function fmtPct(n: number) {
  return n.toFixed(2) + '%';
}
function fmtDuration(n: number) {
  const totalSeconds = Math.max(0, Math.round(n));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
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
  label, value, prev, format, invert = false, highlight = false, forceNeutral = false,
}: {
  label: string; value: number; prev: number;
  format: (n: number) => string; invert?: boolean; highlight?: boolean; forceNeutral?: boolean;
}) {
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
    </div>
  );
}

function ReadoutColumn({
  title, items, icon,
}: { title: string; items: string[]; icon: React.ReactNode }) {
  if (!items.length) return null;
  return (
    <div className="rounded-2xl border border-gray-100 bg-gray-50 p-5">
      <div className="flex items-center gap-2 text-sm font-bold text-gray-900">
        {icon}
        {title}
      </div>
      <ul className="mt-3 space-y-2">
        {items.map((item, i) => (
          <li key={`${title}-${i}`} className="text-sm leading-6 text-gray-600">{item}</li>
        ))}
      </ul>
    </div>
  );
}

function WeeklyExecutiveSummary({ readout }: { readout: EicAgencyWeeklyReadout | null }) {
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
          <h2 className="mt-2 text-xl font-bold text-gray-900">EIC Agency</h2>
          <p className="mt-1 text-xs font-medium text-gray-400">{period}</p>
        </div>
        <button
          type="button"
          onClick={() => setExpanded(v => !v)}
          className="inline-flex w-fit items-center gap-2 rounded-full border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 transition-colors hover:border-gray-300 hover:bg-gray-50"
        >
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          {expanded ? 'Hide details' : 'Show details'}
        </button>
      </div>

      {readout.overallStory.length > 0 && (
        <ul className="mt-5 max-w-5xl space-y-1.5">
          {readout.overallStory.map((s, i) => (
            <li key={i} className="text-sm leading-7 text-gray-700">{s}</li>
          ))}
        </ul>
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

const EIC_METRICS: { key: string; label: string; color: string; fmt: (v: number) => string }[] = [
  { key: 'leads',       label: 'Leads',       color: '#10B981', fmt: (v) => Math.round(v).toLocaleString() },
  { key: 'clicks',      label: 'Clicks',      color: '#EB541E', fmt: (v) => Math.round(v).toLocaleString() },
  { key: 'impressions', label: 'Impressions',  color: '#8B5CF6', fmt: (v) => fmtShort(v) },
  { key: 'ctr',         label: 'CTR',          color: '#F59E0B', fmt: (v) => `${v.toFixed(2)}%` },
  { key: 'cpc',         label: 'CPC',          color: '#EC4899', fmt: (v) => `$${v.toFixed(2)}` },
  { key: 'cpl',         label: 'CPL',          color: '#6366F1', fmt: (v) => `$${v.toFixed(2)}` },
];

type BucketPoint = {
  label: string;
  spend: number;
  impressions: number;
  clicks: number;
  leads: number;
  ctr: number;
  cpc: number;
  cpl: number;
};

function bucketData(data: EicAgencyTimePoint[], type: 'daily' | 'weekly' | 'monthly'): BucketPoint[] {
  const acc = new Map<string, { spend: number; impressions: number; clicks: number; leads: number }>();

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
    const e = acc.get(key) ?? { spend: 0, impressions: 0, clicks: 0, leads: 0 };
    e.spend += d.spend;
    e.impressions += d.impressions;
    e.clicks += d.clicks;
    e.leads += d.leads;
    acc.set(key, e);
  }

  return Array.from(acc.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, v]) => ({
      label,
      ...v,
      ctr: v.impressions > 0 ? (v.clicks / v.impressions) * 100 : 0,
      cpc: v.clicks > 0      ? v.spend / v.clicks               : 0,
      cpl: v.leads > 0       ? v.spend / v.leads                : 0,
    }));
}

function tickLabel(label: string, type: 'daily' | 'weekly' | 'monthly') {
  const d = new Date(label + 'T12:00:00');
  if (type === 'monthly') return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function EicAgencyTrendChart({ data, start, end }: { data: EicAgencyTimePoint[]; start: string; end: string }) {
  const [activeMetrics, setActiveMetrics] = useState<Set<string>>(new Set(['leads']));

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
  const activeList = EIC_METRICS.filter(m => activeMetrics.has(m.key));

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
          {EIC_METRICS.map(m => {
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
                const m = EIC_METRICS.find(x => x.key === name);
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

function ChannelTable({ rows }: { rows: EicAgencyDashboardData['channelRows'] }) {
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
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Clicks</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">CTR</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Cost</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">CPC</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Leads</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">CPL</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {rows.map((row) => {
              const ctr = row.impressions > 0 ? (row.clicks / row.impressions) * 100 : 0;
              const prevCtr = row.prevImpressions > 0 ? (row.prevClicks / row.prevImpressions) * 100 : 0;
              const cpc = row.clicks > 0 ? row.spend / row.clicks : 0;
              const prevCpc = row.prevClicks > 0 ? row.prevSpend / row.prevClicks : 0;
              const cpl = row.leads > 0 ? row.spend / row.leads : 0;
              const prevCpl = row.prevLeads > 0 ? row.prevSpend / row.prevLeads : 0;
              return (
                <tr key={row.channel} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${
                      row.channel === 'Meta' ? 'bg-blue-50 text-blue-700' : 'bg-red-50 text-red-700'
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
                    <p className="text-gray-600">{fmtN(row.leads)}</p>
                    <DeltaBadge curr={row.leads} prev={row.prevLeads} />
                  </td>
                  <td className="px-4 py-4 text-right">
                    <p className="font-semibold text-gray-800">{cpl > 0 ? fmt$2(cpl) : '—'}</p>
                    {cpl > 0 && <DeltaBadge curr={cpl} prev={prevCpl} invert />}
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
  pacing, isAdmin, updateBudget,
}: {
  pacing: EicAgencyBudgetPacing;
  isAdmin: boolean;
  updateBudget: (n: number) => Promise<{ error?: string }>;
}) {
  const { budget, metaSpend, googleSpend, totalSpend, monthStart, monthEnd } = pacing;
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const idealPct = (now.getDate() / daysInMonth) * 100;
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

      <div className="grid grid-cols-2 gap-4">
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
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function EicAgencyDashboardClient({
  data,
  isAdmin,
  updateBudget,
}: {
  data: EicAgencyDashboardData;
  isAdmin: boolean;
  updateBudget: (n: number) => Promise<{ error?: string }>;
}) {
  const { summary, prevSummary, timeSeries, channelRows, campaignRows, adSetRows, metaCreatives, budgetPacing, weeklyReadout } = data;
  const hasLeads = summary.leads > 0 || campaignRows.some(r => r.leads > 0);
  const hasLandingPageViews = campaignRows.some(r => r.landingPageViews > 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">EIC Agency</h1>
        <p className="text-sm text-gray-500 mt-1">Meta + Google Performance · Internal Marketing</p>
      </div>

      <FilterBar />

      <WeeklyExecutiveSummary readout={weeklyReadout} />

      <BudgetPacing pacing={budgetPacing} isAdmin={isAdmin} updateBudget={updateBudget} />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <KpiCard label="Impressions" value={summary.impressions} prev={prevSummary.impressions} format={fmtShort} />
        <KpiCard label="Clicks"      value={summary.clicks}      prev={prevSummary.clicks}      format={fmtN} />
        <KpiCard label="CTR"         value={summary.ctr}         prev={prevSummary.ctr}         format={fmtPct} />
        <KpiCard label="Cost"        value={summary.spend}       prev={prevSummary.spend}       format={fmt$} forceNeutral />
        <KpiCard label="Leads"       value={summary.leads}       prev={prevSummary.leads}       format={fmtN} />
        <KpiCard label="CPL"         value={summary.cpl}         prev={prevSummary.cpl}         format={fmt$2} invert highlight />
      </div>

      {timeSeries.length > 1 && (
        <EicAgencyTrendChart data={timeSeries} start={data.filterParams.start} end={data.filterParams.end} />
      )}

      {channelRows.length > 0 && <ChannelTable rows={channelRows} />}

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
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Clicks</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">CTR</th>
                  {hasLandingPageViews && (
                    <>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">LPVs</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Cost / LPV</th>
                    </>
                  )}
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Sessions</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Engaged Sessions</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Engagement Rate</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Avg. Session Duration</th>
                  {hasLeads && (
                    <>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Leads</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">CPL</th>
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
                        row.channel === 'Meta' ? 'bg-blue-50 text-blue-700' : 'bg-red-50 text-red-700'
                      }`}>
                        {row.channel}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right font-semibold text-gray-700">{fmt$(row.spend)}</td>
                    <td className="px-4 py-4 text-right text-gray-500">{fmtShort(row.impressions)}</td>
                    <td className="px-4 py-4 text-right text-gray-500">{fmtN(row.clicks)}</td>
                    <td className="px-4 py-4 text-right text-gray-500">{fmtPct(row.ctr)}</td>
                    {hasLandingPageViews && (
                      <>
                        <td className="px-4 py-4 text-right text-gray-500">{row.landingPageViews > 0 ? fmtN(row.landingPageViews) : '—'}</td>
                        <td className="px-4 py-4 text-right font-semibold text-gray-700">{row.costPerLandingPageView > 0 ? fmt$2(row.costPerLandingPageView) : '—'}</td>
                      </>
                    )}
                    <td className="px-4 py-4 text-right text-gray-500">{row.sessions > 0 ? fmtN(row.sessions) : '—'}</td>
                    <td className="px-4 py-4 text-right text-gray-500">{row.sessions > 0 ? fmtN(row.engagedSessions) : '—'}</td>
                    <td className="px-4 py-4 text-right text-gray-500">{row.sessions > 0 ? fmtPct(row.engagementRate) : '—'}</td>
                    <td className="px-4 py-4 text-right text-gray-500">{row.sessions > 0 ? fmtDuration(row.averageSessionDuration) : '—'}</td>
                    {hasLeads && (
                      <>
                        <td className="px-4 py-4 text-right text-gray-500">{fmtN(row.leads)}</td>
                        <td className="px-4 py-4 text-right font-semibold text-gray-700">{row.cpl > 0 ? fmt$2(row.cpl) : '—'}</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {adSetRows.length > 0 && (
        <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-8 border-b border-gray-50">
            <h3 className="text-xl font-bold text-[#0f172a]">Ad Set Performance</h3>
            <p className="text-sm text-gray-400 font-medium mt-1">Meta performance by ad set · Selected period</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Ad Set</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Campaign</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Spend</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Impressions</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Clicks</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">CTR</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">LPVs</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Cost / LPV</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Sessions</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Engaged Sessions</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Engagement Rate</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Avg. Session Duration</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Leads</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">CPL</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {adSetRows.map(row => (
                  <tr key={`${row.campaign}__${row.adSet}`} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-gray-900 min-w-72">{row.adSet}</td>
                    <td className="px-4 py-4 text-gray-500 min-w-64">{row.campaign}</td>
                    <td className="px-4 py-4 text-right font-semibold text-gray-700">{fmt$(row.spend)}</td>
                    <td className="px-4 py-4 text-right text-gray-500">{fmtShort(row.impressions)}</td>
                    <td className="px-4 py-4 text-right text-gray-500">{fmtN(row.clicks)}</td>
                    <td className="px-4 py-4 text-right text-gray-500">{fmtPct(row.ctr)}</td>
                    <td className="px-4 py-4 text-right text-gray-500">{row.landingPageViews > 0 ? fmtN(row.landingPageViews) : '—'}</td>
                    <td className="px-4 py-4 text-right font-semibold text-gray-700">{row.costPerLandingPageView > 0 ? fmt$2(row.costPerLandingPageView) : '—'}</td>
                    <td className="px-4 py-4 text-right text-gray-500">{row.sessions > 0 ? fmtN(row.sessions) : '—'}</td>
                    <td className="px-4 py-4 text-right text-gray-500">{row.sessions > 0 ? fmtN(row.engagedSessions) : '—'}</td>
                    <td className="px-4 py-4 text-right text-gray-500">{row.sessions > 0 ? fmtPct(row.engagementRate) : '—'}</td>
                    <td className="px-4 py-4 text-right text-gray-500">{row.sessions > 0 ? fmtDuration(row.averageSessionDuration) : '—'}</td>
                    <td className="px-4 py-4 text-right text-gray-500">{fmtN(row.leads)}</td>
                    <td className="px-4 py-4 text-right font-semibold text-gray-700">{row.cpl > 0 ? fmt$2(row.cpl) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {metaCreatives.length > 0 && (
        <MetaAdPreviews
          creatives={metaCreatives}
          title="Meta Ad Creatives"
          description="Ad-level performance · Video ads open in Facebook Ad Library"
          advertiserName="EIC Agency"
        />
      )}
    </div>
  );
}
