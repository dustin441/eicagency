'use client';

import React, { useState } from 'react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';
import { cn } from '@/lib/utils';
import type { MonthlyTrendPoint } from '@/services/analytics';

const METRICS: { key: keyof MonthlyTrendPoint; label: string; color: string; fmt: (v: number) => string }[] = [
  { key: 'mqls',        label: 'MQLs',      color: '#EB541E', fmt: v => Math.round(v).toLocaleString() },
  { key: 'leads',       label: 'Leads',     color: '#8B5CF6', fmt: v => Math.round(v).toLocaleString() },
  { key: 'sqls',        label: 'SQLs',      color: '#6366F1', fmt: v => Math.round(v).toLocaleString() },
  { key: 'won',         label: 'Won',       color: '#10B981', fmt: v => Math.round(v).toLocaleString() },
  { key: 'costPerMql',  label: 'Cost/MQL',  color: '#EC4899', fmt: v => `$${Math.round(v).toLocaleString()}` },
  { key: 'costPerLead', label: 'Cost/Lead', color: '#F59E0B', fmt: v => `$${Math.round(v).toLocaleString()}` },
  { key: 'costPerWon',  label: 'Cost/Won',  color: '#0EA5E9', fmt: v => `$${Math.round(v).toLocaleString()}` },
];

export default function MonthlyTrendChart({ data }: { data: MonthlyTrendPoint[] }) {
  const [activeMetrics, setActiveMetrics] = useState<Set<string>>(new Set(['costPerMql']));

  function toggle(key: string) {
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

  const activeList = METRICS.filter(m => activeMetrics.has(m.key));
  const isCostMetric = activeList.some(m => m.key.startsWith('cost'));

  return (
    <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm">
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-xl font-bold text-brand-dark">6-Month Trend</h3>
            <p className="text-sm text-gray-400 font-medium">Monthly spend vs. key metrics</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-3 h-3 rounded-full bg-brand-forest/20 border border-[#0B4A31]" />
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Spend</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {METRICS.map(m => {
            const active = activeMetrics.has(m.key);
            return (
              <button
                key={m.key}
                onClick={() => toggle(m.key)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-all',
                  active
                    ? 'text-white border-transparent'
                    : 'bg-gray-50 border-gray-200 text-gray-400 hover:border-gray-300 hover:text-gray-600',
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
          <ComposedChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#9CA3AF', fontSize: 11, fontWeight: 600 }}
              dy={10}
            />
            <YAxis
              yAxisId="left"
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#9CA3AF', fontSize: 10, fontWeight: 600 }}
              tickFormatter={v => `$${(v / 1000).toFixed(0)}k`}
              width={48}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#9CA3AF', fontSize: 10, fontWeight: 600 }}
              tickFormatter={v => isCostMetric ? `$${Math.round(v).toLocaleString()}` : Math.round(v).toLocaleString()}
              width={56}
            />
            <Tooltip
              contentStyle={{
                borderRadius: '16px', border: 'none',
                boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                padding: '12px', fontSize: '13px',
              }}
              formatter={(value, name) => {
                if (name === 'spend') return [`$${Number(value).toLocaleString()}`, 'Spend'];
                const m = METRICS.find(x => x.key === name);
                return m ? [m.fmt(Number(value)), m.label] : [String(value), name];
              }}
            />
            <Bar
              yAxisId="left"
              dataKey="spend"
              fill="#0B4A31"
              fillOpacity={0.12}
              stroke="#0B4A31"
              radius={[6, 6, 0, 0]}
              barSize={40}
            />
            {activeList.map(m => (
              <Line
                key={m.key}
                yAxisId="right"
                type="monotone"
                dataKey={m.key}
                stroke={m.color}
                strokeWidth={2.5}
                dot={{ r: 4, fill: m.color, strokeWidth: 2, stroke: '#fff' }}
                activeDot={{ r: 6, fill: m.color, strokeWidth: 2, stroke: '#fff' }}
              />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
