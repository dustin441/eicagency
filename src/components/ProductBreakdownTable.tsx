'use client';

import React, { useState } from 'react';
import type { ProductPerformanceRow } from '@/services/spartaco-product-analytics';
import { fmtNumber, fmtCurrency, fmtPercent } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface Props {
  rows: ProductPerformanceRow[];
  previousRows: ProductPerformanceRow[];
}

type TabId = 'paid' | 'web' | 'search' | 'social' | 'email';

const TABS: { id: TabId; label: string }[] = [
  { id: 'paid',   label: 'Paid Media' },
  { id: 'web',    label: 'Web Analytics' },
  { id: 'search', label: 'Search' },
  { id: 'social', label: 'Social' },
  { id: 'email',  label: 'Email' },
];

function delta(current: number, previous: number, lowerIsBetter = false) {
  if (!previous || previous === 0) return null;
  const pct = ((current - previous) / Math.abs(previous)) * 100;
  if (Math.abs(pct) < 0.5) return null;
  const isGood = lowerIsBetter ? pct < 0 : pct > 0;
  return { pct, isGood };
}

function DeltaBadge({ current, previous, lowerIsBetter = false }: { current: number; previous: number; lowerIsBetter?: boolean }) {
  const d = delta(current, previous, lowerIsBetter);
  if (d === null) return <span className="text-[10px] text-gray-300">—</span>;
  return (
    <span className={cn('text-[10px] font-bold', d.isGood ? 'text-emerald-600' : 'text-rose-600')}>
      {d.pct > 0 ? '↑' : '↓'}{Math.abs(d.pct).toFixed(0)}%
    </span>
  );
}

function Cell({ main, prev, lowerIsBetter = false }: { main: React.ReactNode; prev?: React.ReactNode; lowerIsBetter?: boolean }) {
  return (
    <td className="px-5 py-4 text-right tabular-nums">
      <div className="font-semibold text-brand-dark text-sm">{main}</div>
      {prev !== undefined && <div className="mt-0.5">{prev}</div>}
    </td>
  );
}

function ColHeader({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-5 py-3 text-right text-[10px] uppercase tracking-widest font-extrabold text-gray-400 border-b border-gray-100">
      {children}
    </th>
  );
}

