'use client';

import React, { useState } from 'react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
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

// ─── Channel Cards ────────────────────────────────────────────────────────────

function ChannelCard({ row, hasPurchases }: { row: { channel: string; spend: number; prevSpend: number; impressions: number; prevImpressions: number; clicks: number; prevClicks: number; purchases: number; prevPurchases: number; revenue: number; prevRevenue: number }; hasPurchases: boolean }) {
  const isGoogle = row.channel === 'Google';
  const accentColor = isGoogle ? '#4285F4' : '#1877F2';

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${accentColor}18` }}>
            {isGoogle ? (
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill={accentColor}><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
            ) : (
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill={accentColor}><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
            )}
          </div>
          <h4 className="font-bold text-gray-900">{row.channel}</h4>
        </div>
        <span className="text-xl font-bold text-gray-900">{fmt$(row.spend)}</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-xs text-gray-400 font-medium">Impressions</p>
          <p className="text-base font-bold text-gray-800 mt-0.5">{fmtShort(row.impressions)}</p>
          <DeltaBadge curr={row.impressions} prev={row.prevImpressions} />
        </div>
        <div>
          <p className="text-xs text-gray-400 font-medium">Clicks</p>
          <p className="text-base font-bold text-gray-800 mt-0.5">{fmtN(row.clicks)}</p>
          <DeltaBadge curr={row.clicks} prev={row.prevClicks} />
        </div>
        {hasPurchases && row.purchases > 0 && (
          <>
            <div>
              <p className="text-xs text-gray-400 font-medium">Purchases</p>
              <p className="text-base font-bold text-gray-800 mt-0.5">{fmtN(row.purchases)}</p>
              <DeltaBadge curr={row.purchases} prev={row.prevPurchases} />
            </div>
            <div>
              <p className="text-xs text-gray-400 font-medium">Revenue</p>
              <p className="text-base font-bold text-gray-800 mt-0.5">{fmt$(row.revenue)}</p>
              <DeltaBadge curr={row.revenue} prev={row.prevRevenue} />
            </div>
          </>
        )}
        <div className="col-span-2">
          <p className="text-xs text-gray-400 font-medium">Spend trend</p>
          <DeltaBadge curr={row.spend} prev={row.prevSpend} invert />
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function GoodGameDashboardClient({ data }: { data: GoodGameDashboardData }) {
  const { summary, prevSummary, timeSeries, channelRows, campaignRows, metaCreatives } = data;
  const hasPurchases = summary.purchases > 0;

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
      {channelRows.length > 0 && (
        <div>
          <h2 className="text-lg font-bold text-gray-900 mb-4">Channel Breakdown</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {channelRows.map(row => (
              <ChannelCard key={row.channel} row={row} hasPurchases={hasPurchases} />
            ))}
          </div>
        </div>
      )}

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
