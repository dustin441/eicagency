'use client';

import React from 'react';
import { createPortal } from 'react-dom';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
  getSortedRowModel,
  SortingState,
  VisibilityState,
} from '@tanstack/react-table';
import { ArrowUpDown, ArrowUpRight, ArrowDownRight, SlidersHorizontal, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ChannelRow } from '@/services/analytics';

interface ChannelTableProps {
  initialChannels: ChannelRow[];
  firstColumnLabel?: string;
  title?: string;
  subtitle?: string;
  // PrePass ABM: append one column per fleet-size band (leads + attributed cost/lead)
  fleetBands?: string[];
  // Show column visibility selector (for Product Performance table)
  showColumnSelector?: boolean;
}

// Columns hidden by default when showColumnSelector is true
const PRODUCT_DEFAULT_HIDDEN: VisibilityState = {
  impressions: false,
  sqls:        false,
  cpsql:       false,
  won:         false,
  cpwon:       false,
};

const COLUMN_LABELS: Record<string, string> = {
  impressions: 'Impressions',
  clicks:      'Clicks',
  ctr:         'CTR',
  spend:       'Spend',
  cpc:         'CPC',
  leads:       'Leads',
  cpl:         'Cost/Lead',
  mqls:        'MQLs',
  cpmql:       'Cost/MQL',
  sqls:        'SQLs',
  cpsql:       'Cost/SQL',
  won:         'Won',
  cpwon:       'Cost/Won ★',
};

// ─── Formatters ───────────────────────────────────────────────────────────────

function fmtImpr(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  return String(Math.round(n));
}

function fmtMoney(n: number) {
  return `$${Math.round(n).toLocaleString()}`;
}

function fmtMoneyPrecise(n: number) {
  return `$${n.toFixed(2)}`;
}

// ─── Delta badge ─────────────────────────────────────────────────────────────
// invertColors = true means lower is better (cost metrics)

function DeltaBadge({ curr, prev, invertColors = false }: { curr: number; prev: number; invertColors?: boolean }) {
  if (curr === 0 && prev === 0) return null;
  if (prev === 0) return <span className="text-[10px] font-semibold text-gray-300 mt-0.5">new</span>;
  const pctChange = ((curr - prev) / prev) * 100;
  const isUp   = pctChange >= 0;
  const isGood = invertColors ? !isUp : isUp;
  return (
    <div className={cn(
      'inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full mt-1',
      isGood ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600',
    )}>
      {isUp ? <ArrowUpRight className="w-2.5 h-2.5" /> : <ArrowDownRight className="w-2.5 h-2.5" />}
      {Math.abs(pctChange).toFixed(1)}%
    </div>
  );
}

// ─── Sort header ─────────────────────────────────────────────────────────────

function SortHeader({ label, column, isNorthStar }: {
  label: string;
  column: { toggleSorting: (asc: boolean) => void; getIsSorted: () => false | 'asc' | 'desc' };
  isNorthStar?: boolean;
}) {
  return (
    <button
      onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
      className={cn(
        'flex items-center gap-1 transition-colors whitespace-nowrap',
        isNorthStar ? 'text-brand-forest hover:text-brand-orange' : 'hover:text-brand-orange',
      )}
    >
      {label} <ArrowUpDown className="w-3 h-3 shrink-0" />
    </button>
  );
}

// ─── Column definitions ───────────────────────────────────────────────────────

const columnHelper = createColumnHelper<ChannelRow>();

