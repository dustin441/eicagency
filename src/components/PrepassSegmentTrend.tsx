'use client';

import { useState } from 'react';
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { cn, fmtCurrency, fmtNumber } from '@/lib/utils';
import type { SegmentExtras } from '@/services/prepass-segment-report';

const METRICS = [
  { key: 'mql', label: 'MQL' },
  { key: 'sql', label: 'SQL' },
  { key: 'won', label: 'Closed won' },
  { key: 'leads', label: 'Leads' },
] as const;

type MetricKey = (typeof METRICS)[number]['key'];

export default function PrepassSegmentTrend({ daily }: { daily: SegmentExtras['daily'] }) {
  const [metric, setMetric] = useState<MetricKey>('won');
  const label = METRICS.find((m) => m.key === metric)!.label;
  const data = daily.map((r) => ({ ...r, label: new Date(`${r.d}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) }));
  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-gray-950">Trend by day</h2>
        <div className="inline-flex rounded-xl border border-gray-200 p-1 text-sm font-semibold">
          {METRICS.map((m) => (
            <button key={m.key} type="button" onClick={() => setMetric(m.key)} className={cn('rounded-lg px-3 py-1.5', metric === m.key ? 'bg-brand-forest text-white' : 'text-gray-600 hover:bg-gray-50')}>{m.label}</button>
          ))}
        </div>
      </div>
      <p className="mt-1 text-xs text-gray-500">Bars count each stage on the day it happened. The line is that day&apos;s ad spend for this segment&apos;s campaigns.</p>
      <div className="mt-4 h-72">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#6b7280' }} tickLine={false} axisLine={{ stroke: '#e5e7eb' }} interval="preserveStartEnd" minTickGap={24} />
            <YAxis yAxisId="left" tick={{ fontSize: 12, fill: '#6b7280' }} tickLine={false} axisLine={false} width={40} allowDecimals={false} />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12, fill: '#6b7280' }} tickLine={false} axisLine={false} width={52} tickFormatter={(v: number) => `$${Math.round(v / 1000)}k`} />
            <Tooltip formatter={(v, name) => (name === 'Ad spend' ? fmtCurrency(Number(v)) : fmtNumber(Number(v)))} cursor={{ fill: 'rgba(15,23,42,0.04)' }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar yAxisId="left" dataKey={metric} name={label} fill="#1f5c45" radius={[3, 3, 0, 0]} />
            <Line yAxisId="right" type="monotone" dataKey="spend" name="Ad spend" stroke="#0f172a" strokeWidth={2} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
