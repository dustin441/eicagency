'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { Calendar, ChevronDown, TrendingUp, DollarSign, Eye, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  fmtDate,
  fmtDateShort,
  detectPreset,
  getPresetDates,
  PRESETS,
  computeCompDates,
  type PresetKey,
} from '@/lib/date-utils';
import type { NsiRevenueData, NsiRevenuePoint, ProductFamily, RevenueFilterParams } from '@/services/nsi-revenue-analytics';

type CompMode = RevenueFilterParams['compMode'];

// ── Formatters ────────────────────────────────────────────────────────────────

const fmtRevenue = (v: number) => {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${Math.round(v).toLocaleString()}`;
};
const fmtImpressions = (v: number) => {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return Math.round(v).toLocaleString();
};
const fmtSpend = (v: number) => {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
  return `$${Math.round(v).toLocaleString()}`;
};
const fmtRoas = (v: number) => (v > 0 ? `${v.toFixed(0)}x` : '—');

// ── Quarter aggregation ───────────────────────────────────────────────────────

function toQ1Only(points: NsiRevenuePoint[]): NsiRevenuePoint[] {
  const map = new Map<string, NsiRevenuePoint>();
  for (const p of points) {
    const d = new Date(p.monthStart + 'T12:00:00');
    if (d.getMonth() + 1 > 3) continue; // only Jan/Feb/Mar
    const year = d.getFullYear();
    const key = `${year}-Q1`;
    const prev = map.get(key);
    if (!prev) {
      map.set(key, { ...p, label: `Q1 ${year}`, monthStart: key });
    } else {
      const revenue = prev.revenue + p.revenue;
      const spend = prev.spend + p.spend;
      const impressions = prev.impressions + p.impressions;
      map.set(key, { ...prev, revenue, spend, impressions, roas: spend > 0 ? (revenue * 0.01) / spend : 0 });
    }
  }
  return Array.from(map.values()).sort((a, b) => a.monthStart.localeCompare(b.monthStart));
}

function toQuarters(points: NsiRevenuePoint[]): NsiRevenuePoint[] {
  const map = new Map<string, NsiRevenuePoint>();
  for (const p of points) {
    const d = new Date(p.monthStart + 'T12:00:00');
    const q = Math.ceil((d.getMonth() + 1) / 3);
    const key = `${d.getFullYear()}-Q${q}`;
    const prev = map.get(key);
    if (!prev) {
      map.set(key, { ...p, label: `Q${q} ${d.getFullYear()}`, monthStart: key });
    } else {
      const revenue = prev.revenue + p.revenue;
      const spend = prev.spend + p.spend;
      const impressions = prev.impressions + p.impressions;
      map.set(key, {
        ...prev,
        revenue,
        spend,
        impressions,
        roas: spend > 0 ? (revenue * 0.01) / spend : 0,
      });
    }
  }
  return Array.from(map.values());
}

// ── Date picker helpers ───────────────────────────────────────────────────────

function resolveComp(
  s: string, e: string, mode: CompMode, customCs: string, customCe: string
): { compStart: string; compEnd: string } {
  if (mode === 'custom') return { compStart: customCs, compEnd: customCe };
  return computeCompDates(s, e, mode === 'prev_year' ? 'prev_year' : 'prev_period');
}

const COMP_MODES: { value: CompMode; label: string }[] = [
  { value: 'prev_period', label: 'Prev Period' },
  { value: 'prev_year',   label: 'Prev Year' },
  { value: 'custom',      label: 'Custom' },
];

function DateRangePicker({
  start, end, compMode, compStart, compEnd, onApply,
}: {
  start: string; end: string; compMode: CompMode;
  compStart: string; compEnd: string;
  onApply: (start: string, end: string, compMode: CompMode, compStart: string, compEnd: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [activePreset, setActivePreset] = useState<PresetKey>(() => detectPreset(start, end));
  const [customStart, setCustomStart] = useState(start);
  const [customEnd, setCustomEnd] = useState(end);
  const [localCompMode, setLocalCompMode] = useState<CompMode>(compMode);
  const [customCompStart, setCustomCompStart] = useState(compStart);
  const [customCompEnd, setCustomCompEnd] = useState(compEnd);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setActivePreset(detectPreset(start, end));
    setCustomStart(start);
    setCustomEnd(end);
  }, [start, end]);

  useEffect(() => {
    setLocalCompMode(compMode);
    setCustomCompStart(compStart);
    setCustomCompEnd(compEnd);
  }, [compMode, compStart, compEnd]);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  function commit(s: string, e: string, mode: CompMode, cs: string, ce: string) {
    onApply(s, e, mode, cs, ce);
    setOpen(false);
  }

  function handlePreset(key: PresetKey) {
    setActivePreset(key);
    if (key === 'custom') return;
    const dates = getPresetDates(key)!;
    setCustomStart(dates.start);
    setCustomEnd(dates.end);
    const comp = resolveComp(dates.start, dates.end, localCompMode, customCompStart, customCompEnd);
    commit(dates.start, dates.end, localCompMode, comp.compStart, comp.compEnd);
  }

  function handleCompModeChange(mode: CompMode) {
    setLocalCompMode(mode);
    if (mode !== 'custom') {
      const s = customStart || start;
      const e = customEnd || end;
      const comp = computeCompDates(s, e, mode === 'prev_year' ? 'prev_year' : 'prev_period');
      setCustomCompStart(comp.compStart);
      setCustomCompEnd(comp.compEnd);
    }
  }

  const buttonLabel =
    activePreset !== 'custom'
      ? (PRESETS.find((p) => p.key === activePreset)?.label ?? `${fmtDateShort(start)} – ${fmtDateShort(end)}`)
      : `${fmtDateShort(start)} – ${fmtDateShort(end)}`;

  return (
    <div ref={ref} className="relative">
      <div className="flex flex-col gap-1">
        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Date Range</label>
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm font-semibold text-gray-700 hover:border-gray-300 transition-colors"
        >
          <Calendar className="w-3.5 h-3.5 text-gray-400" />
          {buttonLabel}
          <ChevronDown className={cn('w-3.5 h-3.5 text-gray-400 transition-transform ml-1', open && 'rotate-180')} />
        </button>
        <p className="text-[11px] text-gray-400 font-medium px-1">
          {fmtDate(start)} – {fmtDate(end)}
        </p>
      </div>

      {open && (
        <div className="absolute top-full left-0 mt-2 z-50 bg-white rounded-2xl shadow-xl border border-gray-100 p-4 w-[300px]">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Date Range</p>
          <div className="grid grid-cols-2 gap-1">
            {PRESETS.filter((p) => p.key !== 'custom').map((p) => (
              <button
                key={p.key}
                onClick={() => handlePreset(p.key)}
                className={cn(
                  'text-left px-3 py-1.5 rounded-lg text-sm transition-colors',
                  activePreset === p.key
                    ? 'bg-brand-forest text-white font-semibold'
                    : 'hover:bg-gray-50 text-gray-700'
                )}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="border-t border-gray-100 mt-3 pt-3">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Custom Range</p>
            <div className="flex gap-2 items-center">
              <input type="date" value={customStart}
                onChange={(e) => { setCustomStart(e.target.value); setActivePreset('custom'); }}
                className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-forest/20"
              />
              <span className="text-gray-400 text-xs">–</span>
              <input type="date" value={customEnd}
                onChange={(e) => { setCustomEnd(e.target.value); setActivePreset('custom'); }}
                className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-forest/20"
              />
            </div>
            <button
              onClick={() => {
                if (customStart && customEnd) {
                  const comp = resolveComp(customStart, customEnd, localCompMode, customCompStart, customCompEnd);
                  commit(customStart, customEnd, localCompMode, comp.compStart, comp.compEnd);
                }
              }}
              className="mt-2 w-full bg-brand-forest text-white text-sm font-semibold py-1.5 rounded-lg hover:bg-brand-forest/90 transition-colors"
            >
              Apply Range
            </button>
          </div>

          <div className="border-t border-gray-100 mt-3 pt-3">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Compare To</p>
            <div className="flex gap-1">
              {COMP_MODES.map((m) => (
                <button
                  key={m.value}
                  onClick={() => handleCompModeChange(m.value)}
                  className={cn(
                    'flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold transition-all',
                    localCompMode === m.value
                      ? 'bg-brand-forest text-white'
                      : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                  )}
                >
                  {m.label}
                </button>
              ))}
            </div>
            {localCompMode === 'custom' ? (
              <>
                <div className="flex gap-2 items-center mt-2">
                  <input type="date" value={customCompStart}
                    onChange={(e) => setCustomCompStart(e.target.value)}
                    className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-forest/20"
                  />
                  <span className="text-gray-400 text-xs">–</span>
                  <input type="date" value={customCompEnd}
                    onChange={(e) => setCustomCompEnd(e.target.value)}
                    className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-forest/20"
                  />
                </div>
                <button
                  onClick={() => {
                    if (customCompStart && customCompEnd) {
                      commit(start, end, 'custom', customCompStart, customCompEnd);
                    }
                  }}
                  className="mt-2 w-full bg-brand-forest text-white text-sm font-semibold py-1.5 rounded-lg hover:bg-brand-forest/90 transition-colors"
                >
                  Apply Comparison
                </button>
              </>
            ) : (
              <p className="text-xs text-gray-400 mt-1.5">
                {customCompStart && customCompEnd
                  ? `${fmtDateShort(customCompStart)} – ${fmtDateShort(customCompEnd)}`
                  : '—'}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── KPI card ──────────────────────────────────────────────────────────────────

function KpiCard({
  title,
  value,
  sub,
  icon: Icon,
  color,
  delta,
  invertDelta = false,
}: {
  title: string;
  value: string;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  delta?: number | null;
  invertDelta?: boolean;
}) {
  const positive = delta == null ? null : invertDelta ? delta < 0 : delta > 0;
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5 flex-1 min-w-[160px] shadow-sm">
      <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center mb-3', color)}>
        <Icon className="w-4 h-4 text-white" />
      </div>
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">{title}</p>
      <p className="text-xl font-black text-brand-dark tracking-tight">{value}</p>
      {delta != null && (
        <p className={cn('text-[11px] font-bold mt-1', positive ? 'text-emerald-600' : 'text-rose-600')}>
          {delta > 0 ? '↑' : '↓'}{Math.abs(delta).toFixed(0)}% vs prior
        </p>
      )}
      {sub && <p className="text-[11px] text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

// ── Custom tooltip ────────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const revenue    = payload.find((p) => p.name === 'Revenue');
  const spend      = payload.find((p) => p.name === 'Spend');
  const impr       = payload.find((p) => p.name === 'Impressions');

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-3 text-sm min-w-[180px]">
      <p className="font-bold text-gray-700 mb-2">{label}</p>
      {revenue && (
        <div className="flex justify-between gap-4 mb-1">
          <span className="text-gray-500">Revenue</span>
          <span className="font-semibold text-brand-dark">{fmtRevenue(revenue.value)}</span>
        </div>
      )}
      {impr && (
        <div className="flex justify-between gap-4 mb-1">
          <span className="text-gray-500">Impressions</span>
          <span className="font-semibold" style={{ color: impr.color }}>{fmtImpressions(impr.value)}</span>
        </div>
      )}
      {spend && (
        <div className="flex justify-between gap-4">
          <span className="text-gray-500">Spend</span>
          <span className="font-semibold" style={{ color: spend.color }}>{fmtSpend(spend.value)}</span>
        </div>
      )}
      {revenue && spend && spend.value > 0 && (
        <div className="flex justify-between gap-4 mt-2 pt-2 border-t border-gray-100">
          <span className="text-gray-500">ROAS</span>
          <span className="font-bold text-emerald-600">{fmtRoas((revenue.value * 0.01) / spend.value)}</span>
        </div>
      )}
    </div>
  );
}

// ── Summary table ─────────────────────────────────────────────────────────────

function SummaryTable({ points }: { points: NsiRevenuePoint[] }) {
  const quarters = toQuarters(points);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100">
            {['Period', 'Revenue', 'Spend', 'Impressions', 'ROAS'].map((h) => (
              <th
                key={h}
                className={cn(
                  'py-3 px-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest',
                  h === 'Period' ? 'text-left' : 'text-right'
                )}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {quarters.map((q) => (
            <tr key={q.monthStart} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
              <td className="py-3 px-4 font-semibold text-brand-dark">{q.label}</td>
              <td className="py-3 px-4 text-right font-semibold text-gray-800">{fmtRevenue(q.revenue)}</td>
              <td className="py-3 px-4 text-right text-gray-600">
                {q.spend > 0 ? fmtSpend(q.spend) : <span className="text-gray-300">—</span>}
              </td>
              <td className="py-3 px-4 text-right text-gray-600">
                {q.impressions > 0 ? fmtImpressions(q.impressions) : <span className="text-gray-300">—</span>}
              </td>
              <td className="py-3 px-4 text-right font-semibold">
                {q.roas > 0 ? (
                  <span className="text-emerald-600">{fmtRoas(q.roas)}</span>
                ) : (
                  <span className="text-gray-300">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Q1 YoY comparison chart + table ──────────────────────────────────────────

function pctChange(curr: number, prev: number): number | null {
  if (prev === 0) return null;
  return ((curr - prev) / Math.abs(prev)) * 100;
}

function YoyBadge({ curr, prev, inverted = false }: { curr: number; prev: number; inverted?: boolean }) {
  const pct = pctChange(curr, prev);
  if (pct === null || prev === 0) return <span className="text-gray-300 text-[10px]">—</span>;
  const positive = inverted ? pct < 0 : pct > 0;
  return (
    <span className={cn('text-[10px] font-bold', positive ? 'text-emerald-600' : 'text-rose-600')}>
      {pct > 0 ? '↑' : '↓'}{Math.abs(pct).toFixed(0)}%
    </span>
  );
}

function Q1Chart({ points, family }: { points: NsiRevenuePoint[]; family: ProductFamily }) {
  const q1Points = useMemo(() => toQ1Only(points), [points]);

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h3 className="text-sm font-extrabold text-gray-700">Q1 Year-over-Year — {family}</h3>
          <p className="text-xs text-gray-400 mt-1">
            Q1 (Jan – Mar) each year — same three metrics, independent scales
          </p>
        </div>
        <div className="flex flex-wrap gap-4 text-xs font-semibold shrink-0 ml-4">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-brand-forest/25 border border-brand-forest/40" />
            Revenue
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-6 h-0.5 bg-indigo-500 rounded" />
            Impressions
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-6 h-0.5 bg-brand-orange rounded" />
            Spend
          </span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={q1Points} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 13, fill: '#374151', fontWeight: 700 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis yAxisId="revenue"     hide />
          <YAxis yAxisId="impressions" hide />
          <YAxis yAxisId="spend"       hide />
          <Tooltip content={<ChartTooltip />} />
          <Bar
            yAxisId="revenue"
            dataKey="revenue"
            name="Revenue"
            fill="#0B4A31"
            opacity={0.18}
            radius={[4, 4, 0, 0]}
            maxBarSize={72}
          />
          <Line
            yAxisId="impressions"
            type="monotone"
            dataKey="impressions"
            name="Impressions"
            stroke="#6366F1"
            strokeWidth={3}
            dot={{ r: 5, fill: '#6366F1', strokeWidth: 0 }}
            activeDot={{ r: 7 }}
          />
          <Line
            yAxisId="spend"
            type="monotone"
            dataKey="spend"
            name="Spend"
            stroke="#EB541E"
            strokeWidth={3}
            dot={{ r: 5, fill: '#EB541E', strokeWidth: 0 }}
            activeDot={{ r: 7 }}
          />
        </ComposedChart>
      </ResponsiveContainer>

      {/* Q1 comparison table with YoY deltas */}
      <div className="mt-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              {['Period', 'Revenue', 'YoY', 'Spend', 'YoY', 'Impressions', 'YoY', 'ROAS'].map((h, i) => (
                <th
                  key={i}
                  className={cn(
                    'py-2.5 px-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest',
                    i === 0 ? 'text-left' : 'text-right'
                  )}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {q1Points.map((q, i) => {
              const prev = q1Points[i - 1];
              return (
                <tr key={q.monthStart} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                  <td className="py-3 px-4 font-bold text-brand-dark">{q.label}</td>
                  <td className="py-3 px-4 text-right font-semibold text-gray-800">{fmtRevenue(q.revenue)}</td>
                  <td className="py-3 px-4 text-right">
                    {prev ? <YoyBadge curr={q.revenue} prev={prev.revenue} /> : <span className="text-gray-300 text-[10px]">—</span>}
                  </td>
                  <td className="py-3 px-4 text-right text-gray-600">
                    {q.spend > 0 ? fmtSpend(q.spend) : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="py-3 px-4 text-right">
                    {prev && prev.spend > 0 ? <YoyBadge curr={q.spend} prev={prev.spend} /> : <span className="text-gray-300 text-[10px]">—</span>}
                  </td>
                  <td className="py-3 px-4 text-right text-gray-600">
                    {q.impressions > 0 ? fmtImpressions(q.impressions) : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="py-3 px-4 text-right">
                    {prev && prev.impressions > 0 ? <YoyBadge curr={q.impressions} prev={prev.impressions} /> : <span className="text-gray-300 text-[10px]">—</span>}
                  </td>
                  <td className="py-3 px-4 text-right font-semibold">
                    {q.roas > 0 ? <span className="text-emerald-600">{fmtRoas(q.roas)}</span> : <span className="text-gray-300">—</span>}
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

// ── Main component ────────────────────────────────────────────────────────────

const FAMILIES: ProductFamily[] = ['Combined', 'BPT', 'POL', 'CMP'];

function pctDelta(curr: number, prev: number): number | null {
  if (prev === 0) return null;
  return ((curr - prev) / Math.abs(prev)) * 100;
}

export default function NsiRevenueClient({
  data,
  comp,
  params,
}: {
  data: NsiRevenueData;
  comp: NsiRevenueData;
  params: RevenueFilterParams;
}) {
  const router = useRouter();
  const searchParamsHook = useSearchParams();
  const [family, setFamily] = useState<ProductFamily>('Combined');
  const [grain, setGrain] = useState<'monthly' | 'quarterly'>('quarterly');

  const allPoints = data[family];
  const chartPoints = useMemo(
    () => (grain === 'quarterly' ? toQuarters(allPoints) : allPoints),
    [allPoints, grain]
  );

  // KPI totals — current period
  const totRevenue  = allPoints.reduce((s, p) => s + p.revenue, 0);
  const totSpend    = allPoints.filter((p) => p.spend > 0).reduce((s, p) => s + p.spend, 0);
  const totImpr     = allPoints.reduce((s, p) => s + p.impressions, 0);
  const overallRoas = totSpend > 0 ? (totRevenue * 0.01) / totSpend : 0;

  // KPI totals — comparison period
  const compPoints    = comp[family];
  const compRevenue   = compPoints.reduce((s, p) => s + p.revenue, 0);
  const compSpend     = compPoints.filter((p) => p.spend > 0).reduce((s, p) => s + p.spend, 0);
  const compImpr      = compPoints.reduce((s, p) => s + p.impressions, 0);
  const compRoas      = compSpend > 0 ? (compRevenue * 0.01) / compSpend : 0;

  const spendStartLabel  = allPoints.find((p) => p.spend > 0)?.label ?? '';
  const spendStartXLabel = useMemo(
    () => chartPoints.find((p) => p.spend > 0)?.label,
    [chartPoints]
  );

  function updateUrl(changes: Record<string, string>) {
    const next = new URLSearchParams(searchParamsHook.toString());
    for (const [k, v] of Object.entries(changes)) {
      if (v === '' || v === 'all') next.delete(k);
      else next.set(k, v);
    }
    router.push(`?${next.toString()}`);
  }

  const handleDateApply = (
    start: string, end: string, compMode: CompMode, compStart: string, compEnd: string
  ) => {
    updateUrl({ start, end, comp_start: compStart, comp_end: compEnd, comp_mode: compMode });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-brand-dark tracking-tight">Revenue Impact</h1>
        <p className="text-sm text-gray-400 mt-1">
          How ad investment in impressions is driving NSI revenue growth
        </p>
      </div>

      {/* Date filter bar */}
      <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex flex-wrap items-end gap-4">
        <DateRangePicker
          start={params.start}
          end={params.end}
          compMode={params.compMode}
          compStart={params.compStart}
          compEnd={params.compEnd}
          onApply={handleDateApply}
        />
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Compare Period</label>
          <div className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm font-semibold text-gray-700 whitespace-nowrap">
            {fmtDate(params.compStart)} – {fmtDate(params.compEnd)}
          </div>
        </div>
      </div>

      {/* Controls row */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Family tabs */}
        <div className="flex bg-white border border-gray-200 rounded-xl p-1 gap-1">
          {FAMILIES.map((f) => (
            <button
              key={f}
              onClick={() => setFamily(f)}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-semibold transition-all',
                family === f
                  ? 'bg-brand-forest text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              )}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Grain toggle */}
        <div className="flex bg-white border border-gray-200 rounded-xl p-1 gap-1 ml-auto">
          {(['quarterly', 'monthly'] as const).map((g) => (
            <button
              key={g}
              onClick={() => setGrain(g)}
              className={cn(
                'px-3 py-2 rounded-lg text-xs font-semibold capitalize transition-all',
                grain === g
                  ? 'bg-gray-100 text-gray-800'
                  : 'text-gray-400 hover:text-gray-600'
              )}
            >
              {g}
            </button>
          ))}
        </div>
      </div>

      {/* KPI cards */}
      <div className="flex flex-wrap gap-3">
        <KpiCard
          title="Total Revenue"
          value={fmtRevenue(totRevenue)}
          delta={pctDelta(totRevenue, compRevenue)}
          sub={`${fmtDate(params.start)} – ${fmtDate(params.end)}`}
          icon={TrendingUp}
          color="bg-brand-forest"
        />
        <KpiCard
          title="Total Ad Spend"
          value={totSpend > 0 ? fmtSpend(totSpend) : '—'}
          delta={totSpend > 0 && compSpend > 0 ? pctDelta(totSpend, compSpend) : null}
          sub={totSpend > 0 ? `Since ${spendStartLabel}` : 'Pre-digital era'}
          icon={DollarSign}
          color="bg-brand-orange"
          invertDelta
        />
        <KpiCard
          title="Total Impressions"
          value={totImpr > 0 ? fmtImpressions(totImpr) : '—'}
          delta={totImpr > 0 && compImpr > 0 ? pctDelta(totImpr, compImpr) : null}
          sub={totImpr > 0 ? 'Across all channels' : 'Pre-digital era'}
          icon={Eye}
          color="bg-indigo-500"
        />
        <KpiCard
          title="Overall ROAS"
          value={fmtRoas(overallRoas)}
          delta={overallRoas > 0 && compRoas > 0 ? pctDelta(overallRoas, compRoas) : null}
          sub={overallRoas > 0 ? `$${overallRoas.toFixed(0)} returned per $1 spent` : 'No spend data'}
          icon={Zap}
          color="bg-emerald-500"
        />
      </div>

      {/* Main chart */}
      <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h3 className="text-sm font-extrabold text-gray-700">Spend · Impressions · Revenue Over Time</h3>
            <p className="text-xs text-gray-400 mt-1">
              Each metric scales independently — the chart shows proportional trends, not raw magnitudes
            </p>
          </div>
          {/* Legend */}
          <div className="flex flex-wrap gap-4 text-xs font-semibold shrink-0 ml-4">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-brand-forest/25 border border-brand-forest/40" />
              Revenue
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-6 h-0.5 bg-indigo-500 rounded" />
              Impressions
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-6 h-0.5 bg-brand-orange rounded" />
              Spend
            </span>
          </div>
        </div>

        <ResponsiveContainer width="100%" height={380}>
          <ComposedChart data={chartPoints} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: '#9CA3AF' }}
              axisLine={false}
              tickLine={false}
              interval={grain === 'monthly' ? 2 : 0}
            />

            {/* Independent hidden axes — each metric scales to its own 0–max */}
            <YAxis yAxisId="revenue"     hide />
            <YAxis yAxisId="impressions" hide />
            <YAxis yAxisId="spend"       hide />

            <Tooltip content={<ChartTooltip />} />

            {/* Mark when digital spend began */}
            {spendStartXLabel && (
              <ReferenceLine
                yAxisId="revenue"
                x={spendStartXLabel}
                stroke="#D1D5DB"
                strokeDasharray="4 3"
                label={{ value: 'Digital launch', position: 'insideTopRight', fontSize: 10, fill: '#9CA3AF' }}
              />
            )}

            <Bar
              yAxisId="revenue"
              dataKey="revenue"
              name="Revenue"
              fill="#0B4A31"
              opacity={0.18}
              radius={[3, 3, 0, 0]}
              maxBarSize={48}
            />
            <Line
              yAxisId="impressions"
              type="monotone"
              dataKey="impressions"
              name="Impressions"
              stroke="#6366F1"
              strokeWidth={2.5}
              dot={{ r: 3, fill: '#6366F1', strokeWidth: 0 }}
              activeDot={{ r: 5 }}
            />
            <Line
              yAxisId="spend"
              type="monotone"
              dataKey="spend"
              name="Spend"
              stroke="#EB541E"
              strokeWidth={2.5}
              dot={{ r: 3, fill: '#EB541E', strokeWidth: 0 }}
              activeDot={{ r: 5 }}
            />
          </ComposedChart>
        </ResponsiveContainer>

        <p className="text-[11px] text-gray-400 mt-3 text-center">
          Metrics displayed on independent scales. Revenue = {family === 'Combined' ? 'all families' : family} product revenue.
          Spend + impressions = all campaigns in the {family === 'Combined' ? 'Combined' : family} media group.
        </p>
      </div>

      {/* Q1 YoY comparison chart */}
      <Q1Chart points={allPoints} family={family} />

      {/* Quarterly summary table */}
      <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
        <h3 className="text-xs font-extrabold text-gray-400 uppercase tracking-widest mb-5">
          Quarterly Summary — {family}
        </h3>
        <SummaryTable points={allPoints} />
      </div>
    </div>
  );
}
