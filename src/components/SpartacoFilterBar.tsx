'use client';

import React, { Suspense, useState, useCallback, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Calendar, ChevronDown, SlidersHorizontal, Check, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SpartacoFilterOptions, SpartacoMode, SpartacoFilterParams } from '@/services/spartaco-analytics';
import { 
  fmtDateShort, 
  detectPreset, 
  getPresetDates, 
  PRESETS, 
  computeCompDates,
  type PresetKey 
} from '@/lib/date-utils';

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

// ─── Source / Medium Dropdown ─────────────────────────────────────────────────

function SourceMediumSelect({
  value,
  options,
  onChange,
}: {
  value: string;
  options: { value: string; label: string; channel?: string }[];
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    }
    if (open) document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  // Focus search input when opened
  useEffect(() => {
    if (open && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [open]);

  const filtered = useMemo(() => {
    if (!search.trim()) return options;
    const q = search.toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, search]);

  const selectedLabel = options.find((o) => o.value === value)?.label ?? 'All Source / Medium';

  return (
    <div ref={ref} className="flex flex-col gap-1">
      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Source / Medium</label>
      <div className="relative">
        <button
          onClick={() => setOpen((o) => !o)}
          className={cn(
            'flex items-center gap-2 border rounded-xl px-3 py-2 text-sm font-semibold transition-all max-w-[220px]',
            open
              ? 'bg-brand-forest text-white border-brand-forest shadow-sm'
              : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100 hover:border-gray-300'
          )}
        >
          <span className="truncate">{selectedLabel}</span>
          <ChevronDown className={cn('w-3.5 h-3.5 shrink-0 transition-transform', open ? 'rotate-180 text-white' : 'text-gray-400')} />
        </button>

        {open && (
          <div className="absolute top-full left-0 mt-2 z-50 bg-white rounded-2xl border border-gray-100 shadow-2xl overflow-hidden w-[280px]">
            {/* Search input */}
            <div className="p-2 border-b border-gray-100">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search sources…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg pl-8 pr-3 py-2 text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-forest/20 focus:border-brand-forest/30"
                />
              </div>
            </div>

            {/* Options list */}
            <div className="max-h-[280px] overflow-y-auto py-1">
              {filtered.length === 0 ? (
                <div className="px-3 py-4 text-sm text-gray-400 text-center">No matches found</div>
              ) : (
                filtered.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => {
                      onChange(option.value);
                      setOpen(false);
                      setSearch('');
                    }}
                    className={cn(
                      'w-full text-left px-3 py-2 text-sm font-medium transition-colors flex items-center justify-between gap-2',
                      value === option.value
                        ? 'bg-brand-forest text-white'
                        : 'text-gray-700 hover:bg-gray-50'
                    )}
                  >
                    <span className="truncate">{option.label}</span>
                    {value === option.value && <Check className="w-3.5 h-3.5 shrink-0" />}
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function DateRangePicker({
  start, end,
  onApply,
}: {
  start: string;
  end: string;
  onApply: (start: string, end: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [activePreset, setActivePreset] = useState<PresetKey>(() => detectPreset(start, end));
  const [customStart, setCustomStart] = useState(start);
  const [customEnd, setCustomEnd]     = useState(end);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setActivePreset(detectPreset(start, end));
    setCustomStart(start);
    setCustomEnd(end);
  }, [start, end]);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  const handlePreset = (key: PresetKey) => {
    setActivePreset(key);
    if (key !== 'custom') {
      const dates = getPresetDates(key)!;
      onApply(dates.start, dates.end);
      setOpen(false);
    }
  };

  const handleCustomApply = () => {
    if (customStart && customEnd) {
      onApply(customStart, customEnd);
      setOpen(false);
    }
  };

  const buttonLabel = activePreset !== 'custom'
    ? PRESETS.find(p => p.key === activePreset)?.label ?? `${fmtDateShort(start)} – ${fmtDateShort(end)}`
    : `${fmtDateShort(start)} – ${fmtDateShort(end)}`;

  return (
    <div ref={ref} className="relative">
      <div className="flex flex-col gap-1">
        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Date Range</label>
        <button
          onClick={() => setOpen(o => !o)}
          className={cn(
            'flex items-center gap-2 border rounded-xl px-3 py-2 text-sm font-semibold text-gray-700 transition-all min-w-[210px]',
            open
              ? 'bg-brand-forest text-white border-brand-forest shadow-sm'
              : 'bg-gray-50 border-gray-200 hover:bg-gray-100 hover:border-gray-300'
          )}
        >
          <Calendar className={cn('w-3.5 h-3.5', open ? 'text-white' : 'text-gray-400')} />
          <span className={open ? 'text-white' : ''}>{buttonLabel}</span>
          <ChevronDown className={cn('w-3.5 h-3.5 transition-transform ml-auto', open ? 'rotate-180 text-white' : 'text-gray-400')} />
        </button>
      </div>

      {open && (
        <div className="absolute top-full left-0 mt-2 z-50 bg-white rounded-2xl border border-gray-100 shadow-2xl overflow-hidden flex min-w-[320px]">
          <div className="w-44 py-2 border-r border-gray-100 shrink-0">
            {PRESETS.map((p) => (
              <button
                key={p.key}
                onClick={() => handlePreset(p.key)}
                className={cn(
                  'w-full text-left px-3 py-2 text-sm font-medium transition-colors flex items-center justify-between gap-2',
                  activePreset === p.key
                    ? 'bg-brand-forest text-white'
                    : 'text-gray-700 hover:bg-gray-50'
                )}
              >
                <span>{p.label}</span>
                {activePreset === p.key && <Check className="w-3.5 h-3.5 shrink-0" />}
              </button>
            ))}
          </div>

          <div className={cn(
            'flex flex-col gap-4 p-4 transition-all',
            activePreset === 'custom' ? 'w-56 opacity-100' : 'w-0 p-0 overflow-hidden opacity-0 pointer-events-none'
          )}>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">Custom Range</p>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1.5 block">From</label>
                <input
                  type="date"
                  value={customStart}
                  onChange={e => setCustomStart(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-forest/20"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1.5 block">To</label>
                <input
                  type="date"
                  value={customEnd}
                  onChange={e => setCustomEnd(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-forest/20"
                />
              </div>
            </div>
            <button
              onClick={handleCustomApply}
              disabled={!customStart || !customEnd}
              className="w-full bg-brand-forest text-white py-2.5 rounded-xl text-sm font-bold hover:bg-brand-forest/90 transition-colors disabled:opacity-40"
            >
              Apply Range
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ComparisonPicker({
  compMode,
  compStart,
  compEnd,
  onApply,
}: {
  compMode: 'prev_period' | 'prev_year' | 'custom';
  compStart: string;
  compEnd: string;
  onApply: (mode: 'prev_period' | 'prev_year' | 'custom', start?: string, end?: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  const label = compMode === 'prev_period' ? 'Prev Period' : compMode === 'prev_year' ? 'Prev Year' : 'Custom';
  const sublabel = compMode === 'custom' ? `${fmtDateShort(compStart)} – ${fmtDateShort(compEnd)}` : '';

  return (
    <div ref={ref} className="relative">
      <div className="flex flex-col gap-1">
        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Comparison</label>
        <button
          onClick={() => setOpen(o => !o)}
          className={cn(
            'flex items-center gap-2 border rounded-xl px-3 py-2 text-sm font-semibold text-gray-700 transition-all min-w-[160px]',
            open
              ? 'bg-brand-forest text-white border-brand-forest'
              : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
          )}
        >
          <div className="flex flex-col items-start leading-tight">
            <span>{label}</span>
            {sublabel && <span className={cn('text-[10px] font-medium', open ? 'text-white/70' : 'text-gray-400')}>{sublabel}</span>}
          </div>
          <ChevronDown className={cn('w-3.5 h-3.5 transition-transform ml-auto', open ? 'rotate-180 text-white' : 'text-gray-400')} />
        </button>
      </div>

      {open && (
        <div className="absolute top-full left-0 mt-2 z-50 bg-white rounded-2xl border border-gray-100 shadow-2xl min-w-[180px] overflow-hidden">
          <button
            onClick={() => { onApply('prev_period'); setOpen(false); }}
            className={cn('w-full text-left px-4 py-2.5 text-sm font-medium transition-colors hover:bg-gray-50 flex items-center justify-between', compMode === 'prev_period' && 'text-brand-forest')}
          >
            Previous Period {compMode === 'prev_period' && <Check className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={() => { onApply('prev_year'); setOpen(false); }}
            className={cn('w-full text-left px-4 py-2.5 text-sm font-medium transition-colors hover:bg-gray-50 flex items-center justify-between', compMode === 'prev_year' && 'text-brand-forest')}
          >
            Previous Year {compMode === 'prev_year' && <Check className="w-3.5 h-3.5" />}
          </button>
          <div className="border-t border-gray-100 p-4">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Custom Comparison</p>
            <div className="space-y-3">
              <input
                type="date"
                value={compStart}
                onChange={e => onApply('custom', e.target.value, compEnd)}
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-forest/20"
              />
              <input
                type="date"
                value={compEnd}
                onChange={e => onApply('custom', compStart, e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-forest/20"
              />
            </div>
          </div>
        </div>
      )}
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
  initialParams,
  currentTab,
}: {
  mode: SpartacoMode;
  options?: any;
  initialParams: any;
  currentTab?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const values = useMemo(
    () => ({
      start: searchParams.get('start') ?? initialParams.start,
      end: searchParams.get('end') ?? initialParams.end,
      comp_start: searchParams.get('comp_start') ?? initialParams.compStart,
      comp_end: searchParams.get('comp_end') ?? initialParams.compEnd,
      comp_mode: (searchParams.get('comp_mode') as any) ?? 'prev_period',
      brand:         searchParams.get('brand')         ?? initialParams.brand,
      channel:       searchParams.get('channel')       ?? initialParams.channel,
      focus:         searchParams.get('focus')         ?? initialParams.focus,
      campaign:      searchParams.get('campaign')      ?? initialParams.campaign,
      channel_group: searchParams.get('channel_group') ?? (initialParams.channelGroup ?? 'all'),
      source_medium: searchParams.get('source_medium') ?? (initialParams.sourceMedium ?? 'all'),
    }),
    [searchParams, initialParams]
  );

  function update(next: Partial<typeof values>) {
    const params = new URLSearchParams(searchParams.toString());
    const merged = { ...values, ...next };
    
    // Auto-calculate comparison dates if mode changes or range changes
    if (next.start || next.end || next.comp_mode) {
      if (merged.comp_mode !== 'custom') {
        const { compStart, compEnd } = computeCompDates(merged.start, merged.end, merged.comp_mode);
        merged.comp_start = compStart;
        merged.comp_end = compEnd;
      }
    }

    Object.entries(merged).forEach(([key, val]) => {
      params.set(key, val);
    });
    
    router.push(`${pathname}?${params.toString()}`);
  }

  const tabBase =
    'inline-flex items-center rounded-full px-4 py-2 text-sm font-semibold transition-colors';

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href={`/dashboard/spartaco/leads?${searchParams.toString()}`}
          className={cn(tabBase, currentTab === 'leads' ? 'bg-brand-forest text-white' : 'bg-white text-gray-600 border border-gray-200')}
        >
          Lead Gen
        </Link>
        <Link
          href={`/dashboard/spartaco/ecommerce?${searchParams.toString()}`}
          className={cn(tabBase, currentTab === 'ecommerce' ? 'bg-brand-forest text-white' : 'bg-white text-gray-600 border border-gray-200')}
        >
          eCommerce
        </Link>
        <Link
          href={`/dashboard/spartaco/all?${searchParams.toString()}`}
          className={cn(tabBase, currentTab === 'all' ? 'bg-brand-forest text-white' : 'bg-white text-gray-600 border border-gray-200')}
        >
          All Data
        </Link>
        <Link
          href={`/dashboard/spartaco/products?${searchParams.toString()}`}
          className={cn(tabBase, currentTab === 'products' ? 'bg-brand-forest text-white' : 'bg-white text-gray-600 border border-gray-200')}
        >
          Product Performance
        </Link>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
          <div className="flex items-center gap-2 self-end pb-2 mr-1">
            <SlidersHorizontal className="w-4 h-4 text-gray-400" />
            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Filters</span>
          </div>

          <DateRangePicker
            start={values.start}
            end={values.end}
            onApply={(start, end) => update({ start, end })}
          />

          <ComparisonPicker
            compMode={values.comp_mode}
            compStart={values.comp_start}
            compEnd={values.comp_end}
            onApply={(mode, start, end) => update({ comp_mode: mode, comp_start: start ?? values.comp_start, comp_end: end ?? values.comp_end })}
          />

          <div className="h-10 w-px bg-gray-100 self-center hidden lg:block" />

          <Select
            label="Brand"
            value={values.brand}
            options={[{ value: 'all', label: 'All Brands' }, ...(options?.brands || []).map((b: string) => ({ value: b, label: b }))]}
            onChange={(v) => update({ brand: v })}
          />
          {currentTab !== 'products' ? (
            <>
              <Select
                label="Channel"
                value={values.channel}
                options={[{ value: 'all', label: 'All Channels' }, ...(options?.channels || []).map((c: string) => ({ value: c, label: c }))]}
                onChange={(v) => update({ channel: v })}
              />
              <Select
                label="Campaign"
                value={values.campaign}
                options={[{ value: 'all', label: 'All Campaigns' }, ...(options?.campaigns || []).map((c: string) => ({ value: c, label: c }))]}
                onChange={(v) => update({ campaign: v })}
              />
            </>
          ) : (
            <>
              {options?.products?.length > 0 && (
                <Select
                  label="Product"
                  value={searchParams.get('product') || 'all'}
                  options={[{ value: 'all', label: 'All Products' }, ...options.products.map((p: string) => ({ value: p, label: p }))]}
                  onChange={(v) => {
                    const p = new URLSearchParams(searchParams.toString());
                    if (v === 'all') p.delete('product');
                    else p.set('product', v);
                    router.push(`${pathname}?${p.toString()}`);
                  }}
                />
              )}
              {options?.channelGroups?.length > 0 && (
                <Select
                  label="Channel Group"
                  value={values.channel_group}
                  options={[{ value: 'all', label: 'All Channel Groups' }, ...options.channelGroups.map((c: string) => ({ value: c, label: c }))]}
                  onChange={(v) => update({ channel_group: v })}
                />
              )}
              {options?.sourceMediums?.length > 0 && (
                <SourceMediumSelect
                  value={values.source_medium}
                  options={[{ value: 'all', label: 'All Sources' }, ...options.sourceMediums.map((s: string) => ({ value: s, label: s }))]}
                  onChange={(v) => update({ source_medium: v })}
                />
              )}
            </>
          )}
        </div>

        <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="text-xs text-gray-400 font-medium">
            <span className="font-semibold text-gray-500">Period:</span>{' '}
            {new Date(values.start + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            {' – '}
            {new Date(values.end + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
          <span className="text-gray-200 select-none">|</span>
          <span className="text-xs text-gray-400 font-medium">
            <span className="font-semibold text-gray-500">Comparing:</span>{' '}
            {new Date(values.comp_start + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            {' – '}
            {new Date(values.comp_end + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function SpartacoFilterBar(props: any) {
  return (
    <Suspense fallback={<SpartacoFilterBarSkeleton />}>
      <SpartacoFilterBarInner {...props} />
    </Suspense>
  );
}
