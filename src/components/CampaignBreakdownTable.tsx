'use client';

import React, { useState, useRef, useEffect } from 'react';
import { SlidersHorizontal, Check } from 'lucide-react';
import type { CampaignBreakdownRow } from '@/services/spartaco-product-analytics';
import { fmtNumber, fmtCurrency, fmtCompact } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface Props {
  rows: CampaignBreakdownRow[];
  previousRows: CampaignBreakdownRow[];
}

// ─── Column definitions (paid media only) ─────────────────────────────────────

type ColDef = {
  key: string;
  label: string;
  value: (row: CampaignBreakdownRow) => number;
  fmt: (v: number) => string;
  render?: (row: CampaignBreakdownRow) => React.ReactNode;
  inverted?: boolean;
  defaultHidden?: boolean;
};

const COLUMNS: ColDef[] = [
  { key: 'ad_impressions', label: 'Impressions', value: r => r.ad_impressions, fmt: fmtCompact, defaultHidden: true },
  { key: 'ad_clicks',      label: 'Clicks',      value: r => r.ad_clicks,      fmt: fmtNumber,  defaultHidden: true },
  { key: 'ad_cost',        label: 'Ad Spend',    value: r => r.ad_cost,        fmt: fmtCurrency, inverted: true },
  { key: 'ad_conversions', label: 'Leads',       value: r => r.ad_conversions, fmt: fmtNumber },
  {
    key: 'ad_cpl', label: 'CPL',
    value: r => r.ad_conversions > 0 ? r.ad_cost / r.ad_conversions : 0,
    fmt: fmtCurrency, inverted: true, defaultHidden: true,
  },
  { key: 'ad_purchases', label: 'Purchases', value: r => r.ad_purchases, fmt: fmtNumber },
  {
    key: 'ad_revenue', label: 'Revenue',
    value: r => r.ad_revenue, fmt: fmtCurrency,
    render: r => <span className="text-emerald-700 font-bold">{fmtCurrency(r.ad_revenue)}</span>,
  },
  {
    key: 'ad_roas', label: 'ROAS',
    value: r => r.ad_cost > 0 ? r.ad_revenue / r.ad_cost : 0,
    fmt: v => `${v.toFixed(2)}x`,
    render: r => {
      const roas = r.ad_cost > 0 ? r.ad_revenue / r.ad_cost : 0;
      return (
        <span className={cn('px-2 py-0.5 rounded-full text-xs font-bold', roas >= 2 ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-600')}>
          {roas.toFixed(2)}x
        </span>
      );
    },
  },
];

const SORT_KEY = 'ad_cost';

// ─── Sub-components ───────────────────────────────────────────────────────────

function DeltaBadge({ current, previous, inverted = false }: {
  current: number; previous: number; inverted?: boolean;
}) {
  if (!previous) return <span className="text-[10px] text-gray-300">—</span>;
  const pct = ((current - previous) / Math.abs(previous)) * 100;
  if (Math.abs(pct) < 0.5) return <span className="text-[10px] text-gray-300">—</span>;
  const isGood = inverted ? pct < 0 : pct > 0;
  return (
    <span className={cn('text-[10px] font-bold', isGood ? 'text-emerald-600' : 'text-rose-600')}>
      {pct > 0 ? '↑' : '↓'}{Math.abs(pct).toFixed(0)}%
    </span>
  );
}

function ColHeader({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-5 py-3 text-right text-[10px] uppercase tracking-widest font-extrabold text-gray-400 border-b border-gray-100 whitespace-nowrap">
      {children}
    </th>
  );
}

function ColPicker({
  cols, hidden, onToggle,
}: {
  cols: ColDef[]; hidden: Set<string>; onToggle: (key: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const hiddenCount = cols.filter(c => hidden.has(c.key)).length;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className={cn(
          'flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border transition-all',
          open || hiddenCount > 0
            ? 'bg-brand-dark text-white border-brand-dark'
            : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300 hover:text-gray-700'
        )}
      >
        <SlidersHorizontal className="w-3.5 h-3.5" />
        Columns
        {hiddenCount > 0 && (
          <span className="bg-white/20 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
            {cols.length - hiddenCount}/{cols.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 bg-white border border-gray-200 rounded-2xl shadow-xl p-3 z-30 w-52">
          <p className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest mb-2 px-1">
            Show / hide columns
          </p>
          {cols.map(col => {
            const visible = !hidden.has(col.key);
            return (
              <button
                key={col.key}
                onClick={() => onToggle(col.key)}
                className="flex items-center gap-2.5 w-full px-2 py-1.5 rounded-lg hover:bg-gray-50 text-left transition-colors"
              >
                <span className={cn(
                  'w-4 h-4 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all',
                  visible ? 'bg-brand-dark border-brand-dark' : 'border-gray-300'
                )}>
                  {visible && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
                </span>
                <span className="text-xs font-semibold text-gray-700">{col.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function CampaignBreakdownTable({ rows, previousRows }: Props) {
  const [hidden, setHidden] = useState<Set<string>>(
    () => new Set(COLUMNS.filter(c => c.defaultHidden).map(c => c.key)),
  );

  const prevMap = new Map(previousRows.map(r => [r.campaign, r]));

  const visibleCols = COLUMNS.filter(c => !hidden.has(c.key));
  const sortCol = COLUMNS.find(c => c.key === SORT_KEY);
  const sortedRows = [...rows].sort((a, b) => (sortCol ? sortCol.value(b) - sortCol.value(a) : 0));

  function toggleCol(key: string) {
    setHidden(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  return (
    <div className="bg-white border border-gray-100 rounded-3xl overflow-hidden shadow-sm">
      {/* Header */}
      <div className="px-8 py-6 border-b border-gray-100 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold text-brand-dark">Campaign Breakdown</h3>
          <p className="text-sm text-gray-500 mt-1">Paid media performance by campaign vs. comparison period</p>
        </div>
        <ColPicker cols={COLUMNS} hidden={hidden} onToggle={toggleCol} />
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/50">
              <th className="px-6 py-3 text-left text-[10px] uppercase tracking-widest font-extrabold text-gray-400 border-b border-gray-100 sticky left-0 bg-slate-50/50 z-10 w-[260px]">
                Campaign
              </th>
              {visibleCols.map(col => (
                <ColHeader key={col.key}>{col.label}</ColHeader>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {sortedRows.length === 0 && (
              <tr>
                <td colSpan={visibleCols.length + 1} className="px-6 py-10 text-center text-sm text-gray-400">
                  No campaign data for the selected period.
                </td>
              </tr>
            )}
            {sortedRows.map(row => {
              const prev = prevMap.get(row.campaign);
              return (
                <tr key={row.campaign} className="hover:bg-gray-50/50 transition-colors group">
                  <td className="px-6 py-4 sticky left-0 bg-white group-hover:bg-gray-50/50 z-10 border-r border-gray-50">
                    <div className="font-bold text-sm text-brand-dark">{row.campaign}</div>
                    <div className="text-[10px] font-medium text-gray-400 mt-0.5">{row.brand}</div>
                  </td>
                  {visibleCols.map(col => {
                    const current  = col.value(row);
                    const previous = prev ? col.value(prev) : 0;
                    const display  = col.render ? col.render(row) : col.fmt(current);
                    return (
                      <td key={col.key} className="px-5 py-4 text-right tabular-nums">
                        <div className="font-semibold text-brand-dark text-sm">{display}</div>
                        <div className="mt-0.5">
                          <DeltaBadge current={current} previous={previous} inverted={col.inverted} />
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
