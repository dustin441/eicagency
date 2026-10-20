'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, useTransition } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';
import { Pencil, Check, X, TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp, CheckCircle2, AlertTriangle, ClipboardList, Columns3 } from 'lucide-react';
import type { IhhsDashboardData } from '@/services/ihh-analytics';
import { IhhContactCohortPanel } from '@/components/IhhContactCohortPanel';
import type { IhhCohortPublicState } from '@/services/ihh-contact-cohort';
import FilterBar from '@/components/FilterBar';
import { MetaAdPreviews } from '@/components/AdPreviews';
import { IHH_META_CLOSER_ATTRIBUTION_LABEL, IHH_META_CLOSER_ACTION_TYPE } from '@/services/ihh-meta-closer-aggregation';

// ─── helpers ─────────────────────────────────────────────────────────────────

function fmt$(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}
function fmtCpc(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtN(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
function fmtPct(n: number) { return n.toFixed(2) + '%'; }

function normalizeOutcomeLabels(value: string) {
  return value
    .replaceAll('Pixel Leads', 'Quiz Takes')
    .replaceAll('Pixel Lead', 'Quiz Take')
    .replaceAll('Pixel Schedules', 'Appt Scheduled')
    .replaceAll('Pixel Schedule', 'Appt Scheduled')
    .replaceAll('Cost per Lead', 'Cost per Quiz')
    .replaceAll('Cost per Schedule', 'Cost per Appt Scheduled')
    .replaceAll('Lead-to-Schedule', 'Quiz-to-Appt');
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
  label, value, prev, format, invert = false, goal, goalFmt, colorByComparison = false, nullIsBad = false, badge, emptyLabel,
}: {
  label: string; value: number | null; prev: number | null;
  format: (n: number) => string; invert?: boolean;
  goal?: number; goalFmt?: (v: number) => string;
  colorByComparison?: boolean;
  nullIsBad?: boolean;
  badge?: string;
  emptyLabel?: string;
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
      <p className={`text-2xl font-bold ${valueClass}`}>{value === null ? (emptyLabel ?? (nullIsBad ? 'No outcome' : '—')) : format(value)}</p>
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

type TrendMetricKey = 'appointments' | 'costPerAppointment' | 'closerAppointments' | 'costPerCloserAppointment' | 'impressions' | 'linkClicks' | 'linkCtr' | 'spend' | 'cpc' | 'quizTakers' | 'costPerQuiz';

type TrendMetric = {
  key: TrendMetricKey;
  label: string;
  color: string;
  format: (v: number) => string;
  axis: 'volume' | 'rate';
};

const trendMetrics: TrendMetric[] = [
  { key: 'impressions', label: 'Impressions', color: '#7C3AED', format: fmtN, axis: 'volume' },
  { key: 'linkClicks', label: 'Clicks', color: '#2563EB', format: fmtN, axis: 'volume' },
  { key: 'linkCtr', label: 'CTR', color: '#0891B2', format: fmtPct, axis: 'rate' },
  { key: 'spend', label: 'Spend', color: '#D97706', format: fmt$, axis: 'rate' },
  { key: 'cpc', label: 'CPC', color: '#0EA5E9', format: fmtCpc, axis: 'rate' },
  { key: 'quizTakers', label: 'Quiz Takes', color: '#EB541E', format: fmtN, axis: 'volume' },
  { key: 'costPerQuiz', label: 'Cost per Quiz', color: '#9333EA', format: fmt$, axis: 'rate' },
  { key: 'appointments', label: 'Appt Scheduled', color: '#0B4A31', format: fmtN, axis: 'volume' },
  { key: 'costPerAppointment', label: 'Cost per Appt Scheduled', color: '#BE123C', format: fmt$, axis: 'rate' },
  { key: 'closerAppointments', label: 'Meta-Attributed Closer Appointments', color: '#047857', format: fmtN, axis: 'volume' },
  { key: 'costPerCloserAppointment', label: 'Cost per Closer Appointment', color: '#C2410C', format: fmt$, axis: 'rate' },
];

function TrendChart({ timeSeries }: { timeSeries: IhhsDashboardData['timeSeries'] }) {
  const [selectedMetrics, setSelectedMetrics] = useState<TrendMetricKey[]>(['closerAppointments', 'costPerCloserAppointment']);
  const activeMetrics = trendMetrics.filter(option => selectedMetrics.includes(option.key));
  const data = timeSeries.map(d => ({
    date: d.label.slice(5),
    appointments: d.scheduledAppointments,
    costPerAppointment: d.scheduledAppointments && d.scheduledAppointments > 0 ? d.trackingSpend / d.scheduledAppointments : null,
    closerAppointments: d.closerAppointments,
    costPerCloserAppointment: d.costPerCloserAppointment,
    impressions: d.impressions,
    linkClicks: d.linkClicks,
    linkCtr: d.impressions > 0 ? (d.linkClicks / d.impressions) * 100 : null,
    spend: d.spend,
    cpc: d.linkClicks > 0 ? d.spend / d.linkClicks : null,
    quizTakers: d.leads,
    costPerQuiz: d.leads && d.leads > 0 ? d.trackingSpend / d.leads : null,
  }));

  const toggleMetric = (key: TrendMetricKey) => {
    setSelectedMetrics(current => current.includes(key)
      ? current.length === 1 ? current : current.filter(metricKey => metricKey !== key)
      : [...current, key]);
  };

  return (
    <div className="flex h-full flex-col rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
      <div className="mb-4 shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-700">Performance Trend</h3>
            <p className="mt-1 text-xs text-gray-400">Choose one or more metrics. Closer appointment volume and cost are selected by default.</p>
          </div>
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">North Star: Cost per Closer Appointment</span>
        </div>
        <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Time series metrics">
          {trendMetrics.map(option => (
            <button
              key={option.key}
              type="button"
              onClick={() => toggleMetric(option.key)}
              aria-pressed={selectedMetrics.includes(option.key)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${selectedMetrics.includes(option.key)
                ? 'border-brand-forest bg-brand-forest text-white'
                : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:text-gray-900'}`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
      <div className="min-h-[260px] flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
          <defs>
            {activeMetrics.map(metric => (
              <linearGradient key={metric.key} id={`ihh-${metric.key}-gradient`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={metric.color} stopOpacity={0.14} />
                <stop offset="95%" stopColor={metric.color} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9ca3af' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
          {activeMetrics.map((metric, index) => (
            <YAxis
              key={metric.key}
              yAxisId={metric.key}
              orientation={index % 2 === 0 ? 'left' : 'right'}
              hide={index > 1}
              tick={{ fontSize: 11, fill: '#9ca3af' }}
              tickLine={false}
              axisLine={false}
              allowDecimals={metric.axis === 'rate'}
            />
          ))}
          <Tooltip
            contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)' }}
            formatter={(value, name) => {
              const metric = trendMetrics.find(option => option.label === name);
              return [value == null ? '—' : metric?.format(Number(value)) ?? String(value), String(name)];
            }}
          />
          {activeMetrics.map(metric => (
            <Area key={metric.key} yAxisId={metric.key} type="monotone" dataKey={metric.key} name={metric.label} stroke={metric.color} strokeWidth={2.5} fill={`url(#ihh-${metric.key}-gradient)`} dot={false} connectNulls={false} />
          ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─── Performance Tables ───────────────────────────────────────────────────────

type OutcomeSortKey = 'leads' | 'costPerQuizTaker' | 'scheduledAppointments' | 'costPerScheduledAppointment' | 'closerAppointments' | 'costPerCloserAppointment';
type MetricKey = 'spend' | 'impressions' | 'linkClicks' | 'linkCtr' | OutcomeSortKey;

type OutcomeBenchmarks = {
  quizBenchmark: number | null;
  appointmentBenchmark: number | null;
  closerBenchmark: number | null;
};

type MetricColumn = { key: MetricKey; label: string; fmt: (v: number) => string; prevKey: string; invert?: boolean };

// Same metric order in every table: media first, then funnel outcomes.
const METRIC_COLS: MetricColumn[] = [
  { key: 'spend', label: 'Spend', fmt: fmt$, prevKey: 'prevSpend' },
  { key: 'impressions', label: 'Impr.', fmt: fmtN, prevKey: 'prevImpressions' },
  { key: 'linkClicks', label: 'Clicks', fmt: fmtN, prevKey: 'prevLinkClicks' },
  { key: 'linkCtr', label: 'CTR', fmt: fmtPct, prevKey: 'prevLinkCtr' },
  { key: 'leads', label: 'Quiz Takes', fmt: fmtN, prevKey: 'prevLeads' },
  { key: 'costPerQuizTaker', label: 'Cost per Quiz', fmt: fmt$, prevKey: 'prevCostPerQuizTaker', invert: true },
  { key: 'scheduledAppointments', label: 'Appt Scheduled', fmt: fmtN, prevKey: 'prevScheduledAppointments' },
  { key: 'costPerScheduledAppointment', label: 'Cost per Appt Scheduled', fmt: fmt$, prevKey: 'prevCostPerScheduledAppointment', invert: true },
  { key: 'closerAppointments', label: 'Closer Appts', fmt: fmtN, prevKey: 'prevCloserAppointments' },
  { key: 'costPerCloserAppointment', label: 'Cost per Closer Appt', fmt: fmt$, prevKey: 'prevCostPerCloserAppointment', invert: true },
];

const DEFAULT_TEXT_WIDTH = 240;
const DEFAULT_METRIC_WIDTH = 130;
const MIN_COLUMN_WIDTH = 70;

// Cost columns are colored against the dashboard-wide average. Quiz/appointment
// costs use pixel-tracked spend; closer cost uses full spend (KPI definition).
function outcomeCellProps(
  key: string,
  row: { spend: number; trackingSpend: number },
  { quizBenchmark, appointmentBenchmark, closerBenchmark }: OutcomeBenchmarks,
) {
  if (key === 'costPerQuizTaker') return { isCost: true, benchmark: quizBenchmark, trackedSpend: row.trackingSpend };
  if (key === 'costPerScheduledAppointment') return { isCost: true, benchmark: appointmentBenchmark, trackedSpend: row.trackingSpend };
  if (key === 'costPerCloserAppointment') return { isCost: true, benchmark: closerBenchmark, trackedSpend: row.spend };
  return { isCost: false, benchmark: null, trackedSpend: row.trackingSpend };
}

type MetricRow = Record<MetricKey, number | null> & { spend: number; trackingSpend: number };

type TextColumn<R> = {
  id: string;
  label: string;
  width?: number;
  text: (row: R) => string;
  render?: (row: R) => React.ReactNode;
};

type TableLayout = { hidden: string[]; widths: Record<string, number> };

// Column choices and widths are a per-viewer convenience, so they live in
// localStorage. An in-memory copy keeps the table working when storage is
// blocked; the server snapshot is always the default layout (no hydration drift).
const EMPTY_LAYOUT = '{"hidden":[],"widths":{}}';
const memoryLayouts = new Map<string, string>();
const layoutListeners = new Set<() => void>();

function readLayout(storageKey: string): string {
  try {
    const saved = window.localStorage.getItem(storageKey);
    if (saved) return saved;
  } catch {
    // Storage unavailable: fall back to this visit's in-memory layout.
  }
  return memoryLayouts.get(storageKey) ?? EMPTY_LAYOUT;
}

function subscribeLayout(listener: () => void) {
  layoutListeners.add(listener);
  return () => { layoutListeners.delete(listener); };
}

function useTableLayout(storageKey: string) {
  const raw = useSyncExternalStore(subscribeLayout, () => readLayout(storageKey), () => EMPTY_LAYOUT);
  const layout = useMemo<TableLayout>(() => {
    try {
      return JSON.parse(raw) as TableLayout;
    } catch {
      return JSON.parse(EMPTY_LAYOUT) as TableLayout;
    }
  }, [raw]);

  const update = useCallback((next: (prev: TableLayout) => TableLayout) => {
    const value = JSON.stringify(next(JSON.parse(readLayout(storageKey)) as TableLayout));
    memoryLayouts.set(storageKey, value);
    try {
      window.localStorage.setItem(storageKey, value);
    } catch {
      // Storage unavailable: the in-memory copy still applies for this visit.
    }
    layoutListeners.forEach(listener => listener());
  }, [storageKey]);

  return [layout, update] as const;
}

function ColumnPicker({
  columns,
  hidden,
  onToggle,
  onReset,
}: {
  columns: { id: string; label: string }[];
  hidden: string[];
  onToggle: (id: string) => void;
  onReset: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const visibleCount = columns.length - hidden.length;

  useEffect(() => {
    if (!open) return;
    function close(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
      >
        <Columns3 size={14} />
        Columns
        {hidden.length > 0 && <span className="rounded-full bg-gray-100 px-1.5 text-[10px] text-gray-500">{visibleCount}/{columns.length}</span>}
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-1 w-60 rounded-lg border border-gray-100 bg-white p-2 shadow-lg">
          <div className="max-h-72 overflow-y-auto">
            {columns.map(col => {
              const checked = !hidden.includes(col.id);
              return (
                <label key={col.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-xs text-gray-700 hover:bg-gray-50">
                  <input
                    type="checkbox"
                    checked={checked}
                    // Keep at least one column so the table never renders empty.
                    disabled={checked && visibleCount === 1}
                    onChange={() => onToggle(col.id)}
                    className="accent-brand-forest"
                  />
                  {col.label}
                </label>
              );
            })}
          </div>
          <button
            type="button"
            onClick={onReset}
            className="mt-1 w-full rounded border-t border-gray-100 px-2 pt-2 text-left text-xs text-gray-500 hover:text-gray-800"
          >
            Reset columns and widths
          </button>
        </div>
      )}
    </div>
  );
}

function PerformanceTable<R extends MetricRow>({
  title,
  storageKey,
  rows,
  rowKey,
  textColumns,
  benchmarks,
}: {
  title: string;
  storageKey: string;
  rows: R[];
  rowKey: (row: R, index: number) => string;
  textColumns: TextColumn<R>[];
  benchmarks: OutcomeBenchmarks;
}) {
  const [sort, setSort] = useState<{ key: MetricKey; dir: 'asc' | 'desc' }>({ key: 'spend', dir: 'desc' });
  const [layout, updateLayout] = useTableLayout(storageKey);

  const sorted = [...rows].sort((a, b) => {
    const aValue = a[sort.key];
    const bValue = b[sort.key];
    if (aValue === null) return bValue === null ? 0 : 1;
    if (bValue === null) return -1;
    const diff = aValue - bValue;
    return sort.dir === 'desc' ? -diff : diff;
  });

  function toggleSort(key: MetricKey) {
    setSort(prev => prev.key === key ? { key, dir: prev.dir === 'desc' ? 'asc' : 'desc' } : { key, dir: 'desc' });
  }

  const allColumns = [
    ...textColumns.map(c => ({ id: c.id, label: c.label, defaultWidth: c.width ?? DEFAULT_TEXT_WIDTH })),
    ...METRIC_COLS.map(c => ({ id: c.key, label: c.label, defaultWidth: DEFAULT_METRIC_WIDTH })),
  ];
  const widthOf = (id: string) => layout.widths[id] ?? allColumns.find(c => c.id === id)?.defaultWidth ?? DEFAULT_METRIC_WIDTH;
  const visibleText = textColumns.filter(c => !layout.hidden.includes(c.id));
  const visibleMetrics = METRIC_COLS.filter(c => !layout.hidden.includes(c.key));
  const tableWidth = [...visibleText.map(c => c.id), ...visibleMetrics.map(c => c.key)].reduce((sum, id) => sum + widthOf(id), 0);

  function toggleColumn(id: string) {
    updateLayout(prev => ({
      ...prev,
      hidden: prev.hidden.includes(id) ? prev.hidden.filter(h => h !== id) : [...prev.hidden, id],
    }));
  }

  function startResize(id: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startWidth = widthOf(id);
    function onMove(ev: MouseEvent) {
      const width = Math.max(MIN_COLUMN_WIDTH, startWidth + ev.clientX - startX);
      updateLayout(prev => ({ ...prev, widths: { ...prev.widths, [id]: width } }));
    }
    function onUp() {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  const resizeHandle = (id: string) => (
    <span
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize column"
      onMouseDown={e => startResize(id, e)}
      onClick={e => e.stopPropagation()}
      className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize select-none hover:bg-brand-forest/30"
    />
  );

  if (rows.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-gray-100">
        <div>
          <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
          <p className="mt-1 text-xs text-gray-400">Cost cells are green at or below the dashboard average and red above it. Spend with no tracked outcome is flagged red. Drag a column edge to resize it.</p>
        </div>
        <ColumnPicker
          columns={allColumns}
          hidden={layout.hidden}
          onToggle={toggleColumn}
          onReset={() => updateLayout(() => ({ hidden: [], widths: {} }))}
        />
      </div>
      <div className="overflow-x-auto">
        <table className="text-sm" style={{ tableLayout: 'fixed', width: tableWidth, minWidth: '100%' }}>
          <colgroup>
            {visibleText.map(c => <col key={c.id} style={{ width: widthOf(c.id) }} />)}
            {visibleMetrics.map(c => <col key={c.key} style={{ width: widthOf(c.key) }} />)}
          </colgroup>
          <thead>
            <tr className="bg-gray-50 text-left">
              {visibleText.map(c => (
                <th key={c.id} className="relative px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500 truncate">
                  {c.label}
                  {resizeHandle(c.id)}
                </th>
              ))}
              {visibleMetrics.map(c => (
                <th
                  key={c.key}
                  onClick={() => toggleSort(c.key)}
                  className={`relative px-4 py-3 text-xs font-semibold uppercase tracking-wide text-right cursor-pointer truncate hover:text-gray-800 transition-colors ${
                    sort.key === c.key ? 'text-brand-forest' : 'text-gray-500'
                  }`}
                  title={c.label}
                >
                  {c.label}{sort.key === c.key && (sort.dir === 'desc' ? ' ↓' : ' ↑')}
                  {resizeHandle(c.key)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {sorted.map((row, i) => (
              <tr key={rowKey(row, i)} className="hover:bg-gray-50/50 transition-colors">
                {visibleText.map(c => (
                  <td key={c.id} className="px-4 py-3 text-xs text-gray-700 truncate" title={c.text(row)}>
                    {c.render ? c.render(row) : c.text(row)}
                  </td>
                ))}
                {visibleMetrics.map(c => (
                  <td key={c.key} className="px-4 py-3 text-right">
                    <EfficiencyValue
                      value={row[c.key]}
                      format={c.fmt}
                      {...outcomeCellProps(c.key, row, benchmarks)}
                    />
                    <DeltaBadge curr={row[c.key]} prev={(row as Record<string, unknown>)[c.prevKey] as number | null} invert={c.invert} />
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

type CampaignRow = IhhsDashboardData['campaignRows'][number];
type AdsetRow = IhhsDashboardData['adsetRows'][number];
type AdRow = IhhsDashboardData['adRows'][number];

const CAMPAIGN_TEXT_COLUMNS: TextColumn<CampaignRow>[] = [
  { id: 'campaign', label: 'Campaign', width: 280, text: r => r.campaign },
];

const ADSET_TEXT_COLUMNS: TextColumn<AdsetRow>[] = [
  { id: 'adset', label: 'Ad Set', width: 260, text: r => r.adsetName, render: r => <span className="font-medium">{r.adsetName}</span> },
  { id: 'campaign', label: 'Campaign', width: 200, text: r => r.campaignName, render: r => <span className="text-gray-500">{r.campaignName}</span> },
];

const AD_TEXT_COLUMNS: TextColumn<AdRow>[] = [
  {
    id: 'ad',
    label: 'Ad',
    width: 240,
    text: r => r.adName,
    render: r => (
      <div className="flex min-w-0 items-center gap-2">
        {r.previewUrl && (
          <img
            src={r.previewUrl}
            alt=""
            className="w-8 h-8 rounded object-cover shrink-0 bg-gray-100"
            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        )}
        <span className="truncate font-medium">{r.adName}</span>
      </div>
    ),
  },
  { id: 'adset', label: 'Ad Set', width: 200, text: r => r.adsetName, render: r => <span className="text-gray-500">{r.adsetName}</span> },
];

// ─── Main Component ───────────────────────────────────────────────────────────

export default function IhhDashboardClient({
  data,
  cohort,
  isAdmin,
  updateBudget,
}: {
  data: IhhsDashboardData;
  cohort: IhhCohortPublicState;
  isAdmin: boolean;
  updateBudget: (n: number) => Promise<{ error?: string }>;
}) {
  const { summary, prevSummary, timeSeries, campaignRows, adsetRows, adRows, metaCreatives, budgetPacing, weeklyReadout } = data;
  const benchmarks: OutcomeBenchmarks = {
    quizBenchmark: summary.costPerLead,
    appointmentBenchmark: summary.costPerScheduledAppointment,
    closerBenchmark: summary.costPerCloserAppointment,
  };

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

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          <KpiCard label="Impressions" value={summary.impressions} prev={prevSummary.impressions} format={fmtN} />
          <KpiCard label="Clicks" value={summary.linkClicks} prev={prevSummary.linkClicks} format={fmtN} />
          <KpiCard label="CTR" value={summary.linkCtr} prev={prevSummary.linkCtr} format={fmtPct} />
          <KpiCard label="Spend" value={summary.spend} prev={prevSummary.spend} format={fmt$} />
          <KpiCard label="CPC" value={summary.cpc} prev={prevSummary.cpc} format={fmtCpc} />
          <KpiCard label="Quiz Takes" value={summary.leads} prev={prevSummary.leads} format={fmtN} />
          <KpiCard label="Cost per Quiz" value={summary.costPerLead} prev={prevSummary.costPerLead} format={fmt$} invert colorByComparison nullIsBad={summary.trackingSpend !== null && summary.trackingSpend > 0} />
          <KpiCard label="Appt Scheduled" value={summary.scheduledAppointments} prev={prevSummary.scheduledAppointments} format={fmtN} />
          <KpiCard label="Cost per Appt Scheduled" value={summary.costPerScheduledAppointment} prev={prevSummary.costPerScheduledAppointment} format={fmt$} invert colorByComparison nullIsBad={summary.trackingSpend !== null && summary.trackingSpend > 0} />
          <KpiCard
            label="Meta-Attributed Closer Appointments"
            value={summary.closerAppointments}
            prev={prevSummary.closerAppointments}
            format={fmtN}
            emptyLabel={summary.closerDataAvailable ? undefined : 'Unavailable'}
          />
          <KpiCard
            label="Cost per Closer Appointment"
            badge="Current North Star"
            value={summary.costPerCloserAppointment}
            prev={prevSummary.costPerCloserAppointment}
            format={fmt$}
            invert
            colorByComparison
            nullIsBad={summary.closerDataAvailable && summary.spend > 0}
            emptyLabel={summary.closerDataAvailable ? 'No outcome' : 'Unavailable'}
          />
        </div>

        <div className="rounded-xl border border-blue-100 bg-blue-50/60 px-5 py-4 text-sm text-blue-900">
          <strong>Meta-attributed reporting.</strong>{' '}
          Quiz Takes and Appt Scheduled use the existing Meta pixel definitions beginning {summary.trackingStart}. Closer Appointments use the IHH custom conversion <strong>IHH | Closer Appointment Booked</strong> (ID 1794339368427062, action <code>{IHH_META_CLOSER_ACTION_TYPE}</code>) beginning {summary.closerTrackingStart}. All metrics use ad account 1213116450382492, America/Chicago reporting dates, and {IHH_META_CLOSER_ATTRIBUTION_LABEL} attribution. Cost per Closer Appointment divides full selected-period Meta spend by Meta-attributed Closer Appointments for that same period. CRM-total closer bookings, Closed Won, Purchase, Google, organic, direct, referral, and unknown outcomes are excluded.
          {summary.trackingCoverage === 'partial' && ' Existing quiz and appointment outcome totals use only dates on or after their tracking start.'}
          {summary.trackingCoverage === 'none' && ' Existing quiz and appointment outcome metrics are unavailable for this selected range.'}
          {summary.closerTrackingCoverage === 'partial' && ' The selected range begins before the Closer Appointment conversion became available; the native Meta count and full selected-period spend remain aligned to the exact dashboard range.'}
          {summary.closerTrackingCoverage === 'none' && ' Closer Appointment metrics are unavailable because the selected range predates the verified conversion.'}
        </div>

        <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-3">
          <div className="min-w-0 lg:col-span-2">
            <TrendChart timeSeries={timeSeries} />
          </div>
          <IhhContactCohortPanel state={cohort} />
        </div>

        <PerformanceTable title="Campaign Performance" storageKey="ihh-table-campaigns" rows={campaignRows} rowKey={r => `${r.campaign}__${r.channel}`} textColumns={CAMPAIGN_TEXT_COLUMNS} benchmarks={benchmarks} />

        <PerformanceTable title="Ad Set Performance" storageKey="ihh-table-adsets" rows={adsetRows} rowKey={r => r.adsetId} textColumns={ADSET_TEXT_COLUMNS} benchmarks={benchmarks} />

        <PerformanceTable title="Ad Performance" storageKey="ihh-table-ads" rows={adRows} rowKey={r => `${r.adName}__${r.adsetName}`} textColumns={AD_TEXT_COLUMNS} benchmarks={benchmarks} />

        <MetaAdPreviews
          creatives={metaCreatives}
          title="Meta Ad Creative Performance"
          description="Top 30 creatives by spend. Results and cost are based on Meta-attributed appointments on or after August 19, 2026."
          advertiserName="InfiniteHeart Health"
          metricMode="leads"
          conversionLabel={{ conversion: 'Appt Scheduled', cpa: 'Cost per Appt Scheduled' }}
          defaultSort="cpl"
        />

      </div>
    </div>
  );
}