function buildColumns(firstColumnLabel: string, fleetBands?: string[]) {
  const fleetColumns = (fleetBands ?? []).map(band =>
    columnHelper.accessor(row => row.fleet?.[band]?.leads ?? 0, {
      id: `fleet_${band}`,
      header: ({ column }) => <SortHeader label={band} column={column} />,
      cell: info => {
        const f = info.row.original.fleet?.[band];
        const leads = f?.leads ?? 0;
        if (!f || leads === 0) return <span className="text-gray-300 text-sm">—</span>;
        return (
          <div className="flex flex-col items-start">
            <span className="font-bold text-brand-dark tabular-nums">{leads.toLocaleString()}</span>
            <span className="text-[10px] text-gray-400 tabular-nums mt-0.5">
              {f.cost > 0 ? `${fmtMoney(f.cost)}/lead` : '—'}
            </span>
          </div>
        );
      },
    }),
  );
  return [
  columnHelper.accessor('name', {
    header: ({ column }) => <SortHeader label={firstColumnLabel} column={column} />,
    cell: info => (
      <span className="font-bold text-brand-dark whitespace-nowrap">{info.getValue()}</span>
    ),
  }),
  columnHelper.accessor('impressions', {
    header: ({ column }) => <SortHeader label="Impressions" column={column} />,
    cell: info => (
      <div className="flex flex-col items-start">
        <span className="font-medium tabular-nums">{fmtImpr(info.getValue())}</span>
        <DeltaBadge curr={info.getValue()} prev={info.row.original.prevImpressions} />
      </div>
    ),
  }),
  columnHelper.accessor('clicks', {
    header: ({ column }) => <SortHeader label="Clicks" column={column} />,
    cell: info => (
      <div className="flex flex-col items-start">
        <span className="font-medium tabular-nums">{Math.round(info.getValue()).toLocaleString()}</span>
        <DeltaBadge curr={info.getValue()} prev={info.row.original.prevClicks} />
      </div>
    ),
  }),
  columnHelper.accessor(row => row.impressions > 0 ? (row.clicks / row.impressions) * 100 : 0, {
    id: 'ctr',
    header: ({ column }) => <SortHeader label="CTR" column={column} />,
    cell: info => {
      const r = info.row.original;
      const curr = r.impressions > 0 ? (r.clicks / r.impressions) * 100 : 0;
      const prev = r.prevImpressions > 0 ? (r.prevClicks / r.prevImpressions) * 100 : 0;
      return (
        <div className="flex flex-col items-start">
          <span className="font-medium tabular-nums">{curr.toFixed(2)}%</span>
          <DeltaBadge curr={curr} prev={prev} />
        </div>
      );
    },
  }),
  columnHelper.accessor('spend', {
    header: ({ column }) => <SortHeader label="Spend" column={column} />,
    cell: info => (
      <div className="flex flex-col items-start">
        <span className="font-medium tabular-nums">{fmtMoney(info.getValue())}</span>
        <DeltaBadge curr={info.getValue()} prev={info.row.original.prevSpend} />
      </div>
    ),
  }),
  columnHelper.accessor(row => row.clicks > 0 ? row.spend / row.clicks : 0, {
    id: 'cpc',
    header: ({ column }) => <SortHeader label="CPC" column={column} />,
    cell: info => {
      const r = info.row.original;
      const curr = r.clicks > 0 ? r.spend / r.clicks : 0;
      const prev = r.prevClicks > 0 ? r.prevSpend / r.prevClicks : 0;
      if (curr === 0) return <span className="text-gray-300 text-sm">—</span>;
      return (
        <div className="flex flex-col items-start">
          <span className="font-medium tabular-nums">{fmtMoneyPrecise(curr)}</span>
          <DeltaBadge curr={curr} prev={prev} invertColors />
        </div>
      );
    },
  }),
  columnHelper.accessor('leads', {
    header: ({ column }) => <SortHeader label="Leads" column={column} />,
    cell: info => (
      <div className="flex flex-col items-start">
        <span className="font-medium tabular-nums">{Math.round(info.getValue()).toLocaleString()}</span>
        <DeltaBadge curr={info.getValue()} prev={info.row.original.prevLeads} />
      </div>
    ),
  }),
  columnHelper.accessor(row => row.leads > 0 ? row.spend / row.leads : 0, {
    id: 'cpl',
    header: ({ column }) => <SortHeader label="Cost/Lead" column={column} />,
    cell: info => {
      const r = info.row.original;
      const curr = r.leads > 0 ? r.spend / r.leads : 0;
      const prev = r.prevLeads > 0 ? r.prevSpend / r.prevLeads : 0;
      if (curr === 0) return <span className="text-gray-300 text-sm">—</span>;
      return (
        <div className="flex flex-col items-start">
          <span className="font-medium tabular-nums">{fmtMoney(curr)}</span>
          <DeltaBadge curr={curr} prev={prev} invertColors />
        </div>
      );
    },
  }),
  columnHelper.accessor('mqls', {
    header: ({ column }) => <SortHeader label="MQLs" column={column} />,
    cell: info => (
      <div className="flex flex-col items-start">
        <span className="font-bold text-brand-forest tabular-nums">{Math.round(info.getValue()).toLocaleString()}</span>
        <DeltaBadge curr={info.getValue()} prev={info.row.original.prevMqls} />
      </div>
    ),
  }),
  columnHelper.accessor(row => row.mqls > 0 ? row.spend / row.mqls : 0, {
    id: 'cpmql',
    header: ({ column }) => <SortHeader label="Cost/MQL" column={column} />,
    cell: info => {
      const r = info.row.original;
      const curr = r.mqls > 0 ? r.spend / r.mqls : 0;
      const prev = r.prevMqls > 0 ? r.prevSpend / r.prevMqls : 0;
      if (curr === 0) return <span className="text-gray-300 text-sm">—</span>;
      return (
        <div className="flex flex-col items-start">
          <span className="font-medium tabular-nums">{fmtMoney(curr)}</span>
          <DeltaBadge curr={curr} prev={prev} invertColors />
        </div>
      );
    },
  }),
  columnHelper.accessor('sqls', {
    header: ({ column }) => <SortHeader label="SQLs" column={column} />,
    cell: info => (
      <div className="flex flex-col items-start">
        <span className="font-medium tabular-nums">{Math.round(info.getValue()).toLocaleString()}</span>
        <DeltaBadge curr={info.getValue()} prev={info.row.original.prevSqls} />
      </div>
    ),
  }),
  columnHelper.accessor(row => row.sqls > 0 ? row.spend / row.sqls : 0, {
    id: 'cpsql',
    header: ({ column }) => <SortHeader label="Cost/SQL" column={column} />,
    cell: info => {
      const r = info.row.original;
      const curr = r.sqls > 0 ? r.spend / r.sqls : 0;
      const prev = r.prevSqls > 0 ? r.prevSpend / r.prevSqls : 0;
      if (curr === 0) return <span className="text-gray-300 text-sm">—</span>;
      return (
        <div className="flex flex-col items-start">
          <span className="font-medium tabular-nums">{fmtMoney(curr)}</span>
          <DeltaBadge curr={curr} prev={prev} invertColors />
        </div>
      );
    },
  }),
  columnHelper.accessor('won', {
    header: ({ column }) => <SortHeader label="Won" column={column} />,
    cell: info => (
      <div className="flex flex-col items-start">
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-brand-orange/10 text-brand-orange border border-brand-orange/20 tabular-nums">
          {Math.round(info.getValue()).toLocaleString()}
        </span>
        <DeltaBadge curr={info.getValue()} prev={info.row.original.prevWon} />
      </div>
    ),
  }),
  columnHelper.accessor(row => row.won > 0 ? row.spend / row.won : 0, {
    id: 'cpwon',
    header: ({ column }) => <SortHeader label="Cost/Won ★" column={column} isNorthStar />,
    cell: info => {
      const r = info.row.original;
      const curr = r.won > 0 ? r.spend / r.won : 0;
      const prev = r.prevWon > 0 ? r.prevSpend / r.prevWon : 0;
      if (curr === 0) return <span className="text-gray-300 text-sm">—</span>;
      return (
        <div className="flex flex-col items-start">
          <span className="font-bold text-brand-orange tabular-nums">{fmtMoney(curr)}</span>
          <DeltaBadge curr={curr} prev={prev} invertColors />
        </div>
      );
    },
  }),
  ...fleetColumns,
  ]; // end buildColumns
}

