'use client';

import React, { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { cn } from '@/lib/utils';

export type QualifiedFleetOriginRow = {
  origin: string;
  mqls: number;
  sqls: number;
  won: number;
};

type Stage = 'mqls' | 'sqls' | 'won';

const STAGES: { key: Stage; label: 'MQL' | 'SQL' | 'WON'; color: string }[] = [
  { key: 'mqls', label: 'MQL', color: '#EB541E' },
  { key: 'sqls', label: 'SQL', color: '#2563EB' },
  { key: 'won', label: 'WON', color: '#0B4A31' },
];

export default function QualifiedFleetOriginChart({
  rows,
}: {
  rows: QualifiedFleetOriginRow[];
}) {
  const [stage, setStage] = useState<Stage>('mqls');
  const active = STAGES.find(item => item.key === stage) ?? STAGES[0];
  const data = useMemo(
    () => rows
      .map(row => ({ origin: row.origin, total: row[stage] }))
      .filter(row => row.total > 0)
      .sort((a, b) => b.total - a.total || a.origin.localeCompare(b.origin)),
    [rows, stage],
  );
  const total = data.reduce((sum, row) => sum + row.total, 0);
  const chartHeight = Math.max(320, data.length * 52);
  const shortOrigin = (value: string) => value.length > 42 ? `${value.slice(0, 39)}…` : value;

  return (
    <section className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
      <div className="p-8 border-b border-gray-50 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h3 className="text-xl font-bold text-brand-dark">Qualified Fleet Funnel by Origin</h3>
          <p className="text-sm text-gray-400 font-medium mt-1">
            Leads reporting more than 100 trucks · Current-year results within the selected period
          </p>
        </div>
        <div className="flex flex-wrap gap-2" aria-label="Funnel stage filter">
          {STAGES.map(item => (
            <button
              key={item.key}
              type="button"
              onClick={() => setStage(item.key)}
              aria-pressed={stage === item.key}
              className={cn(
                'px-4 py-2 rounded-full text-xs font-bold border transition-colors',
                stage === item.key
                  ? 'text-white border-transparent'
                  : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-gray-300',
              )}
              style={stage === item.key ? { backgroundColor: item.color, borderColor: item.color } : undefined}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-8">
        <div className="flex items-end gap-2 mb-5">
          <span className="text-3xl font-bold text-brand-dark tabular-nums">{total.toLocaleString()}</span>
          <span className="text-xs font-bold uppercase tracking-widest text-gray-400 pb-1">
            Total {active.label}s
          </span>
        </div>

        {total > 0 ? (
          <div style={{ height: chartHeight }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} layout="vertical" margin={{ top: 10, right: 24, left: 8, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E5E7EB" />
                <XAxis
                  type="number"
                  allowDecimals={false}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#9CA3AF', fontSize: 11, fontWeight: 600 }}
                />
                <YAxis
                  type="category"
                  dataKey="origin"
                  width={260}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={shortOrigin}
                  tick={{ fill: '#6B7280', fontSize: 11, fontWeight: 600 }}
                />
                <Tooltip
                  cursor={{ fill: '#F9FAFB' }}
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px rgb(15 23 42 / 0.12)' }}
                  formatter={(value) => [Number(value).toLocaleString(), active.label]}
                />
                <Bar dataKey="total" name={active.label} fill={active.color} radius={[0, 10, 10, 0]} maxBarSize={30} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-[240px] flex items-center justify-center rounded-3xl bg-gray-50 text-sm font-medium text-gray-400">
            No {active.label} records in the selected period.
          </div>
        )}

        <div className="sr-only">
          {rows.map(row => (
            <span key={row.origin}>{row.origin}: {row.mqls} MQL, {row.sqls} SQL, {row.won} WON. </span>
          ))}
        </div>
        <p className="text-xs text-gray-400 font-medium mt-4">
          Every identified source, medium, and campaign combination is shown separately. Missing evidence is reported as Origin not identified, not Direct access.
        </p>
      </div>
    </section>
  );
}
