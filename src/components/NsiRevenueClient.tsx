'use client';

import React, { useMemo, useState } from 'react';
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
import { TrendingUp, DollarSign, Eye, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { NsiRevenueData, NsiRevenuePoint, ProductFamily } from '@/services/nsi-revenue-analytics';

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
        roas: spend > 0 ? revenue / spend : 0,
      });
    }
  }
  return Array.from(map.values());
}

// ── KPI card ──────────────────────────────────────────────────────────────────

function KpiCard({
  title,
  value,
  sub,
  icon: Icon,
  color,
}: {
  title: string;
  value: string;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5 flex-1 min-w-[160px] shadow-sm">
      <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center mb-3', color)}>
        <Icon className="w-4 h-4 text-white" />
      </div>
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">{title}</p>
      <p className="text-xl font-black text-brand-dark tracking-tight">{value}</p>
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
          <span className="font-bold text-emerald-600">{fmtRoas(revenue.value / spend.value)}</span>
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

// ── Main component ────────────────────────────────────────────────────────────

const FAMILIES: ProductFamily[] = ['Combined', 'BPT', 'POL', 'CMP'];

export default function NsiRevenueClient({ data }: { data: NsiRevenueData }) {
  const [family, setFamily] = useState<ProductFamily>('Combined');
  const [grain, setGrain] = useState<'monthly' | 'quarterly'>('quarterly');

  const allPoints = data[family];
  const chartPoints = useMemo(
    () => (grain === 'quarterly' ? toQuarters(allPoints) : allPoints),
    [allPoints, grain]
  );

  // KPI totals for the current family
  const totRevenue    = allPoints.reduce((s, p) => s + p.revenue, 0);
  const totSpend      = allPoints.filter((p) => p.spend > 0).reduce((s, p) => s + p.spend, 0);
  const totImpr       = allPoints.reduce((s, p) => s + p.impressions, 0);
  const overallRoas   = totSpend > 0 ? totRevenue / totSpend : 0;

  // Find when digital spend started (first month with spend > 0)
  const spendStartLabel = allPoints.find((p) => p.spend > 0)?.label ?? '';

  // Label of the first data point with spend > 0 in the current chart grain
  const spendStartXLabel = useMemo(
    () => chartPoints.find((p) => p.spend > 0)?.label,
    [chartPoints]
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-brand-dark tracking-tight">Revenue Impact</h1>
        <p className="text-sm text-gray-400 mt-1">
          How ad investment in impressions is driving NSI revenue growth
        </p>
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
          sub="Jan 2023 – present"
          icon={TrendingUp}
          color="bg-brand-forest"
        />
        <KpiCard
          title="Total Ad Spend"
          value={totSpend > 0 ? fmtSpend(totSpend) : '—'}
          sub={totSpend > 0 ? `Since ${spendStartLabel}` : 'Pre-digital era'}
          icon={DollarSign}
          color="bg-brand-orange"
        />
        <KpiCard
          title="Total Impressions"
          value={totImpr > 0 ? fmtImpressions(totImpr) : '—'}
          sub={totImpr > 0 ? `Across all channels` : 'Pre-digital era'}
          icon={Eye}
          color="bg-indigo-500"
        />
        <KpiCard
          title="Overall ROAS"
          value={fmtRoas(overallRoas)}
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
