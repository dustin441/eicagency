'use client';

import React, { useState } from 'react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { GoodGameDashboardData, GoodGameTimePoint } from '@/services/goodgame-analytics';
import FilterBar from '@/components/FilterBar';
import { MetaAdPreviews } from '@/components/AdPreviews';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt$(n: number) {
  return '$' + n.toLocaleString('en-US', { maximumFractionDigits: 0 });
}
function fmt$2(n: number) {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtN(n: number) {
  return n.toLocaleString('en-US', { maximumFractionDigits: 0 });
}
function fmtX(n: number) {
  return n.toFixed(2) + 'x';
}
function fmtPct(n: number) {
  return n.toFixed(2) + '%';
}
function fmtShort(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return String(Math.round(n));
}
function delta(curr: number, prev: number) {
  if (prev === 0) return null;
  return ((curr - prev) / prev) * 100;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function DeltaBadge({ curr, prev, invert = false, forceNeutral = false }: { curr: number; prev: number; invert?: boolean; forceNeutral?: boolean }) {
  const d = delta(curr, prev);
  if (d === null) return null;
  const positive = invert ? d < 0 : d > 0;
  const neutral = forceNeutral || Math.abs(d) < 0.5;
  const str = (d >= 0 ? '+' : '') + d.toFixed(1) + '%';
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-semibold px-1.5 py-0.5 rounded-full ${
      neutral ? 'bg-gray-100 text-gray-500' :
      positive ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'
    }`}>
      {neutral ? (d >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />) : positive ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
      {str}
    </span>
  );
}

function KpiCard({
  label, value, prev, format, invert = false, highlight = false, forceNeutral = false,
}: {
  label: string; value: number; prev: number;
  format: (n: number) => string; invert?: boolean; highlight?: boolean; forceNeutral?: boolean;
}) {
  return (
    <div className={`bg-white rounded-xl border shadow-sm p-5 flex flex-col gap-2 ${highlight ? 'border-brand-forest ring-1 ring-brand-forest/20' : 'border-gray-100'}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">{label}</p>
        {highlight && (
          <span className="text-[10px] font-bold text-brand-forest bg-brand-forest/10 px-2 py-0.5 rounded-full shrink-0">North Star</span>
        )}
      </div>
      <p className="text-2xl font-bold text-gray-900">{format(value)}</p>
      <DeltaBadge curr={value} prev={prev} invert={invert} forceNeutral={forceNeutral} />
    </div>
  );
}

// ─── Trend Chart ──────────────────────────────────────────────────────────────

const GG_METRICS: { key: string; label: string; color: string; fmt: (v: number) => string }[] = [
  { key: 'clicks',     label: 'Clicks',      color: '#EB541E', fmt: (v) => Math.round(v).toLocaleString() },
  { key: 'impressions',label: 'Impressions', color: '#8B5CF6', fmt: (v) => fmtShort(v) },
  { key: 'purchases',  label: 'Purchases',   color: '#10B981', fmt: (v) => Math.round(v).toLocaleString() },
  { key: 'revenue',    label: 'Revenue',     color: '#3B82F6', fmt: (v) => `$${Math.round(v).toLocaleString()}` },
  { key: 'ctr',        label: 'CTR',         color: '#F59E0B', fmt: (v) => `${v.toFixed(2)}%` },
  { key: 'cpc',        label: 'CPC',         color: '#EC4899', fmt: (v) => `$${v.toFixed(2)}` },
  { key: 'roas',       label: 'ROAS',        color: '#6366F1', fmt: (v) => `${v.toFixed(2)}x` },
];

type BucketPoint = {
  label: string;
  spend: number;
  impressions: number;
  clicks: number;
  purchases: number;
  revenue: number;
  ctr: number;
  cpc: number;
  roas: number;
};

function bucketData(data: GoodGameTimePoint[], type: 'daily' | 'weekly' | 'monthly'): BucketPoint[] {
  const acc = new Map<string, { spend: number; impressions: number; clicks: number; purchases: number; revenue: number }>();

  for (const d of data) {
    let key: string;
    if (type === 'daily') {
      key = d.label;
    } else if (type === 'weekly') {
      const dt = new Date(d.label + 'T12:00:00');
      const dow = dt.getDay();
      const diff = dow === 0 ? -6 : 1 - dow;
      dt.setDate(dt.getDate() + diff);
      key = dt.toISOString().split('T')[0];
    } else {
      key = d.label.slice(0, 7);
    }
    const e = acc.get(key) ?? { spend: 0, impressions: 0, clicks: 0, purchases: 0, revenue: 0 };
    e.spend += d.spend;
    e.impressions += d.impressions;
    e.clicks += d.clicks;
    e.purchases += d.purchases;
    e.revenue += d.revenue;
    acc.set(key, e);
  }

  return Array.from(acc.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, v]) => ({
      label,
      ...v,
      ctr:  v.impressions > 0 ? (v.clicks / v.impressions) * 100 : 0,
      cpc:  v.clicks > 0      ? v.spend / v.clicks               : 0,
      roas: v.spend > 0       ? v.revenue / v.spend              : 0,
    }));
}

