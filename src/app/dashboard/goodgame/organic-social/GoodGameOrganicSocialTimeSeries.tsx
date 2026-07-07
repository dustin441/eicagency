'use client';

import React from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { GoodGameOrganicSocialDailyMetric } from '@/services/goodgame-organic-social';

type Bucket = {
  date: string;
  impressions: number;
  engagement: number;
  engagementRate: number;
};

function toDate(value: string) {
  return new Date(`${value}T12:00:00`);
}

function compact(value: number) {
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

function pct(value: number) {
  return `${value.toFixed(1)}%`;
}

function getWeekStart(dateStr: string) {
  const date = toDate(dateStr);
  const day = date.getDay();
  date.setDate(date.getDate() - ((day + 6) % 7));
  return date.toISOString().slice(0, 10);
}

function getMonthStart(dateStr: string) {
  return `${dateStr.slice(0, 7)}-01`;
}

function getGranularity(rows: GoodGameOrganicSocialDailyMetric[]): 'day' | 'week' | 'month' {
  if (rows.length < 2) return 'day';
  const sorted = [...rows].sort((a, b) => a.metric_date.localeCompare(b.metric_date));
  const first = toDate(sorted[0].metric_date).getTime();
  const last = toDate(sorted[sorted.length - 1].metric_date).getTime();
  const spanDays = Math.max(1, Math.round((last - first) / 86_400_000) + 1);
  if (spanDays >= 60) return 'month';
  if (spanDays >= 21) return 'week';
  return 'day';
}

function bucketRows(rows: GoodGameOrganicSocialDailyMetric[], granularity: 'day' | 'week' | 'month'): Bucket[] {
  const buckets = new Map<string, { date: string; impressions: number; engagement: number }>();

  rows.forEach((row) => {
    const key = granularity === 'month' ? getMonthStart(row.metric_date) : granularity === 'week' ? getWeekStart(row.metric_date) : row.metric_date;
    const current = buckets.get(key) ?? { date: key, impressions: 0, engagement: 0 };
    current.impressions += row.impressions;
    current.engagement += row.interactions;
    buckets.set(key, current);
  });

  return Array.from(buckets.values())
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((row) => ({
      ...row,
      engagementRate: row.impressions > 0 ? (row.engagement / row.impressions) * 100 : 0,
    }));
}

function labelForDate(value: string, granularity: 'day' | 'week' | 'month') {
  const date = toDate(value);
  if (granularity === 'month') return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  if (granularity === 'week') return `Week of ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function GoodGameOrganicSocialTimeSeries({
  rows,
  dateRange,
}: {
  rows: GoodGameOrganicSocialDailyMetric[];
  dateRange: string;
}) {
  const granularity = getGranularity(rows);
  const data = bucketRows(rows, granularity);
  const label = { day: 'Daily', week: 'Weekly', month: 'Monthly' }[granularity];

  return (
    <section className="rounded-[2rem] border border-gray-100 bg-white p-5 shadow-sm lg:p-6">
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-xl font-black text-gray-950">Organic trend</h2>
          <p className="mt-1 text-sm text-gray-500">Impressions, engagement, and engagement rate for {dateRange}.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs font-black uppercase tracking-widest text-gray-500">
          <span className="rounded-full bg-gray-100 px-3 py-1.5">{label}</span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-50 px-3 py-1.5 text-brand-orange"><span className="h-2 w-2 rounded-full bg-brand-orange" />Impressions</span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-brand-forest"><span className="h-2 w-2 rounded-full bg-brand-forest" />Engagement</span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-slate-600"><span className="h-2 w-2 rounded-full bg-slate-500" />Eng. rate</span>
        </div>
      </div>

      {data.length ? (
        <div className="h-[360px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 10, right: 8, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
              <XAxis
                dataKey="date"
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#9CA3AF', fontSize: 11, fontWeight: 700 }}
                tickFormatter={(value) => labelForDate(String(value), granularity).replace('Week of ', '')}
                dy={10}
                interval={granularity === 'day' ? 'preserveStartEnd' : 0}
              />
              <YAxis
                yAxisId="volume"
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#9CA3AF', fontSize: 11, fontWeight: 700 }}
                tickFormatter={(value) => compact(Number(value))}
                width={54}
              />
              <YAxis
                yAxisId="rate"
                orientation="right"
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#9CA3AF', fontSize: 11, fontWeight: 700 }}
                tickFormatter={(value) => pct(Number(value))}
                width={46}
              />
              <Tooltip
                contentStyle={{ border: 'none', borderRadius: 18, boxShadow: '0 18px 45px rgb(15 23 42 / 0.14)', padding: 14 }}
                labelFormatter={(value) => labelForDate(String(value), granularity)}
                formatter={(value, name) => {
                  if (name === 'engagementRate') return [pct(Number(value)), 'Engagement rate'];
                  if (name === 'engagement') return [Math.round(Number(value)).toLocaleString(), 'Engagement'];
                  return [Math.round(Number(value)).toLocaleString(), 'Impressions'];
                }}
              />
              <Line yAxisId="volume" type="monotone" dataKey="impressions" stroke="#EB541E" strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 5 }} />
              <Line yAxisId="volume" type="monotone" dataKey="engagement" stroke="#0B4A31" strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 5 }} />
              <Line yAxisId="rate" type="monotone" dataKey="engagementRate" stroke="#64748B" strokeWidth={3} strokeDasharray="5 5" dot={{ r: 3 }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="flex h-[260px] items-center justify-center rounded-[1.5rem] bg-gray-50 text-sm font-bold text-gray-400">
          No daily metrics match this date range yet.
        </div>
      )}
    </section>
  );
}
