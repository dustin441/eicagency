'use client';

import React from 'react';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import type { ProductChannelKpiRow } from '@/services/spartaco-product-channel-kpis';
import { cn, fmtCompact, fmtCurrency, fmtNumber } from '@/lib/utils';

function formatValue(row: ProductChannelKpiRow, value: number | null, available: boolean): string {
  if (value === null) return available ? 'Not calculable' : 'Unavailable';
  if (row.format === 'currency') return fmtCurrency(value);
  if (row.format === 'compact') return fmtCompact(value);
  if (row.format === 'multiple') return `${value.toFixed(2)}x`;
  return fmtNumber(value);
}

function ChangeCell({ row }: { row: ProductChannelKpiRow }) {
  if (row.value === null || row.previousValue === null) {
    return <span className="text-xs font-semibold text-gray-400">Not comparable</span>;
  }
  if (row.previousValue === 0) {
    return row.value === 0
      ? <span className="text-xs font-semibold text-gray-400">No change</span>
      : <span className="text-xs font-bold text-blue-700">New</span>;
  }

  const change = ((row.value - row.previousValue) / Math.abs(row.previousValue)) * 100;
  if (Math.abs(change) < 0.5) {
    return <span className="text-xs font-semibold text-gray-400">No change</span>;
  }

  const increased = change > 0;
  return (
    <span className={cn(
      'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold',
      increased ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700',
    )}>
      {increased ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
      {Math.abs(change).toFixed(1)}%
    </span>
  );
}

export default function ProductChannelKpiTable({
  rows,
  currentLabel,
  previousLabel,
}: {
  rows: ProductChannelKpiRow[];
  currentLabel: string;
  previousLabel: string;
}) {
  return (
    <section className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm">
      <div className="border-b border-gray-100 px-6 py-5 sm:px-8 sm:py-6">
        <h2 className="text-xl font-bold text-brand-dark">Channel Primary KPIs</h2>
        <p className="mt-1 text-sm text-gray-500">
          One outcome-oriented KPI per marketing channel for the selected product and date range.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-left">
          <thead>
            <tr className="bg-slate-50/70">
              <th className="border-b border-gray-100 px-6 py-3 text-[10px] font-extrabold uppercase tracking-widest text-gray-400">Channel</th>
              <th className="border-b border-gray-100 px-5 py-3 text-[10px] font-extrabold uppercase tracking-widest text-gray-400">Primary KPI</th>
              <th className="border-b border-gray-100 px-5 py-3 text-right text-[10px] font-extrabold uppercase tracking-widest text-gray-400">{currentLabel}</th>
              <th className="border-b border-gray-100 px-5 py-3 text-right text-[10px] font-extrabold uppercase tracking-widest text-gray-400">{previousLabel}</th>
              <th className="border-b border-gray-100 px-6 py-3 text-right text-[10px] font-extrabold uppercase tracking-widest text-gray-400">Change</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {rows.map(row => (
              <tr key={row.channel} className="transition-colors hover:bg-gray-50/60">
                <td className="px-6 py-4">
                  <span className="font-bold text-brand-dark">{row.channel}</span>
                </td>
                <td className="px-5 py-4">
                  <div className="font-semibold text-brand-dark">{row.metric}</div>
                  <div className="mt-0.5 text-xs text-gray-400">{row.description}</div>
                </td>
                <td className="px-5 py-4 text-right font-black tabular-nums text-brand-dark">
                  <span className={cn((!row.available || row.value === null) && 'font-semibold text-gray-400')}>
                    {formatValue(row, row.value, row.available)}
                  </span>
                </td>
                <td className="px-5 py-4 text-right font-semibold tabular-nums text-gray-500">
                  {formatValue(row, row.previousValue, row.previousAvailable)}
                </td>
                <td className="px-6 py-4 text-right"><ChangeCell row={row} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="border-t border-gray-100 bg-slate-50/50 px-6 py-3 text-xs text-gray-500 sm:px-8">
        Product and channel values are directional attribution context. Source grains can overlap and should not be summed into brand totals.
      </div>
    </section>
  );
}
