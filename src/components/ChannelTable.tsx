'use client';

import React from 'react';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
  getSortedRowModel,
  SortingState,
} from '@tanstack/react-table';
import { ArrowUpDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

type ChannelStats = {
  name: string;
  spend: number;
  clicks: number;
  mqls: number;
  sqls: number;
  won: number;
};

interface ChannelTableProps {
  initialChannels: ChannelStats[];
}

const columnHelper = createColumnHelper<ChannelStats>();

const columns = [
  columnHelper.accessor('name', {
    header: ({ column }) => (
      <button onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="flex items-center gap-1 hover:text-brand-orange transition-colors">
        Channel <ArrowUpDown className="w-3 h-3" />
      </button>
    ),
    cell: info => <span className="font-bold text-brand-dark truncate max-w-[200px] block" title={info.getValue()}>{info.getValue()}</span>,
  }),
  columnHelper.accessor('spend', {
    header: ({ column }) => (
       <button onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="flex items-center gap-1 hover:text-brand-orange font-bold transition-colors">
         Spend <ArrowUpDown className="w-3 h-3" />
       </button>
    ),
    cell: info => <span className="font-medium">${info.getValue().toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>,
  }),
  columnHelper.accessor('mqls', {
    header: ({ column }) => (
       <button onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="flex items-center gap-1 hover:text-brand-orange font-bold transition-colors">
         MQLs <ArrowUpDown className="w-3 h-3" />
       </button>
    ),
    cell: info => <span className="font-bold text-brand-forest">{info.getValue()}</span>,
  }),
  columnHelper.accessor(row => row.spend / (row.mqls || 1), {
    id: 'cpl',
    header: ({ column }) => (
       <button onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="flex items-center gap-1 hover:text-brand-orange font-bold transition-colors">
         CPL (MQL) <ArrowUpDown className="w-3 h-3" />
       </button>
    ),
    cell: info => <span className="font-medium">${info.getValue().toFixed(2)}</span>,
  }),
  columnHelper.accessor('won', {
    header: ({ column }) => (
       <button onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="flex items-center gap-1 hover:text-brand-orange font-bold transition-colors">
         Won <ArrowUpDown className="w-3 h-3" />
       </button>
    ),
    cell: info => <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-brand-orange/10 text-brand-orange border border-brand-orange/20">{info.getValue()}</span>,
  }),
  columnHelper.accessor(row => row.spend / (row.won || 1), {
    id: 'cpw',
    header: ({ column }) => (
       <button onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="flex items-center gap-1 hover:text-brand-orange font-bold transition-colors">
         CPW (Won) <ArrowUpDown className="w-3 h-3" />
       </button>
    ),
    cell: info => <span className="font-bold text-brand-orange">${info.getValue().toFixed(2)}</span>,
  }),
];

export default function ChannelTable({ initialChannels }: ChannelTableProps) {
  const [sorting, setSorting] = React.useState<SortingState>([{ id: 'spend', desc: true }]);

  const table = useReactTable({
    data: initialChannels,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="w-full overflow-hidden bg-white border border-gray-100 shadow-sm rounded-[2.5rem]">
      <div className="p-8 border-b border-gray-100 flex items-center justify-between">
        <div>
           <h3 className="text-xl font-bold text-brand-dark">Channel Breakdown</h3>
           <p className="text-sm text-gray-400 font-medium">Cross-channel ROI comparison (Live Data)</p>
        </div>
        <button className="text-brand-orange font-bold text-sm flex items-center gap-1 hover:translate-x-1 transition-transform">
           View full report <ChevronRight className="w-4 h-4" />
        </button>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b border-gray-100">
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map(header => (
                  <th key={header.id} className="px-8 py-5 text-xs font-bold text-gray-400 uppercase tracking-widest">
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-gray-50">
            {table.getRowModel().rows.map(row => (
              <tr key={row.id} className="hover:bg-gray-50/50 transition-colors group">
                {row.getVisibleCells().map(cell => (
                  <td key={cell.id} className="px-8 py-6 text-sm">
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
