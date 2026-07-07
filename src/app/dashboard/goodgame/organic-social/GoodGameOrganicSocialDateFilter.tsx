'use client';

import React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

const OPTIONS = [
  { value: 'last7', label: 'Last 7 days' },
  { value: 'last28', label: 'Last 28 days' },
  { value: 'last90', label: 'Last 90 days' },
  { value: 'all', label: 'All imported data' },
  { value: 'custom', label: 'Custom range' },
];

export default function GoodGameOrganicSocialDateFilter({
  range,
  start,
  end,
}: {
  range: string;
  start: string;
  end: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function update(next: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(next).forEach(([key, value]) => {
      if (value) params.set(key, value);
      else params.delete(key);
    });
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="rounded-[1.5rem] border border-gray-100 bg-white p-4 shadow-sm">
      <div className="grid gap-3 md:grid-cols-[220px_1fr_1fr_auto] md:items-end">
        <label className="text-xs font-black uppercase tracking-[0.18em] text-gray-400">
          Date range
          <select
            value={range}
            onChange={(event) => update({ range: event.target.value, start: event.target.value === 'custom' ? start : null, end: event.target.value === 'custom' ? end : null })}
            className="mt-2 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-bold normal-case tracking-normal text-gray-800 outline-none transition focus:border-brand-orange focus:ring-2 focus:ring-orange-100"
          >
            {OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>

        <label className="text-xs font-black uppercase tracking-[0.18em] text-gray-400">
          Start
          <input
            type="date"
            value={start}
            disabled={range !== 'custom'}
            onChange={(event) => update({ range: 'custom', start: event.target.value })}
            className="mt-2 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-bold normal-case tracking-normal text-gray-800 outline-none transition focus:border-brand-orange focus:ring-2 focus:ring-orange-100 disabled:cursor-not-allowed disabled:opacity-50"
          />
        </label>

        <label className="text-xs font-black uppercase tracking-[0.18em] text-gray-400">
          End
          <input
            type="date"
            value={end}
            disabled={range !== 'custom'}
            onChange={(event) => update({ range: 'custom', end: event.target.value })}
            className="mt-2 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-bold normal-case tracking-normal text-gray-800 outline-none transition focus:border-brand-orange focus:ring-2 focus:ring-orange-100 disabled:cursor-not-allowed disabled:opacity-50"
          />
        </label>

        <button
          type="button"
          onClick={() => update({ range: 'last28', start: null, end: null })}
          className="rounded-full bg-gray-100 px-5 py-3 text-sm font-black text-gray-700 transition hover:bg-gray-200"
        >
          Reset
        </button>
      </div>
    </div>
  );
}
