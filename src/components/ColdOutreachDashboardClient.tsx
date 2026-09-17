'use client';

import { useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { TrendingDown, TrendingUp } from 'lucide-react';
import FilterBar from '@/components/FilterBar';
import type {
  EicInstantlyPerformance,
  InstantlyMetricSummary,
  InstantlyTrendPoint,
} from '@/services/instantly-analytics';

function fmtN(value: number) {
  return value.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function fmtPct(value: number) {
  return `${value.toFixed(2)}%`;
}

function fmtDate(value: string) {
  return new Date(`${value}T12:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

function delta(current: number, previous: number) {
  if (previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

function DeltaBadge({ current, previous }: { current: number; previous: number }) {
  const change = delta(current, previous);
  if (change === null) {
    return current > 0
      ? <span className="text-[10px] font-bold text-brand-forest">New vs prior period</span>
      : <span className="text-[10px] font-medium text-gray-300">No prior-period activity</span>;
  }

  const improved = change > 0;
  const neutral = Math.abs(change) < 0.05;
  return (
    <span className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
      neutral ? 'bg-gray-100 text-gray-500' : improved ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
    }`}>
      {change >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
      {change >= 0 ? '+' : ''}{change.toFixed(1)}%
    </span>
  );
}

type MetricKey = 'sends' | 'opens' | 'clicks' | 'openRate' | 'clickRate' | 'replyRate' | 'positiveReplyRate';

type MetricDefinition = {
  key: MetricKey;
  label: string;
  color: string;
  format: (value: number) => string;
};

const METRICS: MetricDefinition[] = [
  { key: 'sends', label: 'Sends', color: '#0B4A31', format: fmtN },
  { key: 'opens', label: 'Unique Opens', color: '#2563EB', format: fmtN },
  { key: 'clicks', label: 'Unique Clicks', color: '#7C3AED', format: fmtN },
  { key: 'openRate', label: 'Open Rate', color: '#0EA5E9', format: fmtPct },
  { key: 'clickRate', label: 'Click Rate', color: '#8B5CF6', format: fmtPct },
  { key: 'replyRate', label: 'Reply Rate', color: '#F59E0B', format: fmtPct },
  { key: 'positiveReplyRate', label: 'Positive Reply Rate', color: '#EB541E', format: fmtPct },
];

function MetricCard({ metric, current, previous }: {
  metric: MetricDefinition;
  current: number;
  previous: number;
}) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">{metric.label}</p>
      <p className="mt-2 text-xl font-bold text-gray-900">{metric.format(current)}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <DeltaBadge current={current} previous={previous} />
        <span className="text-[10px] text-gray-400">Prior {metric.format(previous)}</span>
      </div>
    </div>
  );
}

