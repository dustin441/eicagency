'use client';

import React, { useState, useTransition } from 'react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp, Pencil, Check, X } from 'lucide-react';
import type { BloomDashboardData } from '@/services/bloom-analytics';
import FilterBar from '@/components/FilterBar';
import { MetaAdPreviews } from '@/components/AdPreviews';

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
  label, value, prev, format, invert = false, isNorthStar = false,
}: {
  label: string; value: number; prev: number;
  format: (n: number) => string; invert?: boolean; isNorthStar?: boolean;
}) {
  return (
    <div className={`rounded-xl border shadow-sm p-5 flex flex-col gap-2 ${isNorthStar ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-gray-100'}`}>
      <div className="flex items-center gap-2 flex-wrap">
        <p className={`text-xs font-semibold uppercase tracking-widest ${isNorthStar ? 'text-emerald-700' : 'text-gray-400'}`}>{label}</p>
        {isNorthStar && <span className="text-xs font-bold text-brand-orange bg-brand-orange/10 px-1.5 py-0.5 rounded-full">North Star</span>}
      </div>
      <p className={`text-2xl font-bold ${isNorthStar ? 'text-emerald-900' : 'text-gray-900'}`}>{format(value)}</p>
      <DeltaBadge curr={value} prev={prev} invert={invert} />
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
    <span className="inline-flex items-center gap-1 ml-1">
      <span className="text-gray-400 text-xs">$</span>
      <input
        type="text"
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
        className="w-20 text-xs border border-gray-200 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-brand-forest"
        autoFocus
      />
      <button onClick={save} disabled={isPending} className="text-emerald-600 hover:text-emerald-700"><Check size={13} /></button>
      <button onClick={() => setEditing(false)} className="text-gray-400 hover:text-gray-600"><X size={13} /></button>
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
  pacing: BloomDashboardData['budgetPacing'];
  isAdmin: boolean;
  updateBudget: (n: number) => Promise<{ error?: string }>;
}) {
  const { budget, spend, monthStart, monthEnd } = pacing;
  const pct = budget ? Math.min((spend / budget) * 100, 100) : 0;
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const dayOfMonth = now.getDate() - 1; // yesterday — today's data not yet synced
  const idealPct = (dayOfMonth / daysInMonth) * 100;
  const pacingStatus = budget
    ? spend / budget >= idealPct / 100 - 0.05 ? 'on-track' : 'behind'
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
              <span className="text-2xl font-bold text-gray-900">{fmt$(spend)}</span>
              <span className="text-sm text-gray-400 ml-1">spent</span>
            </div>
            <div className="text-right flex items-center">
              <span className="text-sm text-gray-500">of </span>
              <span className="text-sm font-semibold text-gray-700 ml-1">{fmt$(budget)}</span>
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
          <div className="flex justify-between text-xs text-gray-400">
            <span>{pct.toFixed(1)}% spent</span>
            <span>{idealPct.toFixed(1)}% ideal pace</span>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Trend Chart ─────────────────────────────────────────────────────────────

type TrendMetricKey = 'impressions' | 'clicks' | 'ctr' | 'websiteChats' | 'costPerWebchat';

const TREND_METRICS: { key: TrendMetricKey; label: string; color: string; rightFmt: (v: number) => string; tooltipFmt: (v: number) => string }[] = [
  { key: 'websiteChats',   label: 'Website Chats',   color: '#0B4A31', rightFmt: v => fmtN(v), tooltipFmt: v => fmtN(v) },
  { key: 'costPerWebchat', label: 'Cost/Webchat',    color: '#EB541E', rightFmt: v => '$' + v.toFixed(0), tooltipFmt: v => fmt$(v) },
  { key: 'impressions',    label: 'Impressions',     color: '#6366f1', rightFmt: v => v >= 1_000_000 ? `${(v/1_000_000).toFixed(1)}M` : v >= 1_000 ? `${(v/1_000).toFixed(0)}K` : String(v), tooltipFmt: v => fmtN(v) },
  { key: 'clicks',         label: 'Clicks',          color: '#f59e0b', rightFmt: v => v >= 1_000 ? `${(v/1_000).toFixed(0)}K` : String(v), tooltipFmt: v => fmtN(v) },
  { key: 'ctr',            label: 'CTR',             color: '#10b981', rightFmt: v => v.toFixed(1) + '%', tooltipFmt: v => fmtPct(v) },
];

function TrendChart({ timeSeries }: { timeSeries: BloomDashboardData['timeSeries'] }) {
  const [activeMetric, setActiveMetric] = useState<TrendMetricKey>('websiteChats');

  if (timeSeries.length === 0) return null;

  const chartData = timeSeries.map(p => ({
    ...p,
    ctr: p.impressions > 0 ? (p.clicks / p.impressions) * 100 : 0,
    costPerWebchat: p.websiteChats > 0 ? p.spend / p.websiteChats : 0,
  }));

  const metric = TREND_METRICS.find(m => m.key === activeMetric)!;

  const tickFormatter = (label: string) => {
    const d = new Date(label + 'T00:00:00Z');
    return (d.getMonth() + 1) + '/' + d.getDate();
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h3 className="text-sm font-semibold text-gray-700">Spend Over Time</h3>
        <div className="flex flex-wrap gap-1.5">
          {TREND_METRICS.map(m => (
            <button
              key={m.key}
              onClick={() => setActiveMetric(m.key)}
              className={`text-xs px-2.5 py-1 rounded-full font-semibold transition-colors ${
                activeMetric === m.key
                  ? 'text-white'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
              style={activeMetric === m.key ? { background: m.color } : {}}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <ComposedChart data={chartData} margin={{ top: 4, right: 48, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
          <XAxis dataKey="label" tickFormatter={tickFormatter} tick={{ fontSize: 11, fill: '#9ca3af' }} tickLine={false} axisLine={false} />
          <YAxis yAxisId="left" orientation="left" tickFormatter={v => '$' + (v >= 1000 ? (v/1000).toFixed(0)+'k' : v)} tick={{ fontSize: 11, fill: '#9ca3af' }} tickLine={false} axisLine={false} width={48} />
          <YAxis yAxisId="right" orientation="right" tickFormatter={metric.rightFmt} tick={{ fontSize: 11, fill: metric.color }} tickLine={false} axisLine={false} width={52} />
          <Tooltip
            formatter={(value, name) => {
              if (name === 'Spend') return [fmt$(Number(value)), 'Spend'];
              return [metric.tooltipFmt(Number(value)), metric.label];
            }}
            labelFormatter={label => {
              const d = new Date(label + 'T00:00:00Z');
              return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            }}
            contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12 }}
          />
          <Bar yAxisId="left" dataKey="spend" name="Spend" fill="#0B4A31" opacity={0.7} radius={[2, 2, 0, 0]} />
          <Line yAxisId="right" type="monotone" dataKey={activeMetric} name={metric.label} stroke={metric.color} strokeWidth={2} dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Campaign Table ───────────────────────────────────────────────────────────

function CampaignTable({ rows }: { rows: BloomDashboardData['campaignRows'] }) {
  if (rows.length === 0) return null;

  const cols = [
    { key: 'campaign' as const, label: 'Campaign', numeric: false, fmt: (v: string) => v },
    { key: 'spend' as const, label: 'Spend', numeric: true, fmt: fmt$ },
    { key: 'websiteChats' as const, label: 'Chats', numeric: true, fmt: fmtN },
    { key: 'costPerWebchat' as const, label: 'Cost/Webchat', numeric: true, fmt: fmt$ },
    { key: 'clicks' as const, label: 'Clicks', numeric: true, fmt: fmtN },
    { key: 'ctr' as const, label: 'CTR', numeric: true, fmt: fmtPct },
    { key: 'impressions' as const, label: 'Impressions', numeric: true, fmt: fmtN },
  ];

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-700">Campaign Performance</h3>
        <p className="text-xs text-gray-400 mt-0.5">Top 25 by spend</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/50">
              {cols.map(c => (
                <th key={c.key} className={`px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider ${c.numeric ? 'text-right' : 'text-left'}`}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {rows.map((row, i) => (
              <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                {cols.map(c => (
                  <td key={c.key} className={`px-4 py-3 text-gray-700 ${c.numeric ? 'text-right font-mono text-xs' : 'max-w-[280px] truncate text-sm'}`}>
                    {c.fmt(row[c.key] as never)}
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

// ─── Weekly Notes ─────────────────────────────────────────────────────────────

function WeeklyNotes({ readout }: { readout: BloomDashboardData['weeklyReadout'] }) {
  const [open, setOpen] = useState(true);

  if (!readout) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Weekly Notes</h3>
        <p className="text-sm text-gray-400">No weekly notes yet. Notes will appear here once published.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50/50 transition-colors"
      >
        <div>
          <h3 className="text-sm font-semibold text-gray-700 text-left">Weekly Notes</h3>
          <p className="text-xs text-gray-400 text-left mt-0.5">{readout.periodStart} – {readout.periodEnd}</p>
        </div>
        {open ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
      </button>
      {open && (
        <div className="px-6 pb-6 border-t border-gray-100 space-y-5 pt-4">
          {readout.overallStory && (
            <p className="text-sm text-gray-700 leading-relaxed">{readout.overallStory}</p>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {readout.wins.length > 0 && (
              <div className="bg-emerald-50/60 rounded-lg p-4">
                <p className="text-xs font-bold uppercase tracking-widest text-emerald-700 mb-2">Wins</p>
                <ul className="space-y-1.5">
                  {readout.wins.map((w, i) => (
                    <li key={i} className="flex gap-2 text-sm text-gray-700">
                      <span className="text-emerald-500 mt-0.5 shrink-0">✓</span>
                      {w}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {readout.opportunities.length > 0 && (
              <div className="bg-amber-50/70 rounded-lg p-4">
                <p className="text-xs font-bold uppercase tracking-widest text-amber-700 mb-2">Opportunities</p>
                <ul className="space-y-1.5">
                  {readout.opportunities.map((o, i) => (
                    <li key={i} className="flex gap-2 text-sm text-gray-700">
                      <span className="text-amber-500 mt-0.5 shrink-0">→</span>
                      {o}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          {readout.accomplishments.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">Accomplishments</p>
              <ul className="space-y-1">
                {readout.accomplishments.map((a, i) => (
                  <li key={i} className="text-sm text-gray-600 flex gap-2">
                    <span className="text-gray-300 shrink-0">•</span>{a}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {readout.focusNextWeek.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">Focus Next Week</p>
              <ul className="space-y-1">
                {readout.focusNextWeek.map((f, i) => (
                  <li key={i} className="text-sm text-gray-600 flex gap-2">
                    <span className="text-gray-300 shrink-0">•</span>{f}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function BloomDashboardClient({
  data,
  isAdmin,
  updateBudget,
}: {
  data: BloomDashboardData;
  isAdmin: boolean;
  updateBudget: (n: number) => Promise<{ error?: string }>;
}) {
  const { summary, prevSummary, timeSeries, campaignRows, metaCreatives, weeklyReadout, budgetPacing } = data;

  return (
    <div className="min-h-screen bg-gray-50/50">
      <div className="bg-white border-b border-gray-100 px-6 py-5">
        <div className="max-w-7xl mx-auto flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900">Bloom Aesthetics</h1>
              <p className="text-sm text-gray-400 mt-0.5">Performance Dashboard</p>
            </div>
          </div>
          <FilterBar />
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">

        {/* Budget Pacing */}
        <BudgetPacing pacing={budgetPacing} isAdmin={isAdmin} updateBudget={updateBudget} />

        {/* Weekly Notes */}
        <WeeklyNotes readout={weeklyReadout} />

        {/* KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 gap-4">
          <KpiCard label="Impressions" value={summary.impressions} prev={prevSummary.impressions} format={fmtN} />
          <KpiCard label="Clicks" value={summary.clicks} prev={prevSummary.clicks} format={fmtN} />
          <KpiCard label="CTR" value={summary.ctr} prev={prevSummary.ctr} format={fmtPct} />
          <KpiCard label="Spend" value={summary.spend} prev={prevSummary.spend} format={fmt$} />
          <KpiCard label="CPC" value={summary.cpc} prev={prevSummary.cpc} format={fmt$} invert />
          <KpiCard label="Website Chats" value={summary.websiteChats} prev={prevSummary.websiteChats} format={fmtN} />
          <KpiCard label="Cost / Webchat" value={summary.costPerWebchat} prev={prevSummary.costPerWebchat} format={fmt$} invert isNorthStar />
        </div>

        {/* Trend Chart */}
        <TrendChart timeSeries={timeSeries} />

        {/* Campaign Table */}
        <CampaignTable rows={campaignRows} />

        {/* Meta Ad Creatives */}
        <MetaAdPreviews
          creatives={metaCreatives}
          title="Meta Ad Creatives"
          description="Meta ad-level creative performance for Bloom Aesthetics"
          advertiserName="Bloom Aesthetics"
          metricMode="leads"
        />

      </div>
    </div>
  );
}
