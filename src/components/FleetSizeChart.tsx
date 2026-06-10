'use client';

import React from 'react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import type { FleetBandStat } from '@/services/analytics';

const fmt$ = (n: number) => `$${Math.round(n).toLocaleString()}`;

// PrePass ABM: leads by fleet-size band (bars) + campaign-attributed cost/lead (line).
export default function FleetSizeChart({
  data,
  title = 'Fleet Size Breakdown',
  subtitle,
}: {
  data: FleetBandStat[];
  title?: string;
  subtitle?: string;
}) {
  if (!data || data.length === 0) return null;
  const totalLeads = data.reduce((a, d) => a + d.leads, 0);

  return (
    <div className="w-full bg-white border border-gray-100 shadow-sm rounded-[2.5rem] overflow-hidden">
      <div className="p-8 border-b border-gray-100">
        <h3 className="text-xl font-bold text-brand-dark">{title}</h3>
        <p className="text-sm text-gray-400 font-medium mt-0.5">
          {subtitle ?? `Leads by fleet size · ${totalLeads.toLocaleString()} attributed leads · bars = leads, line = cost/lead`}
        </p>
      </div>
      <div className="p-6" style={{ height: 360 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 16, right: 24, left: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
            <XAxis dataKey="band" tick={{ fontSize: 12, fill: '#64748b' }} />
            <YAxis yAxisId="left" tick={{ fontSize: 12, fill: '#64748b' }} allowDecimals={false} />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fontSize: 12, fill: '#64748b' }}
              tickFormatter={(v) => fmt$(Number(v))}
            />
            <Tooltip
              formatter={(value: number, name: string) =>
                name === 'cost'
                  ? [`${fmt$(Number(value))}/lead`, 'Cost/Lead']
                  : [Number(value).toLocaleString(), 'Leads']
              }
              labelFormatter={(l) => `Fleet size: ${l}`}
            />
            <Bar yAxisId="left" dataKey="leads" name="leads" radius={[6, 6, 0, 0]} fill="#0B4A31" maxBarSize={64} />
            <Line yAxisId="right" type="monotone" dataKey="cost" name="cost" stroke="#EB541E" strokeWidth={2} dot={{ r: 3 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
