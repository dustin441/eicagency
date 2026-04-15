'use client';

import React, { Suspense, useMemo } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Calendar, ChevronDown, SlidersHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SpartacoFilterOptions, SpartacoMode } from '@/services/spartaco-analytics';

function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{label}</label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="appearance-none min-w-[160px] bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 pr-8 text-sm font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-forest/20 cursor-pointer"
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown className="w-3.5 h-3.5 text-gray-400 pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" />
      </div>
    </div>
  );
}

function DateInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{label}</label>
      <div className="relative">
        <Calendar className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="bg-gray-50 border border-gray-200 rounded-xl pl-8 pr-3 py-2 text-sm font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-forest/20 min-w-[148px]"
        />
      </div>
    </div>
  );
}

function SpartacoFilterBarSkeleton() {
  return (
    <div className="space-y-5">
      <div className="flex gap-3">
        <div className="h-10 w-24 bg-gray-100 rounded-full animate-pulse" />
        <div className="h-10 w-24 bg-gray-100 rounded-full animate-pulse" />
      </div>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 h-[72px] animate-pulse" />
    </div>
  );
}

function SpartacoFilterBarInner({
  mode,
  options,
}: {
  mode: SpartacoMode;
  options: SpartacoFilterOptions;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const values = useMemo(
    () => ({
      start: searchParams.get('start') ?? '',
      end: searchParams.get('end') ?? '',
      brand: searchParams.get('brand') ?? 'all',
      channel: searchParams.get('channel') ?? 'all',
      focus: searchParams.get('focus') ?? 'all',
      campaign: searchParams.get('campaign') ?? 'all',
    }),
    [searchParams]
  );

  function update(next: Partial<typeof values>) {
    const params = new URLSearchParams(searchParams.toString());
    const merged = { ...values, ...next };
    params.set('start', merged.start);
    params.set('end', merged.end);
    params.set('brand', merged.brand);
    params.set('channel', merged.channel);
    params.set('focus', merged.focus);
    params.set('campaign', merged.campaign);
    router.push(`${pathname}?${params.toString()}`);
  }

  const tabBase =
    'inline-flex items-center rounded-full px-4 py-2 text-sm font-semibold transition-colors';

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href={`/dashboard/spartaco/leads?${searchParams.toString()}`}
          className={cn(tabBase, mode === 'LEAD' ? 'bg-brand-forest text-white' : 'bg-white text-gray-600 border border-gray-200')}
        >
          Lead Gen
        </Link>
        <Link
          href={`/dashboard/spartaco/ecommerce?${searchParams.toString()}`}
          className={cn(tabBase, mode === 'SALES' ? 'bg-brand-forest text-white' : 'bg-white text-gray-600 border border-gray-200')}
        >
          eCommerce
        </Link>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          {/* Filters Label */}
          <div className="flex items-center gap-2 self-end pb-2 mr-1">
            <SlidersHorizontal className="w-4 h-4 text-gray-400" />
            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Filters</span>
          </div>

          <DateInput label="Start Date" value={values.start} onChange={(value) => update({ start: value })} />
          <DateInput label="End Date" value={values.end} onChange={(value) => update({ end: value })} />
          <Select
            label="Brand"
            value={values.brand}
            onChange={(value) => update({ brand: value, campaign: 'all' })}
            options={[{ value: 'all', label: 'All Brands' }, ...options.brands.map((value) => ({ value, label: value }))]}
          />
          <Select
            label="Ad Channel"
            value={values.channel}
            onChange={(value) => update({ channel: value, campaign: 'all' })}
            options={[{ value: 'all', label: 'All Channels' }, ...options.channels.map((value) => ({ value, label: value }))]}
          />
          <Select
            label="Product"
            value={values.focus}
            onChange={(value) => update({ focus: value, campaign: 'all' })}
            options={[{ value: 'all', label: 'All Products' }, ...options.focuses.map((value) => ({ value, label: value }))]}
          />
          <Select
            label="Campaign Name"
            value={values.campaign}
            onChange={(value) => update({ campaign: value })}
            options={[{ value: 'all', label: 'All Campaigns' }, ...options.campaigns.map((value) => ({ value, label: value }))]}
          />
        </div>
      </div>
    </div>
  );
}

export default function SpartacoFilterBar(props: {
  mode: SpartacoMode;
  options: SpartacoFilterOptions;
}) {
  return (
    <Suspense fallback={<SpartacoFilterBarSkeleton />}>
      <SpartacoFilterBarInner {...props} />
    </Suspense>
  );
}
