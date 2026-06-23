'use client';

import { useState } from 'react';
import type { TrafficBreakdownRow } from '@/services/spartaco-product-analytics';
import { fmtCurrency, fmtNumber } from '@/lib/utils';

type Props = {
  rows: TrafficBreakdownRow[];
};

const PAGE_SIZE = 5;

export default function WrapupSourceMediumTable({ rows }: Props) {
  const [page, setPage] = useState(0);
  if (rows.length === 0) return null;

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const start = page * PAGE_SIZE;
  const visibleRows = rows.slice(start, start + PAGE_SIZE);

  return (
    <section className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
      <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-500">Source / Medium</p>
          <h2 className="mt-1 text-lg font-black text-brand-dark">What traffic sources drove product activity</h2>
        </div>
        <p className="max-w-xl text-sm leading-relaxed text-gray-500">
          Top five are shown first; use pagination to inspect long-tail organic, direct, referral, and social sources without cluttering the executive view.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-xs font-black uppercase tracking-widest text-gray-400">
              <th className="pb-3 pr-4">Source / medium</th>
              <th className="pb-3 pr-4">Channel</th>
              <th className="pb-3 pr-4 text-right">Sessions</th>
              <th className="pb-3 pr-4 text-right">Engaged sessions</th>
              <th className="pb-3 pr-4 text-right">Leads</th>
              <th className="pb-3 pr-4 text-right">Online sales</th>
              <th className="pb-3 text-right">Online revenue</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row) => (
              <tr key={`${row.label}-${row.sublabel ?? ''}-${row.channelGroup ?? ''}`} className="border-b border-gray-50 last:border-0">
                <td className="py-3 pr-4">
                  <p className="font-black text-brand-dark">{row.label} / {row.sublabel ?? '(none)'}</p>
                </td>
                <td className="py-3 pr-4 text-gray-500">{row.channelGroup ?? '—'}</td>
                <td className="py-3 pr-4 text-right font-bold text-brand-dark">{fmtNumber(row.ga4_sessions)}</td>
                <td className="py-3 pr-4 text-right text-gray-600">{fmtNumber(row.ga4_engaged_sessions)}</td>
                <td className="py-3 pr-4 text-right text-gray-600">{fmtNumber(row.tracked_leads)}</td>
                <td className="py-3 pr-4 text-right text-gray-600">{fmtNumber(row.ga4_purchases)}</td>
                <td className="py-3 text-right font-bold text-brand-dark">{fmtCurrency(row.ga4_total_revenue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex flex-col gap-3 border-t border-gray-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs leading-relaxed text-gray-500">
          Showing {start + 1}–{Math.min(start + PAGE_SIZE, rows.length)} of {rows.length} source/medium rows. Leads are tracked ad-platform conversions; online sales/revenue are GA4 eCommerce purchases.
        </p>
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(0, current - 1))}
              disabled={page === 0}
              className="rounded-full border border-gray-200 px-3 py-1.5 text-xs font-black uppercase tracking-widest text-gray-600 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Prev
            </button>
            <span className="text-xs font-bold text-gray-500">Page {page + 1} of {totalPages}</span>
            <button
              type="button"
              onClick={() => setPage((current) => Math.min(totalPages - 1, current + 1))}
              disabled={page >= totalPages - 1}
              className="rounded-full border border-gray-200 px-3 py-1.5 text-xs font-black uppercase tracking-widest text-gray-600 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
