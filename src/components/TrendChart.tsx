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
};

const TREND_METRICS: { key: string; label: string; color: string; fmt: (v: number) => string }[] = [
  { key: 'mql',                 label: 'MQLs',     color: '#EB541E', fmt: (v) => Math.round(v).toLocaleString() },
  { key: 'platformConversions', label: 'Leads',     color: '#8B5CF6', fmt: (v) => Math.round(v).toLocaleString() },
  { key: 'sqls',                label: 'SQLs',      color: '#6366F1', fmt: (v) => Math.round(v).toLocaleString() },
  { key: 'ctr',                 label: 'CTR',       color: '#10B981', fmt: (v) => `${v.toFixed(2)}%` },
  { key: 'cpc',                 label: 'CPC',       color: '#3B82F6', fmt: (v) => `$${v.toFixed(2)}` },
  { key: 'cpl',                 label: 'CPL',       color: '#F59E0B', fmt: (v) => `$${Math.round(v).toLocaleString()}` },
  { key: 'costPerMql',          label: 'Cost/MQL',  color: '#EC4899', fmt: (v) => `$${Math.round(v).toLocaleString()}` },
];

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

  const enriched = dailyData.map(day => ({
    ...day,
    ctr:        day.impressions > 0         ? (day.clicks / day.impressions) * 100 : 0,
    cpc:        day.clicks > 0              ? day.spend / day.clicks               : 0,
    cpl:        day.platformConversions > 0 ? day.spend / day.platformConversions  : 0,
    costPerMql: day.mql > 0                ? day.spend / day.mql                  : 0,
  }));

  const activeList = TREND_METRICS.filter(m => activeMetrics.has(m.key));

  return (
    <div className={cn('lg:col-span-2 bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm', className)}>
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-xl font-bold text-[#0f172a]">Spend vs. Metrics</h3>
            <p className="text-sm text-gray-400 font-medium">{dateRange}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-3 h-3 rounded-full bg-[#0B4A31]/20 border border-[#0B4A31]" />
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Spend</span>
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
              interval="preserveStartEnd"
              tickFormatter={(v) =>
                new Date(v + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
              }
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
              labelFormatter={(label) =>
                new Date(label + 'T12:00:00').toLocaleDateString('en-US', {
                  weekday: 'short', month: 'short', day: 'numeric',
                })
              }
            />
            <Bar
              yAxisId="left"
              dataKey="spend"
              fill="#0B4A31"
              fillOpacity={0.12}
              stroke="#0B4A31"
              radius={[4, 4, 0, 0]}
              barSize={16}
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