function tickLabel(label: string, type: 'daily' | 'weekly' | 'monthly') {
  const d = new Date(label + 'T12:00:00');
  if (type === 'monthly') return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function GoodGameTrendChart({ data, start, end }: { data: GoodGameTimePoint[]; start: string; end: string }) {
  const [activeMetrics, setActiveMetrics] = useState<Set<string>>(new Set(['purchases']));

  function toggleMetric(key: string) {
    setActiveMetrics(prev => {
      const next = new Set(prev);
      if (next.has(key)) { if (next.size > 1) next.delete(key); }
      else next.add(key);
      return next;
    });
  }

  const days = Math.round(
    (new Date(end + 'T12:00:00').getTime() - new Date(start + 'T12:00:00').getTime()) / 86_400_000
  ) + 1;
  const bucketType: 'daily' | 'weekly' | 'monthly' = days <= 14 ? 'daily' : days <= 90 ? 'weekly' : 'monthly';
  const bucketLabel = bucketType === 'daily' ? 'Daily' : bucketType === 'weekly' ? 'Weekly' : 'Monthly';

  const chartData = bucketData(data, bucketType);
  const activeList = GG_METRICS.filter(m => activeMetrics.has(m.key));

  const dateRangeStr = [
    new Date(start + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    new Date(end + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
  ].join(' – ');

  return (
    <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm">
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-xl font-bold text-[#0f172a]">Spend vs. Metrics</h3>
            <p className="text-sm text-gray-400 font-medium">{dateRangeStr} · {bucketLabel}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-3 h-3 rounded-full bg-[#0B4A31]/20 border border-[#0B4A31]" />
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Spend</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {GG_METRICS.map(m => {
            const active = activeMetrics.has(m.key);
            return (
              <button
                key={m.key}
                onClick={() => toggleMetric(m.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
                  active ? 'text-white border-transparent' : 'bg-gray-50 border-gray-200 text-gray-400 hover:border-gray-300 hover:text-gray-600'
                }`}
                style={active ? { backgroundColor: m.color, borderColor: m.color } : {}}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: active ? 'rgba(255,255,255,0.8)' : m.color }} />
                {m.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="h-[320px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#9CA3AF', fontSize: 10, fontWeight: 600 }}
              dy={10}
              interval="preserveStartEnd"
              tickFormatter={v => tickLabel(v, bucketType)}
            />
            <YAxis
              yAxisId="left"
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#9CA3AF', fontSize: 10, fontWeight: 600 }}
              tickFormatter={v => `$${(v / 1000).toFixed(0)}k`}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#9CA3AF', fontSize: 10, fontWeight: 600 }}
            />
            <Tooltip
              contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px', fontSize: '13px' }}
              formatter={(value, name) => {
                if (name === 'spend') return [`$${Number(value).toLocaleString()}`, 'Spend'];
                const m = GG_METRICS.find(x => x.key === name);
                return m ? [m.fmt(Number(value)), m.label] : [String(value), String(name)];
              }}
              labelFormatter={label => tickLabel(String(label), bucketType)}
            />
            <Bar yAxisId="left" dataKey="spend" fill="#0B4A31" fillOpacity={0.12} stroke="#0B4A31" radius={[4, 4, 0, 0]} barSize={16} />
            {activeList.map(m => (
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

// ─── Channel Table ────────────────────────────────────────────────────────────

function ChannelTable({ rows }: { rows: GoodGameDashboardData['channelRows'] }) {
  return (
    <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
      <div className="p-8 border-b border-gray-50">
        <h3 className="text-xl font-bold text-[#0f172a]">Channel Breakdown</h3>
        <p className="text-sm text-gray-400 font-medium mt-1">Performance by channel · Selected period</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Channel</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Impressions</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Clicks</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">CTR</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Cost</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">CPC</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Purchases</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Revenue</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">ROAS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {rows.map((row) => {
              const ctr = row.impressions > 0 ? (row.clicks / row.impressions) * 100 : 0;
              const prevCtr = row.prevImpressions > 0 ? (row.prevClicks / row.prevImpressions) * 100 : 0;
              const cpc = row.clicks > 0 ? row.spend / row.clicks : 0;
              const prevCpc = row.prevClicks > 0 ? row.prevSpend / row.prevClicks : 0;
              const roas = row.spend > 0 ? row.revenue / row.spend : 0;
              const prevRoas = row.prevSpend > 0 ? row.prevRevenue / row.prevSpend : 0;
              return (
                <tr key={row.channel} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${
                      row.channel === 'Meta' ? 'bg-blue-50 text-blue-700' : 'bg-red-50 text-red-700'
                    }`}>
                      {row.channel}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <p className="text-gray-600">{fmtShort(row.impressions)}</p>
                    <DeltaBadge curr={row.impressions} prev={row.prevImpressions} />
                  </td>
                  <td className="px-4 py-4 text-right">
                    <p className="text-gray-600">{fmtN(row.clicks)}</p>
                    <DeltaBadge curr={row.clicks} prev={row.prevClicks} />
                  </td>
                  <td className="px-4 py-4 text-right">
                    <p className="text-gray-600">{fmtPct(ctr)}</p>
                    <DeltaBadge curr={ctr} prev={prevCtr} />
                  </td>
                  <td className="px-4 py-4 text-right">
                    <p className="font-semibold text-gray-800">{fmt$(row.spend)}</p>
                    <DeltaBadge curr={row.spend} prev={row.prevSpend} forceNeutral />
                  </td>
                  <td className="px-4 py-4 text-right">
                    <p className="text-gray-600">{cpc > 0 ? fmt$2(cpc) : '—'}</p>
                    {cpc > 0 && <DeltaBadge curr={cpc} prev={prevCpc} invert />}
                  </td>
                  <td className="px-4 py-4 text-right">
                    <p className="text-gray-600">{fmtN(row.purchases)}</p>
                    <DeltaBadge curr={row.purchases} prev={row.prevPurchases} />
                  </td>
                  <td className="px-4 py-4 text-right">
                    <p className="text-gray-600">{fmt$(row.revenue)}</p>
                    <DeltaBadge curr={row.revenue} prev={row.prevRevenue} />
                  </td>
                  <td className="px-4 py-4 text-right">
                    <p className="font-semibold text-gray-800">{roas > 0 ? fmtX(roas) : '—'}</p>
                    {roas > 0 && <DeltaBadge curr={roas} prev={prevRoas} />}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function GoodGameDashboardClient({ data }: { data: GoodGameDashboardData }) {
  const { summary, prevSummary, timeSeries, channelRows, campaignRows, metaCreatives } = data;
  const hasPurchases = summary.purchases > 0 || campaignRows.some(r => r.purchases > 0);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Good Game</h1>
        <p className="text-sm text-gray-500 mt-1">Meta + Google Performance · Good Game Energy by T-Pain</p>
      </div>

      <FilterBar />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 xl:grid-cols-8 gap-4">
        <KpiCard label="Impressions"  value={summary.impressions}     prev={prevSummary.impressions}     format={fmtShort} />
        <KpiCard label="Clicks"       value={summary.clicks}          prev={prevSummary.clicks}          format={fmtN} />
        <KpiCard label="CTR"          value={summary.ctr}             prev={prevSummary.ctr}             format={fmtPct} />
        <KpiCard label="Cost"         value={summary.spend}           prev={prevSummary.spend}           format={fmt$} forceNeutral />
        <KpiCard label="CPC"          value={summary.cpc}             prev={prevSummary.cpc}             format={fmt$2} invert />
        <KpiCard label="Purchases"    value={summary.purchases}       prev={prevSummary.purchases}       format={fmtN} />
        <KpiCard label="Revenue"      value={summary.revenue}         prev={prevSummary.revenue}         format={fmt$} />
        <KpiCard label="ROAS"         value={summary.roas}            prev={prevSummary.roas}            format={fmtX} highlight />
      </div>

      {/* Trend Chart */}
      {timeSeries.length > 1 && (
        <GoodGameTrendChart data={timeSeries} start={data.filterParams.start} end={data.filterParams.end} />
      )}

      {/* Channel Breakdown */}
      {channelRows.length > 0 && <ChannelTable rows={channelRows} />}

      {/* Campaign Performance */}
      {campaignRows.length > 0 && (
        <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-8 border-b border-gray-50">
            <h3 className="text-xl font-bold text-[#0f172a]">Campaign Performance</h3>
            <p className="text-sm text-gray-400 font-medium mt-1">Top campaigns by spend · Selected period</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Campaign</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Channel</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Spend</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Impressions</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Clicks</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">CTR</th>
                  {hasPurchases && (
                    <>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Purchases</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Revenue</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">ROAS</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {campaignRows.map((row, i) => (
                  <tr key={i} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-gray-900 max-w-xs truncate">{row.campaign}</td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${
                        row.channel === 'Meta' ? 'bg-blue-50 text-blue-700' : 'bg-red-50 text-red-700'
                      }`}>
                        {row.channel}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right font-semibold text-gray-700">{fmt$(row.spend)}</td>
                    <td className="px-4 py-4 text-right text-gray-500">{fmtShort(row.impressions)}</td>
                    <td className="px-4 py-4 text-right text-gray-500">{fmtN(row.clicks)}</td>
                    <td className="px-4 py-4 text-right text-gray-500">{fmtPct(row.ctr)}</td>
                    {hasPurchases && (
                      <>
                        <td className="px-4 py-4 text-right text-gray-500">{fmtN(row.purchases)}</td>
                        <td className="px-4 py-4 text-right text-gray-500">{fmt$(row.revenue)}</td>
                        <td className="px-4 py-4 text-right font-semibold text-gray-700">{fmtX(row.roas)}</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Meta Ad Creatives — shown when Meta is in scope */}
      {metaCreatives.length > 0 && (
        <MetaAdPreviews
          creatives={metaCreatives}
          title="Meta Ad Creatives"
          description="Ad-level performance · Video ads open in Facebook Ad Library"
          advertiserName="Good Game"
        />
      )}
    </div>
  );
}
