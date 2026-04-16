'use client';

import React, { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import type { TrafficBreakdownRow } from '@/services/spartaco-product-analytics';
import { fmtNumber, fmtCurrency, fmtPercent } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface Props {
  channelGroupRows: TrafficBreakdownRow[];
  sourceMediumRows: TrafficBreakdownRow[];
}

type TabId = 'channel' | 'source';

function DeltaBadge({ current, previous }: { current: number; previous: number }) {
  if (!previous) return <span className="text-[10px] text-gray-300">—</span>;
  const pct = ((current - previous) / Math.abs(previous)) * 100;
  if (Math.abs(pct) < 0.5) return <span className="text-[10px] text-gray-300">—</span>;
  const isGood = pct > 0;
  return (
    <span className={cn('text-[10px] font-bold', isGood ? 'text-emerald-600' : 'text-rose-600')}>
      {pct > 0 ? '↑' : '↓'}{Math.abs(pct).toFixed(0)}%
    </span>
  );
}

function MetricCell({ value, prev }: { value: React.ReactNode; prev: React.ReactNode }) {
  return (
    <td className="px-5 py-4 text-right tabular-nums">
      <div className="font-semibold text-brand-dark text-sm">{value}</div>
      <div className="mt-0.5">{prev}</div>
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

export default function TrafficBreakdownTable({ channelGroupRows, sourceMediumRows }: Props) {
  const [activeTab, setActiveTab] = useState<TabId>('channel');
  const searchParams = useSearchParams();

  const selectedChannelGroup = searchParams.get('channel_group') ?? 'all';
  const selectedSourceMedium = searchParams.get('source_medium') ?? 'all';

  // Apply filters client-side: channel_group filters source/medium rows;
  // source_medium narrows to a single row on the source tab.
  const filteredSourceRows = sourceMediumRows.filter(r => {
    const key = `${r.label} / ${r.sublabel ?? ''}`;
    if (selectedSourceMedium !== 'all' && key !== selectedSourceMedium) return false;
    if (selectedChannelGroup !== 'all' && r.channelGroup !== selectedChannelGroup) return false;
    return true;
  });

  const rows = activeTab === 'channel' ? channelGroupRows : filteredSourceRows;

  const TABS: { id: TabId; label: string }[] = [
    { id: 'channel', label: 'Channel Group' },
    { id: 'source',  label: 'Source / Medium' },
  ];

  return (
    <div className="bg-white border border-gray-100 rounded-3xl overflow-hidden shadow-sm">
      <div className="px-8 py-6 border-b border-gray-100 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold text-brand-dark">Traffic Attribution</h3>
          <p className="text-sm text-gray-500 mt-1">GA4 web traffic performance by channel group and source / medium</p>
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
              <th className="px-6 py-3 text-left text-[10px] uppercase tracking-widest font-extrabold text-gray-400 border-b border-gray-100 sticky left-0 bg-slate-50/50 z-10 w-[220px]">
                {activeTab === 'channel' ? 'Channel Group' : 'Source / Medium'}
              </th>
              <ColHeader>Sessions</ColHeader>
              <ColHeader>Eng. Rate</ColHeader>
              <ColHeader>Add to Cart</ColHeader>
              <ColHeader>Purchases</ColHeader>
              <ColHeader>Revenue</ColHeader>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-10 text-center text-sm text-gray-400">
                  No data for the selected filters.
                </td>
              </tr>
            )}
            {rows.map((row, i) => {
              const engRate     = row.ga4_sessions     > 0 ? row.ga4_engaged_sessions / row.ga4_sessions     : 0;
              const prevEngRate = row.prev_sessions > 0 ? row.prev_engaged           / row.prev_sessions : 0;

              return (
                <tr key={i} className="hover:bg-gray-50/50 transition-colors group">
                  <td className="px-6 py-4 sticky left-0 bg-white group-hover:bg-gray-50/50 z-10 border-r border-gray-50">
                    <div className="font-bold text-sm text-brand-dark">{row.label}</div>
                    {row.sublabel && (
                      <div className="text-[11px] text-gray-400 font-medium mt-0.5">{row.sublabel}</div>
                    )}
                    {activeTab === 'source' && row.channelGroup && (
                      <div className="mt-1">
                        <span className="text-[10px] font-semibold bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                          {row.channelGroup}
                        </span>
                      </div>
                    )}
                  </td>

                  <MetricCell
                    value={<span className="text-blue-900">{fmtNumber(row.ga4_sessions)}</span>}
                    prev={<DeltaBadge current={row.ga4_sessions} previous={row.prev_sessions} />}
                  />
                  <MetricCell
                    value={fmtPercent(engRate)}
                    prev={<DeltaBadge current={engRate} previous={prevEngRate} />}
                  />
                  <MetricCell
                    value={fmtNumber(row.ga4_add_to_carts)}
                    prev={<DeltaBadge current={row.ga4_add_to_carts} previous={row.prev_carts} />}
                  />
                  <MetricCell
                    value={fmtNumber(row.ga4_purchases)}
                    prev={<DeltaBadge current={row.ga4_purchases} previous={row.prev_purchases} />}
                  />
                  <MetricCell
                    value={<span className="text-emerald-700 font-bold">{fmtCurrency(row.ga4_total_revenue)}</span>}
                    prev={<DeltaBadge current={row.ga4_total_revenue} previous={row.prev_revenue} />}
                  />
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