function TrendChart({ data, start, end }: { data: InstantlyTrendPoint[]; start: string; end: string }) {
  const [selected, setSelected] = useState<Set<MetricKey>>(new Set(['sends', 'positiveReplyRate']));

  function toggle(key: MetricKey) {
    setSelected(previous => {
      const next = new Set(previous);
      if (next.has(key)) {
        if (next.size > 1) next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  const active = METRICS.filter(metric => selected.has(metric.key));

  return (
    <section className="rounded-[2.5rem] border border-gray-100 bg-white p-8 shadow-sm">
      <div className="flex flex-col gap-4">
        <div>
          <h3 className="text-xl font-bold text-[#0f172a]">Cold Outreach Trends</h3>
          <p className="mt-1 text-sm font-medium text-gray-400">
            {fmtDate(start)} to {fmtDate(end)} · Weekly Instantly activity
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {METRICS.map(metric => {
            const isActive = selected.has(metric.key);
            return (
              <button
                key={metric.key}
                type="button"
                onClick={() => toggle(metric.key)}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition-all ${
                  isActive
                    ? 'border-transparent text-white shadow-sm'
                    : 'border-gray-200 bg-gray-50 text-gray-400 hover:border-gray-300 hover:text-gray-600'
                }`}
                style={isActive ? { backgroundColor: metric.color, borderColor: metric.color } : {}}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: isActive ? 'rgba(255,255,255,0.85)' : metric.color }}
                />
                {metric.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-6 h-[320px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
            <XAxis
              dataKey="date"
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#9CA3AF', fontSize: 10, fontWeight: 600 }}
              tickFormatter={value => fmtDate(String(value))}
              interval="preserveStartEnd"
              dy={10}
            />
            {METRICS.map(metric => <YAxis key={metric.key} yAxisId={metric.key} hide />)}
            <Tooltip
              contentStyle={{ borderRadius: 16, border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: 12, fontSize: 13 }}
              labelFormatter={label => `Week of ${fmtDate(String(label))}`}
              formatter={(value, name) => {
                const metric = METRICS.find(option => option.label === name);
                return metric ? [metric.format(Number(value)), metric.label] : [String(value), String(name)];
              }}
            />
            {active.map(metric => (
              <Line
                key={metric.key}
                yAxisId={metric.key}
                type="monotone"
                dataKey={metric.key}
                name={metric.label}
                stroke={metric.color}
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 5, fill: metric.color, strokeWidth: 2, stroke: '#fff' }}
                connectNulls={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-3 text-xs text-gray-400">
        Each point represents a Monday-based calendar week. Weekly rate lines are directional activity rates; delayed opens and replies can occur after the original send date. Period scorecards remain the source of truth for exact unique rates.
      </p>
    </section>
  );
}

function ComparisonCell({ current, previous, format }: {
  current: number;
  previous: number;
  format: (value: number) => string;
}) {
  return (
    <td className="px-4 py-4 text-right whitespace-nowrap">
      <p className="font-semibold text-gray-700">{format(current)}</p>
      <div className="mt-1 flex items-center justify-end gap-1.5">
        <DeltaBadge current={current} previous={previous} />
        <span className="text-[9px] text-gray-400">Prev {format(previous)}</span>
      </div>
    </td>
  );
}

function CampaignTable({ data }: { data: EicInstantlyPerformance }) {
  const columns: { metric: MetricDefinition; value: (row: InstantlyMetricSummary) => number }[] = METRICS.map(metric => ({
    metric,
    value: row => row[metric.key],
  }));

  return (
    <div className="overflow-hidden rounded-[2.5rem] border border-gray-100 bg-white shadow-sm">
      <div className="border-b border-gray-50 p-8">
        <h3 className="text-xl font-bold text-[#0f172a]">Campaign Performance</h3>
        <p className="mt-1 text-sm font-medium text-gray-400">
          Selected period compared with {fmtDate(data.comparisonStart)} to {fmtDate(data.comparisonEnd)}
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-max w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="sticky left-0 bg-gray-50 px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Campaign</th>
              {columns.map(({ metric }) => (
                <th key={metric.key} className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">{metric.label}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {data.campaigns.map(row => (
              <tr key={row.campaignId || row.campaignName} className="transition-colors hover:bg-gray-50">
                <td className="sticky left-0 min-w-72 bg-white px-6 py-4 font-medium text-gray-900">{row.campaignName}</td>
                {columns.map(({ metric, value }) => (
                  <ComparisonCell
                    key={metric.key}
                    current={value(row)}
                    previous={value(row.comparison)}
                    format={metric.format}
                  />
                ))}
              </tr>
            ))}
            {data.campaigns.length === 0 && (
              <tr>
                <td colSpan={columns.length + 1} className="px-6 py-10 text-center text-gray-400">
                  No Instantly campaigns sent email in either period.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function ColdOutreachDashboardClient({ data }: { data: EicInstantlyPerformance }) {
  if (!data.available) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cold Outreach Performance</h1>
          <p className="mt-1 text-sm text-gray-500">Instantly email performance and monthly targets</p>
        </div>
        <FilterBar showChannel={false} />
        <section className="rounded-[2.5rem] border border-amber-100 bg-amber-50/60 p-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-amber-700">Instantly</p>
          <h2 className="mt-2 text-xl font-bold text-gray-900">Cold outreach data is unavailable</h2>
          <p className="mt-2 text-sm text-amber-800">{data.error}</p>
        </section>
      </div>
    );
  }

  const { summary, comparisonSummary, monthlyGoal } = data;
  const sendProgress = Math.min(monthlyGoal.sendProgress, 100);
  const sendOnTarget = monthlyGoal.projectedSends >= monthlyGoal.sendTarget;
  const replyOnTarget = monthlyGoal.replyRate >= monthlyGoal.replyRateTarget;
  const monthLabel = new Date(`${monthlyGoal.monthStart}T12:00:00Z`).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Cold Outreach Performance</h1>
        <p className="mt-1 text-sm text-gray-500">Instantly sending, engagement, and progress toward positive replies</p>
      </div>

      <FilterBar showChannel={false} />

      <section className="space-y-4">
        <div className="rounded-[2.5rem] border border-gray-100 bg-white p-8 shadow-sm">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-brand-orange">Instantly</p>
              <h2 className="mt-2 text-xl font-bold text-[#0f172a]">Overall Performance</h2>
              <p className="mt-1 text-sm font-medium text-gray-400">
                {data.periodStart} to {data.periodEnd} · Compared with {data.comparisonStart} to {data.comparisonEnd}
              </p>
            </div>
            <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:w-[520px]">
              <div className="rounded-2xl bg-gray-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">{monthLabel} sends</p>
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${sendOnTarget ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                    {sendOnTarget ? 'On pace' : 'Below pace'}
                  </span>
                </div>
                <p className="mt-2 text-2xl font-bold text-gray-900">
                  {fmtN(monthlyGoal.sends)} <span className="text-sm font-medium text-gray-400">/ {fmtN(monthlyGoal.sendTarget)}</span>
                </p>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-200">
                  <div className="h-full rounded-full bg-brand-forest" style={{ width: `${sendProgress}%` }} />
                </div>
                <p className="mt-2 text-xs text-gray-500">{fmtN(monthlyGoal.projectedSends)} projected this month</p>
              </div>
              <div className="rounded-2xl bg-gray-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Monthly reply rate</p>
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${replyOnTarget ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                    {replyOnTarget ? 'At target' : 'Below target'}
                  </span>
                </div>
                <p className="mt-2 text-2xl font-bold text-gray-900">{fmtPct(monthlyGoal.replyRate)}</p>
                <p className="mt-3 text-xs text-gray-500">Goal: {fmtPct(monthlyGoal.replyRateTarget)} · Data through {monthlyGoal.dataThrough}</p>
              </div>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
            {METRICS.map(metric => (
              <MetricCard
                key={metric.key}
                metric={metric}
                current={summary[metric.key]}
                previous={comparisonSummary[metric.key]}
              />
            ))}
          </div>
          <p className="mt-4 text-xs text-gray-400">
            Rates use unique opens, clicks, human replies, and Instantly opportunities divided by {fmtN(summary.contacts)} unique contacts reached. Instantly&apos;s human-reply metric already excludes automatic replies. Positive replies depend on opportunity classification in Instantly.
          </p>
        </div>

        {data.trend.length > 1 && <TrendChart data={data.trend} start={data.periodStart} end={data.periodEnd} />}
        <CampaignTable data={data} />
      </section>
    </div>
  );
}
