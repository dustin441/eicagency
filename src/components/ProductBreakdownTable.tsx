'use client';

import React, { useState, useRef, useEffect } from 'react';
import { SlidersHorizontal, Check } from 'lucide-react';
import type { ProductPerformanceRow } from '@/services/spartaco-product-analytics';
import { fmtNumber, fmtCurrency, fmtPercent, fmtCompact } from '@/lib/utils';
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

// ─── Column definitions ───────────────────────────────────────────────────────

type ColDef = {
  key: string;
  label: string;
  /** Raw numeric value for delta calculation */
  value: (row: ProductPerformanceRow) => number;
  /** Display-formatted value */
  fmt: (v: number) => string;
  /** Render override — if provided, used instead of fmt(value) */
  render?: (row: ProductPerformanceRow) => React.ReactNode;
  inverted?: boolean;
  /** Whether this column is hidden by default */
  defaultHidden?: boolean;
};

const paid: ColDef[] = [
  {
    key: 'ad_impressions', label: 'Impressions',
    value: r => r.ad_impressions, fmt: fmtCompact,
    defaultHidden: true,
  },
  {
    key: 'ad_clicks', label: 'Clicks',
    value: r => r.ad_clicks, fmt: fmtNumber,
    defaultHidden: true,
  },
  {
    key: 'ad_cost', label: 'Ad Spend',
    value: r => r.ad_cost, fmt: fmtCurrency, inverted: true,
  },
  {
    key: 'ad_conversions', label: 'Leads',
    value: r => r.ad_conversions, fmt: fmtNumber,
  },
  {
    key: 'ad_cpl', label: 'CPL',
    value: r => r.ad_conversions > 0 ? r.ad_cost / r.ad_conversions : 0,
    fmt: fmtCurrency, inverted: true,
    defaultHidden: true,
  },
  {
    key: 'ad_purchases', label: 'Purchases',
    value: r => r.ad_purchases, fmt: fmtNumber,
  },
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

const web: ColDef[] = [
  {
    key: 'ga4_sessions', label: 'Sessions',
    value: r => r.ga4_sessions, fmt: fmtNumber,
    render: r => <span className="text-blue-900">{fmtNumber(r.ga4_sessions)}</span>,
  },
  {
    key: 'ga4_engaged_sessions', label: 'Engaged Sessions',
    value: r => r.ga4_engaged_sessions, fmt: fmtNumber,
  },
  {
    key: 'ga4_purchases', label: 'Purchases',
    value: r => r.ga4_purchases, fmt: fmtNumber,
  },
  {
    key: 'ga4_total_revenue', label: 'Revenue',
    value: r => r.ga4_total_revenue, fmt: fmtCurrency,
    render: r => <span className="text-emerald-700">{fmtCurrency(r.ga4_total_revenue)}</span>,
  },
  {
    key: 'ga4_add_to_carts', label: 'Add to Cart',
    value: r => r.ga4_add_to_carts, fmt: fmtNumber,
    defaultHidden: true,
  },
  {
    key: 'ga4_checkouts', label: 'Checkouts',
    value: r => r.ga4_checkouts, fmt: fmtNumber,
    defaultHidden: true,
  },
];

const search: ColDef[] = [
  {
    key: 'gsc_clicks', label: 'Clicks',
    value: r => r.gsc_clicks, fmt: fmtNumber,
    render: r => <span className="text-orange-700">{fmtNumber(r.gsc_clicks)}</span>,
  },
  {
    key: 'gsc_impressions', label: 'Impressions',
    value: r => r.gsc_impressions, fmt: fmtCompact,
  },
  {
    key: 'gsc_ctr', label: 'CTR',
    value: r => r.gsc_impressions > 0 ? r.gsc_clicks / r.gsc_impressions : 0,
    fmt: fmtPercent,
  },
  {
    key: 'gsc_avg_position', label: 'Avg Position',
    value: r => r.gsc_avg_position, fmt: v => v > 0 ? v.toFixed(1) : '—',
    inverted: true,
  },
  {
    key: 'gsc_keywords_ranked', label: 'Keywords',
    value: r => r.gsc_keywords_ranked, fmt: fmtNumber,
    defaultHidden: true,
  },
];

const social: ColDef[] = [
  {
    key: 'social_post_count', label: 'Posts',
    value: r => r.social_post_count, fmt: fmtNumber,
  },
  {
    key: 'social_impressions', label: 'Impressions',
    value: r => r.social_impressions, fmt: fmtCompact,
  },
  {
    key: 'social_interactions', label: 'Interactions',
    value: r => r.social_interactions, fmt: fmtNumber,
    defaultHidden: true,
  },
  {
    key: 'social_engagement_rate', label: 'Eng. Rate',
    value: r => r.social_impressions > 0 ? r.social_interactions / r.social_impressions : 0,
    fmt: fmtPercent,
  },
];

const email: ColDef[] = [
  {
    key: 'email_total_sent', label: 'Total Sent',
    value: r => r.email_total_sent, fmt: fmtNumber,
  },
  {
    key: 'email_opens', label: 'Opens',
    value: r => r.email_opens, fmt: fmtNumber,
    render: r => <span className="text-indigo-700">{fmtNumber(r.email_opens)}</span>,
    defaultHidden: true,
  },
  {
    key: 'email_open_rate', label: 'Open Rate',
    value: r => r.email_total_sent > 0 ? r.email_opens / r.email_total_sent : 0,
    fmt: fmtPercent,
  },
  {
    key: 'email_clicks', label: 'Clicks',
    value: r => r.email_clicks, fmt: fmtNumber,
    defaultHidden: true,
  },
  {
    key: 'email_click_rate', label: 'Click Rate',
    value: r => r.email_total_sent > 0 ? r.email_clicks / r.email_total_sent : 0,
    fmt: fmtPercent,
  },
];

const TAB_COLUMNS: Record<TabId, ColDef[]> = { paid, web, search, social, email };

const SORT_KEY: Record<TabId, string> = {
  paid:   'ad_cost',
  web:    'ga4_sessions',
  search: 'gsc_clicks',
  social: 'social_interactions',
  email:  'email_opens',
};

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

// ─── Column picker popover ─────────────────────────────────────────────────────

function ColPicker({
  cols,
  hidden,
  onToggle,
}: {
  cols: ColDef[];
  hidden: Set<string>;
  onToggle: (key: string) => void;
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

export default function ProductBreakdownTable({ rows, previousRows }: Props) {
  const [activeTab, setActiveTab] = useState<TabId>('paid');

  // Per-tab hidden column state, initialized from defaultHidden
  const [hiddenPerTab, setHiddenPerTab] = useState<Record<TabId, Set<string>>>(() => {
    const init = {} as Record<TabId, Set<string>>;
    for (const tabId of Object.keys(TAB_COLUMNS) as TabId[]) {
      init[tabId] = new Set(TAB_COLUMNS[tabId].filter(c => c.defaultHidden).map(c => c.key));
    }
    return init;
  });

  const prevMap = new Map(previousRows.map(r => [r.product, r]));

  const allCols   = TAB_COLUMNS[activeTab];
  const hidden    = hiddenPerTab[activeTab];
  const visibleCols = allCols.filter(c => !hidden.has(c.key));

  const sortKey = SORT_KEY[activeTab];
  const sortCol = allCols.find(c => c.key === sortKey);

  const sortedRows = [...rows].sort((a, b) => {
    if (!sortCol) return 0;
    return sortCol.value(b) - sortCol.value(a);
  });

  function toggleCol(key: string) {
    setHiddenPerTab(prev => {
      const next = new Set(prev[activeTab]);
      next.has(key) ? next.delete(key) : next.add(key);
      return { ...prev, [activeTab]: next };
    });
  }

  return (
    <div className="bg-white border border-gray-100 rounded-3xl overflow-hidden shadow-sm">
      {/* Header */}
      <div className="px-8 py-6 border-b border-gray-100 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold text-brand-dark">Product Breakdown</h3>
          <p className="text-sm text-gray-500 mt-1">Cross-channel performance by product line vs. comparison period</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
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
          <ColPicker cols={allCols} hidden={hidden} onToggle={toggleCol} />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/50">
              <th className="px-6 py-3 text-left text-[10px] uppercase tracking-widest font-extrabold text-gray-400 border-b border-gray-100 sticky left-0 bg-slate-50/50 z-10 w-[200px]">
                Product
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
                  No data for the selected filters.
                </td>
              </tr>
            )}
            {sortedRows.map(row => {
              const prev = prevMap.get(row.product);
              return (
                <tr key={row.product} className="hover:bg-gray-50/50 transition-colors group">
                  <td className="px-6 py-4 sticky left-0 bg-white group-hover:bg-gray-50/50 z-10 border-r border-gray-50">
                    <div className="font-bold text-sm text-brand-dark">{row.product}</div>
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
