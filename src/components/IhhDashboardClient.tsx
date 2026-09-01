'use client';

import React, { useState, useTransition } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';
import { Pencil, Check, X, TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp, CheckCircle2, AlertTriangle, ClipboardList } from 'lucide-react';
import type { IhhsDashboardData } from '@/services/ihh-analytics';
import FilterBar from '@/components/FilterBar';
import { MetaAdPreviews } from '@/components/AdPreviews';

// ─── helpers ─────────────────────────────────────────────────────────────────

function fmt$(n: number) {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
function fmtN(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
function fmtPct(n: number) { return n.toFixed(2) + '%'; }

function normalizeOutcomeLabels(value: string) {
  return value
    .replaceAll('Pixel Leads', 'Quiz Takers')
    .replaceAll('Pixel Lead', 'Quiz Taker')
    .replaceAll('Pixel Schedules', 'Appointments Scheduled')
    .replaceAll('Pixel Schedule', 'Appointment Scheduled')
    .replaceAll('Cost per Lead', 'Cost per Quiz Taker')
    .replaceAll('Cost per Schedule', 'Cost per Appointment')
    .replaceAll('Lead-to-Schedule', 'Quiz-to-Appointment');
}

function delta(curr: number, prev: number) {
  if (prev === 0) return null;
  return ((curr - prev) / prev) * 100;
}
function fmtDelta(d: number | null) {
  if (d === null) return null;
  return (d >= 0 ? '+' : '') + d.toFixed(1) + '%';
}

// ─── sub-components ───────────────────────────────────────────────────────────

function DeltaBadge({ curr, prev, invert = false }: { curr: number | null; prev: number | null; invert?: boolean }) {
  if (curr === null || prev === null) return null;
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
  label, value, prev, format, invert = false, goal, goalFmt, colorByComparison = false, nullIsBad = false, badge,
}: {
  label: string; value: number | null; prev: number | null;
  format: (n: number) => string; invert?: boolean;
  goal?: number; goalFmt?: (v: number) => string;
  colorByComparison?: boolean;
  nullIsBad?: boolean;
  badge?: string;
}) {
  const onTrack = goal !== undefined && value !== null ? (invert ? value <= goal : value >= goal) : null;
  const valueClass = value === null && nullIsBad
    ? 'text-red-600'
    : colorByComparison && value !== null && prev !== null
      ? (invert ? value <= prev : value >= prev)
        ? 'text-emerald-700'
        : 'text-red-600'
      : 'text-gray-900';
  return (
    <div className={`rounded-xl border bg-white p-5 shadow-sm flex flex-col gap-2 ${badge ? 'border-emerald-200 ring-1 ring-emerald-100' : 'border-gray-100'}`}>
      <div className="flex flex-col items-start gap-1">
        {badge && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700">{badge}</span>}
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">{label}</p>
      </div>
      <p className={`text-2xl font-bold ${valueClass}`}>{value === null ? (nullIsBad ? 'No outcome' : '—') : format(value)}</p>
      <DeltaBadge curr={value} prev={prev} invert={invert} />
      {goal !== undefined && goalFmt && value !== null && (
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

function EfficiencyValue({
  value,
  benchmark,
  trackedSpend,
  format,
  isCost,
}: {
  value: number | null;
  benchmark: number | null;
  trackedSpend: number;
  format: (n: number) => string;
  isCost: boolean;
}) {
  if (!isCost) {
    return <div className="font-mono text-xs text-gray-800">{value === null ? '—' : format(value)}</div>;
  }

  const className = value === null
    ? trackedSpend > 0 ? 'bg-red-50 text-red-700 ring-red-100' : 'bg-gray-50 text-gray-500 ring-gray-100'
    : benchmark !== null && value <= benchmark
      ? 'bg-emerald-50 text-emerald-700 ring-emerald-100'
      : 'bg-red-50 text-red-700 ring-red-100';

  return (
    <span className={`inline-flex rounded-md px-2 py-1 font-mono text-xs font-semibold ring-1 ring-inset ${className}`}>
      {value === null ? (trackedSpend > 0 ? 'No outcome' : '—') : format(value)}
    </span>
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
            {normalizeOutcomeLabels(item)}
          </li>
        ))}
      </ul>
    </div>
  );
}

function WeeklyExecutiveSummary({ readout }: { readout: IhhsDashboardData['weeklyReadout'] }) {
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
          <h2 className="mt-2 text-xl font-bold text-gray-900">InfiniteHeart Health</h2>
          <p className="mt-1 text-xs font-medium text-gray-400">{readout.periodStart} – {readout.periodEnd}</p>
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
        <p className="mt-5 max-w-5xl text-sm leading-7 text-gray-700">{normalizeOutcomeLabels(readout.overallStory)}</p>
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

// ─── Budget Edit ──────────────────────────────────────────────────────────────

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
  pacing: IhhsDashboardData['budgetPacing'];
  isAdmin: boolean;
  updateBudget: (n: number) => Promise<{ error?: string }>;
}) {
  const { budget, totalSpend, monthStart, monthEnd } = pacing;
  const pct = budget ? Math.min((totalSpend / budget) * 100, 100) : 0;
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const idealPct = ((now.getDate() - 1) / daysInMonth) * 100; // yesterday — today's data not yet synced
  const pacingStatus = budget
    ? totalSpend / budget >= idealPct / 100 - 0.05 ? 'on-track' : 'behind'
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
          <div className="flex justify-between text-xs text-gray-400">
            <span>{pct.toFixed(1)}% spent</span>
            <span>{idealPct.toFixed(1)}% ideal pace</span>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Trend Chart ──────────────────────────────────────────────────────────────

type TrendMetricKey = 'appointments' | 'quizTakers' | 'impressions' | 'linkClicks' | 'linkCtr' | 'spend' | 'costPerAppointment' | 'costPerQuiz';

const trendMetrics: { key: TrendMetricKey; label: string; color: string; format: (v: number) => string }[] = [
  { key: 'appointments', label: 'Appointments Scheduled', color: '#0B4A31', format: fmtN },
  { key: 'quizTakers', label: 'Quiz Takers', color: '#EB541E', format: fmtN },
  { key: 'impressions', label: 'Impressions', color: '#7C3AED', format: fmtN },
  { key: 'linkClicks', label: 'Link Clicks', color: '#2563EB', format: fmtN },
  { key: 'linkCtr', label: 'Link CTR', color: '#0891B2', format: fmtPct },
  { key: 'spend', label: 'Media Spend', color: '#D97706', format: fmt$ },
  { key: 'costPerAppointment', label: 'Cost / Appointment', color: '#BE123C', format: fmt$ },
  { key: 'costPerQuiz', label: 'Cost / Quiz Taker', color: '#9333EA', format: fmt$ },
];

function TrendChart({ timeSeries }: { timeSeries: IhhsDashboardData['timeSeries'] }) {
  const [selectedMetric, setSelectedMetric] = useState<TrendMetricKey>('appointments');
  const metric = trendMetrics.find(option => option.key === selectedMetric) ?? trendMetrics[0];
  const data = timeSeries.map(d => ({
    date: d.label.slice(5),
    appointments: d.scheduledAppointments,
    quizTakers: d.leads,
    impressions: d.impressions,
    linkClicks: d.linkClicks,
    linkCtr: d.impressions > 0 ? (d.linkClicks / d.impressions) * 100 : null,
    spend: d.spend,
    costPerAppointment: d.scheduledAppointments && d.scheduledAppointments > 0 ? d.trackingSpend / d.scheduledAppointments : null,
    costPerQuiz: d.leads && d.leads > 0 ? d.trackingSpend / d.leads : null,
  }));

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
      <div className="mb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-700">Performance Trend</h3>
            <p className="mt-1 text-xs text-gray-400">Choose a metric. Appointments Scheduled is the current North Star.</p>
          </div>
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">North Star: Appointments Scheduled</span>
        </div>
        <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Time series metric">
          {trendMetrics.map(option => (
            <button
              key={option.key}
              type="button"
              onClick={() => setSelectedMetric(option.key)}
              aria-pressed={selectedMetric === option.key}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${selectedMetric === option.key
                ? 'border-brand-forest bg-brand-forest text-white'
                : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:text-gray-900'}`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="ihhSelectedMetricGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={metric.color} stopOpacity={0.18} />
              <stop offset="95%" stopColor={metric.color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9ca3af' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
          <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} tickLine={false} axisLine={false} allowDecimals={selectedMetric === 'linkCtr' || selectedMetric.startsWith('costPer')} />
          <Tooltip
            contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)' }}
            formatter={(value) => [value == null ? '—' : metric.format(Number(value)), metric.label]}
          />
          <Area type="monotone" dataKey={metric.key} name={metric.label} stroke={metric.color} strokeWidth={2.5} fill="url(#ihhSelectedMetricGrad)" dot={false} connectNulls={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Campaign Table ───────────────────────────────────────────────────────────

type CampSortKey = 'spend' | 'impressions' | 'linkClicks' | 'linkCtr' | 'leads' | 'costPerQuizTaker' | 'scheduledAppointments' | 'costPerScheduledAppointment';

function CampaignTable({
  rows,
  quizBenchmark,
  appointmentBenchmark,
}: {
  rows: IhhsDashboardData['campaignRows'];
  quizBenchmark: number | null;
  appointmentBenchmark: number | null;
}) {
  const [sort, setSort] = useState<{ key: CampSortKey; dir: 'asc' | 'desc' }>({ key: 'spend', dir: 'desc' });

  const sorted = [...rows].sort((a, b) => {
    const aValue = a[sort.key];
    const bValue = b[sort.key];
    if (aValue === null) return bValue === null ? 0 : 1;
    if (bValue === null) return -1;
    const diff = aValue - bValue;
    return sort.dir === 'desc' ? -diff : diff;
  });

  function toggleSort(key: CampSortKey) {
    setSort(prev => prev.key === key ? { key, dir: prev.dir === 'desc' ? 'asc' : 'desc' } : { key, dir: 'desc' });
  }

  const cols: { key: CampSortKey; label: string; fmt: (v: number) => string; prevKey: keyof IhhsDashboardData['campaignRows'][0]; invert?: boolean }[] = [
    { key: 'impressions', label: 'Impr.',   fmt: fmtN,    prevKey: 'prevImpressions' },
    { key: 'linkClicks',  label: 'Link Clicks', fmt: fmtN, prevKey: 'prevLinkClicks' },
    { key: 'linkCtr',     label: 'Link CTR', fmt: fmtPct, prevKey: 'prevLinkCtr' },
    { key: 'leads',       label: 'Quiz Takers', fmt: fmtN, prevKey: 'prevLeads' },
    { key: 'costPerQuizTaker', label: 'Cost / Quiz', fmt: fmt$, prevKey: 'prevCostPerQuizTaker', invert: true },
    { key: 'scheduledAppointments', label: 'Appointments Scheduled', fmt: fmtN, prevKey: 'prevScheduledAppointments' },
    { key: 'costPerScheduledAppointment', label: 'Cost / Appointment', fmt: fmt$, prevKey: 'prevCostPerScheduledAppointment', invert: true },
    { key: 'spend',       label: 'Spend',   fmt: fmt$,    prevKey: 'prevSpend' },
  ];

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-700">Campaign Performance</h3>
        <p className="mt-1 text-xs text-gray-400">Cost cells are green at or below the dashboard average and red above it. Spend with no tracked outcome is flagged red.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left">
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Campaign</th>
              {cols.map(c => (
                <th
                  key={c.key}
                  onClick={() => toggleSort(c.key)}
                  className={`px-4 py-3 text-xs font-semibold uppercase tracking-wide text-right cursor-pointer whitespace-nowrap hover:text-gray-800 transition-colors ${
                    sort.key === c.key ? 'text-brand-forest' : 'text-gray-500'
                  }`}
                >
                  {c.label}{sort.key === c.key && (sort.dir === 'desc' ? ' ↓' : ' ↑')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {sorted.map((row, i) => (
              <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                <td className="px-4 py-3 text-gray-700 max-w-[260px] truncate">{row.campaign}</td>
                {cols.map(c => (
                  <td key={c.key} className="px-4 py-3 text-right">
                    <EfficiencyValue
                      value={row[c.key]}
                      format={c.fmt}
                      benchmark={c.key === 'costPerQuizTaker' ? quizBenchmark : c.key === 'costPerScheduledAppointment' ? appointmentBenchmark : null}
                      trackedSpend={row.trackingSpend}
                      isCost={c.key === 'costPerQuizTaker' || c.key === 'costPerScheduledAppointment'}
                    />
                    <DeltaBadge curr={row[c.key]} prev={row[c.prevKey] as number | null} invert={c.invert} />
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

type AdSortKey = 'spend' | 'impressions' | 'linkClicks' | 'linkCtr' | 'leads' | 'costPerQuizTaker' | 'scheduledAppointments' | 'costPerScheduledAppointment';

function AdPerformanceTable({
  rows,
  quizBenchmark,
  appointmentBenchmark,
}: {
  rows: IhhsDashboardData['adRows'];
  quizBenchmark: number | null;
  appointmentBenchmark: number | null;
}) {
  const [sort, setSort] = useState<{ key: AdSortKey; dir: 'asc' | 'desc' }>({ key: 'spend', dir: 'desc' });

  const sorted = [...rows].sort((a, b) => {
    const aValue = a[sort.key];
    const bValue = b[sort.key];
    if (aValue === null) return bValue === null ? 0 : 1;
    if (bValue === null) return -1;
    const diff = aValue - bValue;
    return sort.dir === 'desc' ? -diff : diff;
  });

  function toggleSort(key: AdSortKey) {
    setSort(prev => prev.key === key ? { key, dir: prev.dir === 'desc' ? 'asc' : 'desc' } : { key, dir: 'desc' });
  }

  const numCols: { key: AdSortKey; label: string; fmt: (v: number) => string; prevKey: keyof IhhsDashboardData['adRows'][0]; invert?: boolean }[] = [
    { key: 'spend',     label: 'Spend',   fmt: fmt$,    prevKey: 'prevSpend' },
    { key: 'impressions', label: 'Impr.', fmt: fmtN, prevKey: 'prevImpressions' },
    { key: 'linkClicks', label: 'Link Clicks', fmt: fmtN, prevKey: 'prevLinkClicks' },
    { key: 'linkCtr', label: 'Link CTR', fmt: fmtPct, prevKey: 'prevLinkCtr' },
    { key: 'leads', label: 'Quiz Takers', fmt: fmtN, prevKey: 'prevLeads' },
    { key: 'costPerQuizTaker', label: 'Cost / Quiz', fmt: fmt$, prevKey: 'prevCostPerQuizTaker', invert: true },
    { key: 'scheduledAppointments', label: 'Appointments Scheduled', fmt: fmtN, prevKey: 'prevScheduledAppointments' },
    { key: 'costPerScheduledAppointment', label: 'Cost / Appointment', fmt: fmt$, prevKey: 'prevCostPerScheduledAppointment', invert: true },
  ];

  if (rows.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-700">Ad Performance</h3>
        <p className="mt-1 text-xs text-gray-400">Cost cells are green at or below the dashboard average and red above it. Spend with no tracked outcome is flagged red.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left">
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Ad</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Ad Set</th>
              {numCols.map(c => (
                <th
                  key={c.key}
                  onClick={() => toggleSort(c.key)}
                  className={`px-4 py-3 text-xs font-semibold uppercase tracking-wide text-right cursor-pointer whitespace-nowrap hover:text-gray-800 transition-colors ${
                    sort.key === c.key ? 'text-brand-forest' : 'text-gray-500'
                  }`}
                >
                  {c.label}{sort.key === c.key && (sort.dir === 'desc' ? ' ↓' : ' ↑')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {sorted.map((row, i) => (
              <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                <td className="px-4 py-3 text-gray-700 max-w-[220px] truncate">
                  <div className="flex items-center gap-2">
                    {row.previewUrl && (
                      <img
                        src={row.previewUrl}
                        alt=""
                        className="w-8 h-8 rounded object-cover shrink-0 bg-gray-100"
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    )}
                    <span className="truncate text-xs font-medium text-gray-700">{row.adName}</span>
                  </div>
                </td>
                <td className="px-4 py-3 max-w-[180px] truncate text-xs text-gray-500">{row.adsetName}</td>
                {numCols.map(c => (
                  <td key={c.key} className="px-4 py-3 text-right">
                    <EfficiencyValue
                      value={row[c.key]}
                      format={c.fmt}
                      benchmark={c.key === 'costPerQuizTaker' ? quizBenchmark : c.key === 'costPerScheduledAppointment' ? appointmentBenchmark : null}
                      trackedSpend={row.trackingSpend}
                      isCost={c.key === 'costPerQuizTaker' || c.key === 'costPerScheduledAppointment'}
                    />
                    <DeltaBadge curr={row[c.key]} prev={row[c.prevKey] as number | null} invert={c.invert} />
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

// ─── Main Component ───────────────────────────────────────────────────────────

export default function IhhDashboardClient({
  data,
  isAdmin,
  updateBudget,
}: {
  data: IhhsDashboardData;
  isAdmin: boolean;
  updateBudget: (n: number) => Promise<{ error?: string }>;
}) {
  const { summary, prevSummary, timeSeries, campaignRows, adRows, metaCreatives, budgetPacing, weeklyReadout } = data;

  return (
    <div className="min-h-screen bg-gray-50/50">
      <div className="bg-white border-b border-gray-100 px-6 py-5">
        <div className="max-w-7xl mx-auto flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900">InfiniteHeart Health</h1>
              <p className="text-sm text-gray-400 mt-0.5">Performance Dashboard</p>
            </div>
          </div>
          <FilterBar />
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">

        <WeeklyExecutiveSummary readout={weeklyReadout} />

        <BudgetPacing pacing={budgetPacing} isAdmin={isAdmin} updateBudget={updateBudget} />

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <KpiCard label="Appointments Scheduled" badge="North Star" value={summary.scheduledAppointments} prev={prevSummary.scheduledAppointments} format={fmtN} />
          <KpiCard label="Cost / Appointment" value={summary.costPerScheduledAppointment} prev={prevSummary.costPerScheduledAppointment} format={fmt$} invert colorByComparison nullIsBad={summary.trackingSpend !== null && summary.trackingSpend > 0} />
          <KpiCard label="Quiz Takers" value={summary.leads} prev={prevSummary.leads} format={fmtN} />
          <KpiCard label="Cost / Quiz Taker" value={summary.costPerLead} prev={prevSummary.costPerLead} format={fmt$} invert colorByComparison nullIsBad={summary.trackingSpend !== null && summary.trackingSpend > 0} />
          <KpiCard label="Quiz → Appointment" value={summary.conversionRate} prev={prevSummary.conversionRate} format={fmtPct} />
          <KpiCard label="Impressions" value={summary.impressions} prev={prevSummary.impressions} format={fmtN} />
          <KpiCard label="Link Clicks" value={summary.linkClicks} prev={prevSummary.linkClicks} format={fmtN} />
          <KpiCard label="Link CTR" value={summary.linkCtr} prev={prevSummary.linkCtr} format={fmtPct} />
          <KpiCard label="Media Spend" value={summary.spend} prev={prevSummary.spend} format={fmt$} />
        </div>

        <div className="rounded-xl border border-blue-100 bg-blue-50/60 px-5 py-4 text-sm text-blue-900">
          <strong>Meta pixel tracking: {summary.trackingCoverage === 'full' ? 'full coverage' : summary.trackingCoverage === 'partial' ? 'partial coverage' : 'unavailable'}.</strong>{' '}
          Reliable reporting begins {summary.trackingStart}. Quiz Takers and Appointments Scheduled are Meta-attributed actions by account reporting date (America/Chicago), not total CRM contacts.
          {summary.trackingCoverage === 'partial' && ' Outcome totals and cost metrics use only dates on or after the tracking start; media delivery still covers the full selected range.'}
          {summary.trackingCoverage === 'none' && ' Outcome and related cost metrics are unavailable for this selected range; media delivery remains available.'}
        </div>

        <TrendChart timeSeries={timeSeries} />

        <CampaignTable rows={campaignRows} quizBenchmark={summary.costPerLead} appointmentBenchmark={summary.costPerScheduledAppointment} />

        <AdPerformanceTable rows={adRows} quizBenchmark={summary.costPerLead} appointmentBenchmark={summary.costPerScheduledAppointment} />

        <MetaAdPreviews
          creatives={metaCreatives}
          title="Meta Ad Creative Performance"
          description="Top 30 creatives by spend. Results use Meta-attributed Quiz Takers on or after August 19, 2026; they are not total CRM contacts."
          advertiserName="InfiniteHeart Health"
          metricMode="leads"
          conversionLabel={{ conversion: 'Quiz Takers', cpa: 'Cost / Quiz Taker' }}
        />

      </div>
    </div>
  );
}