export default function ProductBreakdownTable({ rows, previousRows }: Props) {
  const [activeTab, setActiveTab] = useState<TabId>('paid');

  const prevMap = new Map(previousRows.map(r => [r.product, r]));

  const sortedRows = [...rows].sort((a, b) => {
    if (activeTab === 'paid')   return b.ad_cost - a.ad_cost;
    if (activeTab === 'web')    return b.ga4_sessions - a.ga4_sessions;
    if (activeTab === 'search') return b.gsc_clicks - a.gsc_clicks;
    if (activeTab === 'social') return b.social_engagement - a.social_engagement;
    if (activeTab === 'email')  return b.email_opens - a.email_opens;
    return 0;
  });

  return (
    <div className="bg-white border border-gray-100 rounded-3xl overflow-hidden shadow-sm">
      {/* Header */}
      <div className="px-8 py-6 border-b border-gray-100 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold text-brand-dark">Product Breakdown</h3>
          <p className="text-sm text-gray-500 mt-1">Cross-channel performance by product line vs. comparison period</p>
        </div>
        <div className="flex gap-1 bg-gray-50 rounded-xl p-1 border border-gray-100">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'px-3 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap',
                activeTab === tab.id
                  ? 'bg-white text-brand-dark shadow-sm border border-gray-100'
                  : 'text-gray-500 hover:text-gray-700'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/50">
              <th className="px-6 py-3 text-left text-[10px] uppercase tracking-widest font-extrabold text-gray-400 border-b border-gray-100 sticky left-0 bg-slate-50/50 z-10 w-[200px]">
                Product
              </th>

              {activeTab === 'paid' && <>
                <ColHeader>Spend</ColHeader>
                <ColHeader>Revenue</ColHeader>
                <ColHeader>ROAS</ColHeader>
                <ColHeader>Purchases</ColHeader>
              </>}

              {activeTab === 'web' && <>
                <ColHeader>Sessions</ColHeader>
                <ColHeader>Eng. Rate</ColHeader>
                <ColHeader>Purchases</ColHeader>
                <ColHeader>Revenue</ColHeader>
              </>}

              {activeTab === 'search' && <>
                <ColHeader>GSC Clicks</ColHeader>
                <ColHeader>GSC Impressions</ColHeader>
              </>}

              {activeTab === 'social' && <>
                <ColHeader>Impressions</ColHeader>
                <ColHeader>Engagement</ColHeader>
                <ColHeader>Interactions</ColHeader>
              </>}

              {activeTab === 'email' && <>
                <ColHeader>Sent</ColHeader>
                <ColHeader>Opens</ColHeader>
                <ColHeader>Clicks</ColHeader>
                <ColHeader>Open Rate</ColHeader>
              </>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {sortedRows.map(row => {
              const prev = prevMap.get(row.product);

              const roas     = row.ad_cost > 0 ? row.ad_revenue / row.ad_cost : 0;
              const prevRoas = prev && prev.ad_cost > 0 ? prev.ad_revenue / prev.ad_cost : 0;

              const engRate     = row.ga4_sessions > 0 ? row.ga4_engaged_sessions / row.ga4_sessions : 0;
              const prevEngRate = prev && prev.ga4_sessions > 0 ? prev.ga4_engaged_sessions / prev.ga4_sessions : 0;

              const openRate     = row.email_total_sent > 0 ? row.email_opens / row.email_total_sent : 0;
              const prevOpenRate = prev && prev.email_total_sent > 0 ? prev.email_opens / prev.email_total_sent : 0;

              return (
                <tr key={row.product} className="hover:bg-gray-50/50 transition-colors group">
                  <td className="px-6 py-4 font-bold text-sm text-brand-dark sticky left-0 bg-white group-hover:bg-gray-50/50 z-10 border-r border-gray-50">
                    <div>{row.product}</div>
                    <div className="text-[10px] font-medium text-gray-400 mt-0.5">{row.brand}</div>
                  </td>

                  {activeTab === 'paid' && <>
                    <Cell
                      main={fmtCurrency(row.ad_cost)}
                      prev={<DeltaBadge current={row.ad_cost} previous={prev?.ad_cost ?? 0} lowerIsBetter />}
                    />
                    <Cell
                      main={<span className="text-emerald-700 font-bold">{fmtCurrency(row.ad_revenue)}</span>}
                      prev={<DeltaBadge current={row.ad_revenue} previous={prev?.ad_revenue ?? 0} />}
                    />
                    <Cell
                      main={
                        <span className={cn('px-2 py-0.5 rounded-full text-xs font-bold', roas >= 2 ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-600')}>
                          {roas.toFixed(2)}x
                        </span>
                      }
                      prev={<DeltaBadge current={roas} previous={prevRoas} />}
                    />
                    <Cell
                      main={fmtNumber(row.ad_purchases)}
                      prev={<DeltaBadge current={row.ad_purchases} previous={prev?.ad_purchases ?? 0} />}
                    />
                  </>}

                  {activeTab === 'web' && <>
                    <Cell
                      main={<span className="text-blue-900">{fmtNumber(row.ga4_sessions)}</span>}
                      prev={<DeltaBadge current={row.ga4_sessions} previous={prev?.ga4_sessions ?? 0} />}
                    />
                    <Cell
                      main={fmtPercent(engRate)}
                      prev={<DeltaBadge current={engRate} previous={prevEngRate} />}
                    />
                    <Cell
                      main={fmtNumber(row.ga4_purchases)}
                      prev={<DeltaBadge current={row.ga4_purchases} previous={prev?.ga4_purchases ?? 0} />}
                    />
                    <Cell
                      main={<span className="text-emerald-700">{fmtCurrency(row.ga4_total_revenue)}</span>}
                      prev={<DeltaBadge current={row.ga4_total_revenue} previous={prev?.ga4_total_revenue ?? 0} />}
                    />
                  </>}

                  {activeTab === 'search' && <>
                    <Cell
                      main={<span className="text-orange-700">{fmtNumber(row.gsc_clicks)}</span>}
                      prev={<DeltaBadge current={row.gsc_clicks} previous={prev?.gsc_clicks ?? 0} />}
                    />
                    <Cell
                      main={fmtNumber(row.gsc_impressions)}
                      prev={<DeltaBadge current={row.gsc_impressions} previous={prev?.gsc_impressions ?? 0} />}
                    />
                  </>}

                  {activeTab === 'social' && <>
                    <Cell
                      main={fmtNumber(row.social_impressions)}
                      prev={<DeltaBadge current={row.social_impressions} previous={prev?.social_impressions ?? 0} />}
                    />
                    <Cell
                      main={<span className="text-purple-700">{fmtNumber(row.social_engagement)}</span>}
                      prev={<DeltaBadge current={row.social_engagement} previous={prev?.social_engagement ?? 0} />}
                    />
                    <Cell
                      main={fmtNumber(row.social_interactions)}
                      prev={<DeltaBadge current={row.social_interactions} previous={prev?.social_interactions ?? 0} />}
                    />
                  </>}

                  {activeTab === 'email' && <>
                    <Cell
                      main={fmtNumber(row.email_total_sent)}
                      prev={<DeltaBadge current={row.email_total_sent} previous={prev?.email_total_sent ?? 0} />}
                    />
                    <Cell
                      main={<span className="text-indigo-700">{fmtNumber(row.email_opens)}</span>}
                      prev={<DeltaBadge current={row.email_opens} previous={prev?.email_opens ?? 0} />}
                    />
                    <Cell
                      main={fmtNumber(row.email_clicks)}
                      prev={<DeltaBadge current={row.email_clicks} previous={prev?.email_clicks ?? 0} />}
                    />
                    <Cell
                      main={fmtPercent(openRate)}
                      prev={<DeltaBadge current={openRate} previous={prevOpenRate} />}
                    />
                  </>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