// ─── Column Selector Dropdown ─────────────────────────────────────────────────

function ColumnSelector({ table, fleetBands }: {
  table: ReturnType<typeof useReactTable<ChannelRow>>;
  fleetBands?: string[];
}) {
  const [open, setOpen] = React.useState(false);
  const [rect, setRect] = React.useState<DOMRect | null>(null);
  const btnRef = React.useRef<HTMLButtonElement>(null);
  const dropRef = React.useRef<HTMLDivElement>(null);

  const toggleableColumns = table.getAllColumns().filter(col => col.id !== 'name');

  function openDropdown() {
    if (btnRef.current) setRect(btnRef.current.getBoundingClientRect());
    setOpen(true);
  }

  React.useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (
        btnRef.current && !btnRef.current.contains(e.target as Node) &&
        dropRef.current && !dropRef.current.contains(e.target as Node)
      ) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const dropdown = open && rect && createPortal(
    <div
      ref={dropRef}
      style={{
        position: 'fixed',
        top: rect.bottom + 8,
        right: window.innerWidth - rect.right,
      }}
      className="z-[9999] w-48 bg-white border border-gray-200 rounded-2xl shadow-xl p-2"
    >
      {toggleableColumns.map(col => {
        const label = COLUMN_LABELS[col.id] ?? (fleetBands?.find(b => `fleet_${b}` === col.id) ?? col.id);
        const visible = col.getIsVisible();
        return (
          <button
            key={col.id}
            onClick={() => col.toggleVisibility()}
            className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <span>{label}</span>
            <span className={cn(
              'w-4 h-4 rounded flex items-center justify-center shrink-0 border',
              visible ? 'bg-brand-forest border-brand-forest' : 'border-gray-300',
            )}>
              {visible && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
            </span>
          </button>
        );
      })}
    </div>,
    document.body,
  );

  return (
    <>
      <button
        ref={btnRef}
        onClick={() => open ? setOpen(false) : openDropdown()}
        className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold transition-colors',
          open
            ? 'border-brand-forest bg-brand-forest/5 text-brand-forest'
            : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700',
        )}
      >
        <SlidersHorizontal className="w-3.5 h-3.5" />
        Columns
      </button>
      {dropdown}
    </>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ChannelTable({
  initialChannels,
  firstColumnLabel = 'Channel',
  title = 'Channel Breakdown',
  subtitle = 'Cross-channel performance · Badges show change vs. comparison period',
  fleetBands,
  showColumnSelector = false,
}: ChannelTableProps) {
  const [sorting, setSorting] = React.useState<SortingState>([{ id: 'spend', desc: true }]);
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>(
    showColumnSelector ? PRODUCT_DEFAULT_HIDDEN : {}
  );
  const columns = React.useMemo(() => buildColumns(firstColumnLabel, fleetBands), [firstColumnLabel, fleetBands]);

  const table = useReactTable({
    data: initialChannels,
    columns,
    state: { sorting, columnVisibility },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="w-full bg-white border border-gray-100 shadow-sm rounded-[2.5rem] overflow-hidden">
      <div className="p-8 border-b border-gray-100 flex items-start justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold text-brand-dark">{title}</h3>
          <p className="text-sm text-gray-400 font-medium mt-0.5">{subtitle}</p>
        </div>
        {showColumnSelector && (
          <ColumnSelector table={table} fleetBands={fleetBands} />
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left" style={{ minWidth: '1440px' }}>
          <thead className="bg-gray-50 border-b border-gray-100">
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map(header => (
                  <th
                    key={header.id}
                    className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap"
                  >
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-gray-50">
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={table.getVisibleLeafColumns().length} className="px-6 py-12 text-center text-gray-400 text-sm">
                  No channel data for this period
                </td>
              </tr>
            ) : table.getRowModel().rows.map(row => (
              <tr key={row.id} className="hover:bg-gray-50/50 transition-colors">
                {row.getVisibleCells().map(cell => (
                  <td key={cell.id} className="px-6 py-5 text-sm align-top">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
