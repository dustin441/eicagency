'use client';

import React, { useState } from 'react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';
import type { ProductTimeSeriesPoint, TimeSeriesGrain } from '@/services/spartaco-product-analytics';
import { cn } from '@/lib/utils';

// ─── Metric definitions ───────────────────────────────────────────────────────

type MetricDef = {
  key: keyof ProductTimeSeriesPoint;
  label: string;
  color: string;
  fmt: (v: number) => string;
  inverted?: boolean; // lower = better (e.g. position, CPL)
};

type MetricGroup = {
  id: string;
  label: string;
  metrics: MetricDef[];
};

const fmtDollar   = (v: number) => v >= 1000 ? `$${(v / 1000).toFixed(0)}K` : `$${Math.round(v).toLocaleString()}`;
const fmtCount    = (v: number) => v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}K` : Math.round(v).toLocaleString();
const fmtPct      = (v: number) => `${(v * 100).toFixed(1)}%`;
const fmtX        = (v: number) => `${v.toFixed(2)}x`;
const fmtPos      = (v: number) => v > 0 ? v.toFixed(1) : '—';

const METRIC_GROUPS: MetricGroup[] = [
  {
    id: 'paid', label: 'Paid Media',
    metrics: [
      { key: 'ad_impressions',  label: 'Ad Impressions',  color: '#A5B4FC', fmt: fmtCount },
      { key: 'ad_clicks',       label: 'Ad Clicks',        color: '#818CF8', fmt: fmtCount },
      { key: 'ad_conversions',  label: 'Leads',            color: '#6366F1', fmt: fmtCount },
      { key: 'ad_cpl',          label: 'CPL',              color: '#4F46E5', fmt: fmtDollar, inverted: true },
      { key: 'ad_purchases',    label: 'Purchases',        color: '#4338CA', fmt: fmtCount },
      { key: 'ad_revenue',      label: 'Ad Revenue',       color: '#10B981', fmt: fmtDollar },
      { key: 'ad_roas',         label: 'ROAS',             color: '#059669', fmt: fmtX },
    ],
  },
  {
    id: 'web', label: 'Website (GA4)',
    metrics: [
      { key: 'ga4_sessions',         label: 'Sessions',         color: '#7DD3FC', fmt: fmtCount },
      { key: 'ga4_engaged_sessions', label: 'Engaged Sessions', color: '#38BDF8', fmt: fmtCount },
      { key: 'ga4_purchases',        label: 'GA4 Purchases',    color: '#0EA5E9', fmt: fmtCount },
      { key: 'ga4_revenue',          label: 'GA4 Revenue',      color: '#0284C7', fmt: fmtDollar },
    ],
  },
  {
    id: 'email', label: 'Email',
    metrics: [
      { key: 'email_total_sent',  label: 'Total Sent',  color: '#C4B5FD', fmt: fmtCount },
      { key: 'email_open_rate',   label: 'Open Rate',   color: '#A78BFA', fmt: fmtPct },
      { key: 'email_click_rate',  label: 'Click Rate',  color: '#8B5CF6', fmt: fmtPct },
    ],
  },
  {
    id: 'search', label: 'Search (GSC)',
    metrics: [
      { key: 'gsc_impressions',     label: 'GSC Impressions', color: '#FCD34D', fmt: fmtCount },
      { key: 'gsc_clicks',          label: 'GSC Clicks',      color: '#F59E0B', fmt: fmtCount },
      { key: 'gsc_ctr',             label: 'GSC CTR',         color: '#D97706', fmt: fmtPct },
      { key: 'gsc_avg_position',    label: 'Avg Position',    color: '#B45309', fmt: fmtPos, inverted: true },
      { key: 'gsc_keywords_ranked', label: 'Keywords',        color: '#92400E', fmt: fmtCount },
    ],
  },
  {
    id: 'social', label: 'Social',
    metrics: [
      { key: 'social_post_count',      label: 'Posts',          color: '#FDA4AF', fmt: fmtCount },
      { key: 'social_impressions',     label: 'Social Impr.',   color: '#FB7185', fmt: fmtCount },
      { key: 'social_interactions',    label: 'Interactions',   color: '#F43F5E', fmt: fmtCount },
      { key: 'social_engagement_rate', label: 'Eng. Rate',      color: '#BE123C', fmt: fmtPct },
    ],
  },
];

const ALL_METRICS: MetricDef[] = METRIC_GROUPS.flatMap(g => g.metrics);

const BAR_SIZE: Record<TimeSeriesGrain, number> = { month: 32, week: 20, day: 10 };
const GRAIN_LABEL: Record<TimeSeriesGrain, string> = { day: 'Daily', week: 'Weekly', month: 'Monthly' };

// ─── Tooltip ──────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label, activeMetrics }: any) {
  if (!active || !payload?.length) return null;
  const point: ProductTimeSeriesPoint = payload[0]?.payload;
  if (!point) return null;

  const activeList = ALL_METRICS.filter(m => activeMetrics.has(m.key));

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-xl p-4 text-sm min-w-[180px] max-w-[260px]">
      <p className="font-extrabold text-brand-dark mb-3 text-xs uppercase tracking-wide">{label}</p>

      {/* Always show spend */}
      <div className="flex justify-between gap-4 mb-2 pb-2 border-b border-gray-100">
        <span className="text-gray-500 font-medium text-xs">Ad Spend</span>
        <span className="font-bold text-brand-dark text-xs">{fmtDollar(point.ad_cost)}</span>
      </div>

      {/* Selected metrics */}
      {activeList.map(m => {
        const value = point[m.key] as number;
        return (
          <div key={m.key as string} className="flex justify-between gap-4 mb-1">
            <span className="font-medium text-xs flex items-center gap-1.5" style={{ color: m.color }}>
              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: m.color }} />
              {m.label}
            </span>
            <span className="font-semibold text-brand-dark text-xs">{m.fmt(value)}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

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

  const activeList = ALL_METRICS.filter(m => activeMetrics.has(m.key));

  return (
    <div className="bg-white border border-gray-100 rounded-3xl overflow-hidden shadow-sm">
      {/* Header */}
      <div className="px-8 pt-6 pb-0 border-b border-gray-100">
        <div className="flex flex-wrap items-start justify-between gap-4 pb-5">
          <div>
            <h3 className="text-xl font-bold text-brand-dark">Performance Over Time</h3>
            <p className="text-sm text-gray-500 mt-1">
              {GRAIN_LABEL[grain]} · {dateRange}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              Ad Spend shown as bars · each metric line independently scaled to its own range
            </p>
          </div>
          {activeList.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-1">
              {activeList.map(m => (
                <span
                  key={m.key as string}
                  className="flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-full text-white"
                  style={{ background: m.color }}
                >
                  {m.label}
                  <button
                    onClick={() => toggleMetric(m.key)}
                    className="opacity-70 hover:opacity-100 ml-0.5"
                    aria-label={`Remove ${m.label}`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Grouped metric toggles */}
        <div className="space-y-3 pb-5">
          {METRIC_GROUPS.map(group => (
            <div key={group.id} className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
              <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest w-24 flex-shrink-0">
                {group.label}
              </span>
              <div className="flex flex-wrap gap-1.5">
                {group.metrics.map(m => {
                  const active = activeMetrics.has(m.key);
                  return (
                    <button
                      key={m.key as string}
                      onClick={() => toggleMetric(m.key)}
                      className={cn(
                        'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all',
                        active
                          ? 'text-white border-transparent shadow-sm'
                          : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300 hover:text-gray-700'
                      )}
                      style={active ? { background: m.color, borderColor: m.color } : {}}
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                        style={{ background: active ? 'rgba(255,255,255,0.8)' : m.color }}
                      />
                      {m.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="px-4 py-6">
        <ResponsiveContainer width="100%" height={360}>
          <ComposedChart data={data} margin={{ top: 4, right: 24, left: 20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: '#94a3b8' }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
            />

            {/* Left axis: Ad Spend (absolute $) */}
            <YAxis
              yAxisId="spend"
              orientation="left"
              tickFormatter={fmtDollar}
              tick={{ fontSize: 11, fill: '#94a3b8' }}
              axisLine={false}
              tickLine={false}
              width={60}
            />

            {/* Per-metric hidden Y axes — each auto-scales to its own range */}
            {activeList.map(m => (
              <YAxis
                key={`axis-${m.key as string}`}
                yAxisId={`y-${m.key as string}`}
                orientation="right"
                hide={true}
                domain={['auto', 'auto']}
              />
            ))}

            <Tooltip
              content={<CustomTooltip activeMetrics={activeMetrics} />}
              cursor={{ fill: 'rgba(241,245,249,0.6)' }}
            />

            {/* Ad Spend bars */}
            <Bar
              yAxisId="spend"
              dataKey="ad_cost"
              name="Ad Spend"
              fill="#0B4A31"
              fillOpacity={0.85}
              radius={[4, 4, 0, 0]}
              barSize={BAR_SIZE[grain]}
            />

            {/* One line per active metric, each on its own hidden axis */}
            {activeList.map(m => (
              <Line
                key={m.key as string}
                yAxisId={`y-${m.key as string}`}
                type="monotone"
                dataKey={m.key as string}
                name={m.label}
                stroke={m.color}
                strokeWidth={2.5}
                dot={data.length <= 35 ? { r: 3, fill: m.color, strokeWidth: 0 } : false}
                activeDot={{ r: 5, fill: m.color, strokeWidth: 2, stroke: 'white' }}
                connectNulls
              />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
