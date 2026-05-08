'use client';

import React from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  Activity,
  Clock,
  MousePointerClick,
  Percent,
  Timer,
  UserPlus,
  Users,
  Zap,
} from 'lucide-react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { cn } from '@/lib/utils';
import FilterBar from '@/components/FilterBar';
import type { Ga4MetricKey, Ga4MetricSummary, Ga4PerformanceStats } from '@/services/analytics';

const ICONS: Record<Ga4MetricKey, React.ComponentType<{ className?: string }>> = {
  totalUsers: Users,
  newUsers: UserPlus,
  sessions: MousePointerClick,
  engagedSessions: Activity,
  engagementRate: Percent,
  bounceRate: ArrowDownRight,
  averageSessionDuration: Timer,
  keyEvents: Zap,
};

const COLORS: Record<Ga4MetricKey, string> = {
  totalUsers: 'text-blue-600',
  newUsers: 'text-emerald-600',
  sessions: 'text-brand-forest',
  engagedSessions: 'text-cyan-600',
  engagementRate: 'text-violet-600',
  bounceRate: 'text-rose-600',
  averageSessionDuration: 'text-amber-600',
  keyEvents: 'text-brand-orange',
};

function fmtNumber(value: number) {
  return Math.round(value).toLocaleString();
}

function fmtPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function fmtDuration(seconds: number) {
  if (!seconds) return '0s';
  const rounded = Math.round(seconds);
  const mins = Math.floor(rounded / 60);
  const secs = rounded % 60;
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${String(secs).padStart(2, '0')}s`;
}

function formatMetric(metric: Ga4MetricSummary) {
  if (metric.format === 'percent') return fmtPercent(metric.value);
  if (metric.format === 'duration') return fmtDuration(metric.value);
  return fmtNumber(metric.value);
}

function delta(metric: Ga4MetricSummary) {
  const { value, previousValue } = metric;
  if (previousValue === 0) {
    if (value === 0) return { label: '0.0%', isGood: true };
    return { label: '+100%', isGood: !metric.inverted };
  }

  const pct = ((value - previousValue) / previousValue) * 100;
  const isGood = metric.inverted ? pct <= 0 : pct >= 0;
  return {
    label: `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`,
    isGood,
  };
}

function deltaValues(value: number, previousValue: number, inverted = false) {
  if (previousValue === 0) {
    if (value === 0) return { label: '0.0%', isGood: true };
    return { label: '+100%', isGood: !inverted };
  }

  const pct = ((value - previousValue) / previousValue) * 100;
  return {
    label: `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`,
    isGood: inverted ? pct <= 0 : pct >= 0,
  };
}

function TrendPill({ value, previousValue }: { value: number; previousValue: number }) {
  const d = deltaValues(value, previousValue);
  return (
    <span
      className={cn(
        'inline-flex items-center text-[11px] font-bold px-2 py-0.5 rounded-full',
        d.isGood ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600',
      )}
    >
      {d.isGood ? <ArrowUpRight className="w-3 h-3 mr-0.5" /> : <ArrowDownRight className="w-3 h-3 mr-0.5" />}
      {d.label}
    </span>
  );
}

function MetricCard({ metric, delay }: { metric: Ga4MetricSummary; delay: number }) {
  const Icon = ICONS[metric.key];
  const d = delta(metric);

  return (
    <div
      className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-center justify-between mb-5">
        <div className="p-2 rounded-xl bg-gray-50">
          <Icon className={cn('w-5 h-5', COLORS[metric.key])} />
        </div>
        <div
          className={cn(
            'flex items-center text-xs font-bold px-2 py-1 rounded-full',
            d.isGood ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600',
          )}
        >
          {d.isGood ? <ArrowUpRight className="w-3 h-3 mr-0.5" /> : <ArrowDownRight className="w-3 h-3 mr-0.5" />}
          {d.label}
        </div>
      </div>
      <div className="text-2xl font-bold text-brand-dark tabular-nums mb-1">{formatMetric(metric)}</div>
      <div className="text-xs font-bold text-gray-400 uppercase tracking-widest">{metric.label}</div>
    </div>
  );
}

function MetricCell({
  value,
  previousValue,
  format = 'number',
}: {
  value: number;
  previousValue: number;
  format?: 'number' | 'percent';
}) {
  return (
    <div className="space-y-1">
      <div className="font-bold text-brand-dark tabular-nums">
        {format === 'percent' ? fmtPercent(value) : fmtNumber(value)}
      </div>
      <div className="flex items-center gap-2">
        <TrendPill value={value} previousValue={previousValue} />
        <span className="text-[11px] text-gray-400 tabular-nums">
          vs {format === 'percent' ? fmtPercent(previousValue) : fmtNumber(previousValue)}
        </span>
      </div>
    </div>
  );
}

function Ga4TimeSeriesChart({ data }: { data: Ga4PerformanceStats['timeSeries'] }) {
  return (
    <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-brand-dark">GA4 Monthly Trend</h2>
          <p className="text-sm text-gray-400 font-medium">January 2024 through the last complete month</p>
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          {[
            ['#0B4A31', 'Total Users'],
            ['#2563EB', 'New Users'],
            ['#EB541E', 'Engagement Rate'],
          ].map(([color, label]) => (
            <div key={label} className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">{label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="h-[380px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#9CA3AF', fontSize: 11, fontWeight: 600 }}
              dy={10}
              interval="preserveStartEnd"
            />
            <YAxis
              yAxisId="users"
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#9CA3AF', fontSize: 10, fontWeight: 600 }}
              tickFormatter={(value) => Number(value).toLocaleString()}
              width={56}
            />
            <YAxis
              yAxisId="rate"
              orientation="right"
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#9CA3AF', fontSize: 10, fontWeight: 600 }}
              tickFormatter={(value) => `${Math.round(Number(value) * 100)}%`}
              width={48}
            />
            <Tooltip
              contentStyle={{
                borderRadius: '16px',
                border: 'none',
                boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                padding: '12px',
                fontSize: '13px',
              }}
              formatter={(value, name) => {
                if (name === 'engagementRate') return [fmtPercent(Number(value)), 'Engagement Rate'];
                if (name === 'totalUsers') return [fmtNumber(Number(value)), 'Total Users'];
                if (name === 'newUsers') return [fmtNumber(Number(value)), 'New Users'];
                return [String(value), String(name)];
              }}
            />
            <Line
              yAxisId="users"
              type="monotone"
              dataKey="totalUsers"
              stroke="#0B4A31"
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 5, fill: '#0B4A31', strokeWidth: 2, stroke: '#fff' }}
            />
            <Line
              yAxisId="users"
              type="monotone"
              dataKey="newUsers"
              stroke="#2563EB"
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 5, fill: '#2563EB', strokeWidth: 2, stroke: '#fff' }}
            />
            <Line
              yAxisId="rate"
              type="monotone"
              dataKey="engagementRate"
              stroke="#EB541E"
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 5, fill: '#EB541E', strokeWidth: 2, stroke: '#fff' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function SourceMediumTable({ data }: { data: Ga4PerformanceStats }) {
  return (
    <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden">
      <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row md:items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-brand-dark">Source / Medium</h2>
          <p className="text-sm text-gray-400 font-medium">
            {data.scorecardRangeLabel} compared to {data.comparisonRangeLabel}
          </p>
        </div>
        <div className="text-xs font-bold uppercase tracking-widest text-gray-400">
          {data.selectedSourceMedium === 'all' ? `Top ${data.sourceMedium.length} by sessions` : 'Filtered source'}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] text-sm">
          <thead>
            <tr className="bg-gray-50 text-[11px] font-bold uppercase tracking-widest text-gray-400">
              <th className="text-left px-6 py-3">Source / Medium</th>
              <th className="text-left px-4 py-3">Channel</th>
              <th className="text-left px-4 py-3">Users</th>
              <th className="text-left px-4 py-3">Sessions</th>
              <th className="text-left px-4 py-3">Engaged</th>
              <th className="text-left px-4 py-3">Engagement</th>
              <th className="text-left px-4 py-3">Key Events</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {data.sourceMedium.map((row) => (
              <tr key={`${row.source}-${row.medium}-${row.channel}`} className="hover:bg-gray-50/60 transition-colors">
                <td className="px-6 py-4">
                  <div className="font-bold text-brand-dark">{row.source}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{row.medium}</div>
                </td>
                <td className="px-4 py-4">
                  <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-1 text-xs font-bold text-gray-600">
                    {row.channel}
                  </span>
                </td>
                <td className="px-4 py-4">
                  <MetricCell value={row.totalUsers} previousValue={row.previousTotalUsers} />
                </td>
                <td className="px-4 py-4">
                  <MetricCell value={row.sessions} previousValue={row.previousSessions} />
                </td>
                <td className="px-4 py-4">
                  <MetricCell value={row.engagedSessions} previousValue={row.previousEngagedSessions} />
                </td>
                <td className="px-4 py-4">
                  <MetricCell value={row.engagementRate} previousValue={row.previousEngagementRate} format="percent" />
                </td>
                <td className="px-4 py-4">
                  <MetricCell value={row.keyEvents} previousValue={row.previousKeyEvents} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function Ga4PerformanceClient({ data }: { data: Ga4PerformanceStats }) {
  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-brand-dark tracking-tight">GA4 Performance</h1>
          <p className="text-gray-500 mt-1">
            Scorecards use the selected range; monthly trend remains fixed.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-full bg-white border border-gray-100 shadow-sm px-4 py-2">
          <Clock className="w-4 h-4 text-brand-forest" />
          <span className="text-xs font-bold uppercase tracking-widest text-gray-500">
            Trend through {data.lastCompleteMonthEnd}
          </span>
        </div>
      </div>

      <FilterBar
        showChannel={false}
        sourceMediumOptions={data.sourceMediumOptions}
        selectedSourceMedium={data.selectedSourceMedium}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {data.metrics.map((metric, index) => (
          <MetricCard key={metric.key} metric={metric} delay={index * 50} />
        ))}
      </div>

      <Ga4TimeSeriesChart data={data.timeSeries} />

      <SourceMediumTable data={data} />
    </div>
  );
}
