'use client';

import React from 'react';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

export type ChartPoint = {
  name: string;
  spend: number;
  mql: number;
};

export default function SpendChart({ data }: { data: ChartPoint[] }) {
  return (
    <div className="lg:col-span-2 bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm">
      <div className="flex items-center justify-between mb-10">
        <div>
          <h3 className="text-xl font-bold text-brand-dark">Spend vs. Leads</h3>
          <p className="text-sm text-gray-400 font-medium">Daily media spend and lead volume — last 30 days</p>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-brand-forest/20 border border-brand-forest" />
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Spend</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-brand-orange" />
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Leads</span>
          </div>
        </div>
      </div>

      <div className="h-[400px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
            <XAxis
              dataKey="name"
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#9CA3AF', fontSize: 11, fontWeight: 600 }}
              dy={10}
              interval="preserveStartEnd"
            />
            <YAxis
              yAxisId="left"
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#9CA3AF', fontSize: 11, fontWeight: 600 }}
              tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#9CA3AF', fontSize: 11, fontWeight: 600 }}
            />
            <Tooltip
              contentStyle={{
                borderRadius: '16px',
                border: 'none',
                boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                padding: '12px',
                fontSize: '13px',
              }}
              formatter={(value, name) => [
                name === 'spend' ? `$${Number(value).toLocaleString()}` : Number(value).toLocaleString(),
                name === 'spend' ? 'Spend' : 'Leads',
              ]}
            />
            <Bar
              yAxisId="left"
              dataKey="spend"
              fill="#0B4A31"
              fillOpacity={0.12}
              stroke="#0B4A31"
              radius={[4, 4, 0, 0]}
              barSize={28}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="mql"
              stroke="#EB541E"
              strokeWidth={3}
              dot={false}
              activeDot={{ r: 6, fill: '#EB541E', strokeWidth: 2, stroke: '#fff' }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
