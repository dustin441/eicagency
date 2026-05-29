'use client';

import React, { useState } from 'react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';
import { cn } from '@/lib/utils';

export type TrendDay = {
  date: string;
  spend: number;
  mql: number;
  clicks: number;
  impressions: number;
  platformConversions: number;
  sqls: number;
  calls?: number;
  wonCalls?: number;
};

const TREND_METRICS: { key: string; label: string; color: string; fmt: (v: number) => string }[] = [
  { key: 'mql',                 label: 'MQLs',        color: '#EB541E', fmt: (v) => Math.round(v).toLocaleString() },
  { key: 'platformConversions', label: 'Leads',        color: '#8B5CF6', fmt: (v) => Math.round(v).toLocaleString() },
  { key: 'sqls',                label: 'SQLs',         color: '#6366F1', fmt: (v) => Math.round(v).toLocaleString() },
  { key: 'calls',               label: 'Phone Calls',  color: '#0EA5E9', fmt: (v) => Math.round(v).toLocaleString() },
  { key: 'wonCalls',            label: 'Won Calls',    color: '#0B4A31', fmt: (v) => Math.round(v).toLocaleString() },
  { key: 'ctr',                 label: 'CTR',          color: '#10B981', fmt: (v) => `${v.toFixed(2)}%` },
  { key: 'cpc',                 label: 'CPC',          color: '#3B82F6', fmt: (v) => `$${v.toFixed(2)}` },
  { key: 'cpl',                 label: 'CPL',          color: '#F59E0B', fmt: (v) => `$${Math.round(v).toLocaleString()}` },
  { key: 'costPerMql',          label: 'Cost/MQL',     color: '#EC4899', fmt: (v) => `$${Math.round(v).toLocaleString()}` },
];

function getWeekStart(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  const day = d.getDay(); // 0=Sun
  d.setDate(d.getDate() - ((day + 6) % 7)); // back to Monday
  return d.toISOString().split('T')[0];
}

function getMonthStart(dateStr: string): string {
  return dateStr.substring(0, 7) + '-01';
}

function bucketData(data: TrendDay[], gran: 'day' | 'week' | 'month'): TrendDay[] {
  if (gran === 'day') return data;
  const buckets = new Map<string, TrendDay>();
  for (const day of data) {
    const key = gran === 'week' ? getWeekStart(day.date) : getMonthStart(day.date);
    const e = buckets.get(key);
    if (!e) {
      buckets.set(key, { ...day, date: key });
    } else {
      buckets.set(key, {
        date: key,
        spend:               e.spend               + day.spend,
        mql:                 e.mql                 + day.mql,
        clicks:              e.clicks              + day.clicks,
        impressions:         e.impressions         + day.impressions,
        platformConversions: e.platformConversions + day.platformConversions,
        sqls:                e.sqls                + day.sqls,
        calls:               (e.calls    ?? 0)     + (day.calls    ?? 0),
        wonCalls:            (e.wonCalls ?? 0)     + (day.wonCalls ?? 0),
      });
    }
  }
  return Array.from(buckets.values()).sort((a, b) => a.date.localeCompare(b.date));
}

export default function TrendChart({
  dailyData,
  dateRange,
  defaultMetric = 'mql',
  className,
}: {
  dailyData: TrendDay[];
  dateRange: string;
  defaultMetric?: string;
  className?: string;
}) {
  const [activeMetrics, setActiveMetrics] = useState<Set<string>>(new Set([defaultMetric]));

  function toggleMetric(key: string) {
    setActiveMetrics(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        if (next.size > 1) next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  const granularity: 'day' | 'week' | 'month' =
    dailyData.length < 30 ? 'day' : dailyData.length <= 90 ? 'week' : 'month';

  const GRAN_LABEL = { day: 'Daily', week: 'Weekly', month: 'Monthly' } as const;

  const displayData = bucketData(dailyData, granularity);

  const enriched = displayData.map(day => ({
    ...day,
    ctr:        day.impressions > 0         ? (day.clicks / day.impressions) * 100 : 0,
    cpc:        day.clicks > 0              ? day.spend / day.clicks               : 0,
    cpl:        day.platformConversions > 0 ? day.spend / day.platformConversions  : 0,
    costPerMql: day.mql > 0                ? day.spend / day.mql                  : 0,
  }));

  const activeList = TREND_METRICS.filter(m => activeMetrics.has(m.key));

  const barSize = granularity === 'month' ? 36 : granularity === 'week' ? 20 : 16;

  function xTickFormatter(v: string) {
    const d = new Date(v + 'T12:00:00');
    if (granularity === 'month') return d.toLocaleDateString('en-US', { month: 'short' });
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  function tooltipLabelFormatter(label: unknown) {
    const d = new Date(String(label) + 'T12:00:00');
    if (granularity === 'month') return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    if (granularity === 'week') return `Week of ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }

  return (
    <div className={cn('lg:col-span-2 bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm', className)}>
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-xl font-bold text-[#0f172a]">Spend vs. Metrics</h3>
            <p className="text-sm text-gray-400 font-medium">{dateRange}</p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className="text-xs font-semibold text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full">
              {GRAN_LABEL[granularity]}
            </span>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#0B4A31]/20 border border-[#0B4A31]" />
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Spend</span>
            </div>
          </div>
        </div>

        {/* Metric toggle pills */}
        <div className="flex flex-wrap gap-2">
          {TREND_METRICS.map(m => {
            const active = activeMetrics.has(m.key);
            return (
              <button
                key={m.key}
                onClick={() => toggleMetric(m.key)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-all',
                  active
                    ? 'text-white border-transparent'
                    : 'bg-gray-50 border-gray-200 text-gray-400 hover:border-gray-300 hover:text-gray-600'
                )}
                style={active ? { backgroundColor: m.color, borderColor: m.color } : {}}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: active ? 'rgba(255,255,255,0.8)' : m.color }}
                />
                {m.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="h-[320px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={enriched}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
            <XAxis
              dataKey="date"
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#9CA3AF', fontSize: 10, fontWeight: 600 }}
              dy={10}
              interval={granularity === 'day' ? 'preserveStartEnd' : 0}
              tickFormatter={xTickFormatter}
            />
            <YAxis
              yAxisId="left"
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#9CA3AF', fontSize: 10, fontWeight: 600 }}
              tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#9CA3AF', fontSize: 10, fontWeight: 600 }}
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
                if (name === 'spend') return [`$${Number(value).toLocaleString()}`, 'Spend'];
                const m = TREND_METRICS.find(x => x.key === name);
                return m ? [m.fmt(Number(value)), m.label] : [String(value), name];
              }}
              labelFormatter={tooltipLabelFormatter}
            />
            <Bar
              yAxisId="left"
              dataKey="spend"
              fill="#0B4A31"
              fillOpacity={0.12}
              stroke="#0B4A31"
              radius={[4, 4, 0, 0]}
              barSize={barSize}
            />
            {activeList.map((m) => (
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
