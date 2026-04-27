'use client';

import React, { useState } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
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

function DeltaBadge({ curr, prev, invert = false }: { curr: number; prev: number; invert?: boolean }) {
  const d = delta(curr, prev);
  if (d === null) return null;
  const positive = invert ? d < 0 : d > 0;
  const neutral = Math.abs(d) < 0.5;
  const str = (d >= 0 ? '+' : '') + d.toFixed(1) + '%';
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-semibold px-1.5 py-0.5 rounded-full ${
      neutral ? 'bg-gray-100 text-gray-500' :
      positive ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'
    }`}>
      {neutral ? <Minus size={10} /> : positive ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
      {str}
    </span>
  );
}

function KpiCard({
  label, value, prev, format, invert = false, highlight = false,
}: {
  label: string; value: number; prev: number;
  format: (n: number) => string; invert?: boolean; highlight?: boolean;
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
      <DeltaBadge curr={value} prev={prev} invert={invert} />
    </div>
  );
}

// ─── Trend Chart ──────────────────────────────────────────────────────────────

type Metric = 'spend' | 'purchases' | 'revenue' | 'clicks' | 'impressions';

const METRIC_CONFIG: Record<Metric, { label: string; color: string; format: (n: number) => string }> = {
  spend:       { label: 'Spend',       color: '#0B4A31', format: (n) => fmt$(n) },
  purchases:   { label: 'Purchases',   color: '#EB541E', format: (n) => fmtN(n) },
  revenue:     { label: 'Revenue',     color: '#10b981', format: (n) => fmt$(n) },
  clicks:      { label: 'Clicks',      color: '#6366f1', format: (n) => fmtN(n) },
  impressions: { label: 'Impressions', color: '#f59e0b', format: (n) => fmtShort(n) },
};

function TrendChart({ data }: { data: GoodGameTimePoint[] }) {
  const [activeMetric, setActiveMetric] = useState<Metric>('spend');

  const cfg = METRIC_CONFIG[activeMetric];

  return (
    <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
      <div className="p-8 border-b border-gray-50 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold text-[#0f172a]">Performance Over Time</h3>
          <p className="text-sm text-gray-400 font-medium mt-1">Daily trend · Selected period</p>
        </div>
        <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1 flex-wrap">
          {(Object.keys(METRIC_CONFIG) as Metric[]).map(m => (
            <button
              key={m}
              onClick={() => setActiveMetric(m)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeMetric === m ? 'bg-white text-[#0f172a] shadow-sm' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              {METRIC_CONFIG[m].label}
            </button>
          ))}
        </div>
      </div>
      <div className="p-6">
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <defs>
              <linearGradient id="gg-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={cfg.color} stopOpacity={0.15} />
                <stop offset="95%" stopColor={cfg.color} stopOpacity={0.01} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: '#94a3b8' }}
              tickFormatter={v => v.slice(5)}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: '#94a3b8' }}
              tickFormatter={cfg.format}
              tickLine={false}
              axisLine={false}
              width={65}
            />
            <Tooltip
              formatter={(v) => [cfg.format(Number(v ?? 0)), cfg.label]}
              labelFormatter={v => `Date: ${v}`}
              contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }}
            />
            <Area
              type="monotone"
              dataKey={activeMetric}
              stroke={cfg.color}
              strokeWidth={2.5}
              fill="url(#gg-grad)"
              dot={false}
              activeDot={{ r: 5 }}
            />
          </AreaChart>
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
              const cpc = row.clicks > 0 ? row.spend / row.clicks : 0;
              const roas = row.spend > 0 ? row.revenue / row.spend : 0;
              return (
                <tr key={row.channel} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${
                      row.channel === 'Meta' ? 'bg-blue-50 text-blue-700' : 'bg-red-50 text-red-700'
                    }`}>
                      {row.channel}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-right text-gray-600">{fmtShort(row.impressions)}</td>
                  <td className="px-4 py-4 text-right text-gray-600">{fmtN(row.clicks)}</td>
                  <td className="px-4 py-4 text-right text-gray-600">{fmtPct(ctr)}</td>
                  <td className="px-4 py-4 text-right font-semibold text-gray-800">{fmt$(row.spend)}</td>
                  <td className="px-4 py-4 text-right text-gray-600">{cpc > 0 ? fmt$(cpc) : '—'}</td>
                  <td className="px-4 py-4 text-right text-gray-600">{fmtN(row.purchases)}</td>
                  <td className="px-4 py-4 text-right text-gray-600">{fmt$(row.revenue)}</td>
                  <td className="px-4 py-4 text-right font-semibold text-gray-800">{roas > 0 ? fmtX(roas) : '—'}</td>
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
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4">
        <KpiCard label="Spend"        value={summary.spend}           prev={prevSummary.spend}           format={fmt$}   invert />
        <KpiCard label="Impressions"  value={summary.impressions}     prev={prevSummary.impressions}     format={fmtShort} />
        <KpiCard label="Clicks"       value={summary.clicks}          prev={prevSummary.clicks}          format={fmtN} />
        <KpiCard label="CTR"          value={summary.ctr}             prev={prevSummary.ctr}             format={fmtPct} />
        <KpiCard label="Purchases"    value={summary.purchases}       prev={prevSummary.purchases}       format={fmtN} />
        <KpiCard label="Revenue"      value={summary.revenue}         prev={prevSummary.revenue}         format={fmt$} />
        <KpiCard label="ROAS"         value={summary.roas}            prev={prevSummary.roas}            format={fmtX} highlight />
      </div>

      {/* Trend Chart */}
      {timeSeries.length > 1 && <TrendChart data={timeSeries} />}

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
