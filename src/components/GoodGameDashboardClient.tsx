'use client';

import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { GoodGameDashboardData } from '@/services/goodgame-analytics';
import FilterBar from '@/components/FilterBar';
import { MetaAdPreviews } from '@/components/AdPreviews';

// ─── helpers ─────────────────────────────────────────────────────────────────

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

function delta(curr: number, prev: number) {
  if (prev === 0) return null;
  return ((curr - prev) / prev) * 100;
}

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
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">{label}</p>
        {highlight && <span className="text-[10px] font-bold text-brand-forest bg-brand-forest/10 px-2 py-0.5 rounded-full">North Star</span>}
      </div>
      <p className="text-2xl font-bold text-gray-900">{format(value)}</p>
      <DeltaBadge curr={value} prev={prev} invert={invert} />
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function GoodGameDashboardClient({ data }: { data: GoodGameDashboardData }) {
  const { summary, prevSummary, campaignRows, metaCreatives } = data;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Good Game</h1>
        <p className="text-sm text-gray-500 mt-1">Meta Ads Performance · Good Game by T-Pain</p>
      </div>

      <FilterBar />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4">
        <KpiCard label="Spend" value={summary.spend} prev={prevSummary.spend} format={fmt$} invert />
        <KpiCard label="Impressions" value={summary.impressions} prev={prevSummary.impressions} format={fmtN} />
        <KpiCard label="Clicks" value={summary.clicks} prev={prevSummary.clicks} format={fmtN} />
        <KpiCard label="CTR" value={summary.ctr} prev={prevSummary.ctr} format={fmtPct} />
        <KpiCard label="Purchases" value={summary.purchases} prev={prevSummary.purchases} format={fmtN} />
        <KpiCard label="Revenue" value={summary.revenue} prev={prevSummary.revenue} format={fmt$} />
        <KpiCard label="ROAS" value={summary.roas} prev={prevSummary.roas} format={fmtX} highlight />
      </div>

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
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Spend</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Impressions</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Clicks</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">CTR</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Purchases</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Revenue</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">ROAS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {campaignRows.map((row, i) => (
                  <tr key={i} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-gray-900 max-w-xs truncate">{row.campaign}</td>
                    <td className="px-4 py-4 text-right text-gray-700 font-semibold">{fmt$(row.spend)}</td>
                    <td className="px-4 py-4 text-right text-gray-500">{fmtN(row.impressions)}</td>
                    <td className="px-4 py-4 text-right text-gray-500">{fmtN(row.clicks)}</td>
                    <td className="px-4 py-4 text-right text-gray-500">{fmtPct(row.ctr)}</td>
                    <td className="px-4 py-4 text-right text-gray-500">{fmtN(row.purchases)}</td>
                    <td className="px-4 py-4 text-right text-gray-500">{fmt$(row.revenue)}</td>
                    <td className="px-4 py-4 text-right font-semibold text-gray-700">{fmtX(row.roas)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Meta Ad Creatives */}
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
