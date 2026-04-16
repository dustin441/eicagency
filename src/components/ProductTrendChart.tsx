'use client';

import React, { useState } from 'react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import type { ProductTimeSeriesPoint, TimeSeriesGrain } from '@/services/spartaco-product-analytics';
import { cn } from '@/lib/utils';

const METRICS: {
  key: keyof ProductTimeSeriesPoint;
  label: string;
  color: string;
  fmt: (v: number) => string;
}[] = [
  { key: 'ad_revenue',        label: 'Ad Revenue',       color: '#10B981', fmt: (v) => `$${Math.round(v).toLocaleString()}` },
  { key: 'ad_roas',           label: 'ROAS',             color: '#6366F1', fmt: (v) => `${v.toFixed(2)}x` },
  { key: 'ad_purchases',      label: 'Ad Purchases',     color: '#8B5CF6', fmt: (v) => Math.round(v).toLocaleString() },
  { key: 'ga4_sessions',      label: 'Sessions',         color: '#3B82F6', fmt: (v) => Math.round(v).toLocaleString() },
  { key: 'ga4_purchases',     label: 'GA4 Purchases',    color: '#0EA5E9', fmt: (v) => Math.round(v).toLocaleString() },
  { key: 'ga4_revenue',       label: 'GA4 Revenue',      color: '#14B8A6', fmt: (v) => `$${Math.round(v).toLocaleString()}` },
  { key: 'gsc_clicks',        label: 'GSC Clicks',       color: '#F59E0B', fmt: (v) => Math.round(v).toLocaleString() },
  { key: 'email_opens',       label: 'Email Opens',      color: '#EC4899', fmt: (v) => Math.round(v).toLocaleString() },
  { key: 'social_engagement', label: 'Social Engagement',color: '#A78BFA', fmt: (v) => Math.round(v).toLocaleString() },
];

const BAR_SIZE: Record<TimeSeriesGrain, number> = {
  month: 32,
  week:  20,
  day:   10,
};

const GRAIN_LABEL: Record<TimeSeriesGrain, string> = {
  day:   'Daily',
  week:  'Weekly',
  month: 'Monthly',
};

function fmtCurrency(v: number) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `$${(v / 1_000).toFixed(0)}K`;
  return `$${Math.round(v).toLocaleString()}`;
}

function fmtCompact(v: number) {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `${(v / 1_000).toFixed(0)}K`;
  return Math.round(v).toLocaleString();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-lg p-4 text-sm min-w-[160px]">
      <p className="font-bold text-brand-dark mb-2">{label}</p>
      {payload.map((entry: { name: string; value: number; color: string; dataKey: string }) => {
        const metric = METRICS.find(m => m.key === entry.dataKey);
        const formatted = metric ? metric.fmt(entry.value) : entry.value;
        return (
          <div key={entry.dataKey} className="flex justify-between gap-4 mb-1">
            <span style={{ color: entry.color }} className="font-medium">{entry.name}</span>
            <span className="font-semibold text-brand-dark">{formatted}</span>
          </div>
        );
      })}
      {payload[0]?.payload?.ad_cost !== undefined && (
        <div className="flex justify-between gap-4 mt-2 pt-2 border-t border-gray-100">
          <span className="text-gray-500 font-medium">Ad Spend</span>
          <span className="font-semibold text-brand-dark">{fmtCurrency(payload[0].payload.ad_cost)}</span>
        </div>
      )}
    </div>
  );
}

export default function ProductTrendChart({
  data,
  grain,
  dateRange,
}: {
  data: ProductTimeSeriesPoint[];
  grain: TimeSeriesGrain;
  dateRange: string;
}) {
  const [activeMetrics, setActiveMetrics] = useState<Set<keyof ProductTimeSeriesPoint>>(
    new Set(['ad_revenue'])
  );

  function toggleMetric(key: keyof ProductTimeSeriesPoint) {
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

  const activeMetricObjects = METRICS.filter(m => activeMetrics.has(m.key));
  const hasRightAxis = activeMetricObjects.some(m =>
    !['ad_revenue', 'ga4_revenue'].includes(m.key as string)
  );

  return (
    <div className="bg-white border border-gray-100 rounded-3xl overflow-hidden shadow-sm">
      <div className="px-8 py-6 border-b border-gray-100">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-xl font-bold text-brand-dark">Performance Over Time</h3>
            <p className="text-sm text-gray-500 mt-1">
              {GRAIN_LABEL[grain]} · {dateRange} · Ad Spend bars + selected metrics as lines
            </p>
          </div>
        </div>

        {/* Metric toggles */}
        <div className="flex flex-wrap gap-2 mt-5">
          {METRICS.map(m => {
            const active = activeMetrics.has(m.key);
            return (
              <button
                key={m.key as string}
                onClick={() => toggleMetric(m.key)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all',
                  active
                    ? 'text-white border-transparent shadow-sm'
                    : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300 hover:text-gray-700'
                )}
                style={active ? { background: m.color, borderColor: m.color } : {}}
              >
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ background: active ? 'white' : m.color }}
                />
                {m.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="px-4 py-6">
        <ResponsiveContainer width="100%" height={340}>
          <ComposedChart data={data} margin={{ top: 4, right: hasRightAxis ? 60 : 20, left: 20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: '#94a3b8' }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
            />
            {/* Left axis: spend */}
            <YAxis
              yAxisId="spend"
              orientation="left"
              tickFormatter={fmtCurrency}
              tick={{ fontSize: 11, fill: '#94a3b8' }}
              axisLine={false}
              tickLine={false}
              width={64}
            />
            {/* Right axis: metrics */}
            {hasRightAxis && (
              <YAxis
                yAxisId="metric"
                orientation="right"
                tickFormatter={fmtCompact}
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                axisLine={false}
                tickLine={false}
                width={60}
              />
            )}
            <Tooltip content={<CustomTooltip />} />

            {/* Spend bars */}
            <Bar
              yAxisId="spend"
              dataKey="ad_cost"
              name="Ad Spend"
              fill="#0B4A31"
              fillOpacity={0.85}
              radius={[4, 4, 0, 0]}
              barSize={BAR_SIZE[grain]}
            />

            {/* Active metric lines */}
            {activeMetricObjects.map(m => {
              const useRightAxis = !['ad_revenue', 'ga4_revenue'].includes(m.key as string);
              return (
                <Line
                  key={m.key as string}
                  yAxisId={useRightAxis && hasRightAxis ? 'metric' : 'spend'}
                  type="monotone"
                  dataKey={m.key as string}
                  name={m.label}
                  stroke={m.color}
                  strokeWidth={2.5}
                  dot={data.length <= 35 ? { r: 3, fill: m.color, strokeWidth: 0 } : false}
                  activeDot={{ r: 5, fill: m.color, strokeWidth: 0 }}
                />
              );
            })}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
