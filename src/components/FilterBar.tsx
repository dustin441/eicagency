'use client';

import React, { Suspense, useState, useCallback, useEffect, useRef } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Calendar, ChevronDown, SlidersHorizontal, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Date helpers ─────────────────────────────────────────────────────────────

function today() { return new Date().toISOString().split('T')[0]; }

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function subtractYear(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  d.setFullYear(d.getFullYear() - 1);
  return d.toISOString().split('T')[0];
}

function daysBetween(a: string, b: string): number {
  const da = new Date(a + 'T12:00:00');
  const db = new Date(b + 'T12:00:00');
  return Math.abs(Math.round((db.getTime() - da.getTime()) / 86400000));
}

function computeCompDates(
  start: string, end: string, mode: 'prev_period' | 'prev_year'
): { compStart: string; compEnd: string } {
  if (mode === 'prev_year') {
    return { compStart: subtractYear(start), compEnd: subtractYear(end) };
  }
  const span = daysBetween(start, end);
  const compEnd = addDays(start, -1);
  const compStart = addDays(compEnd, -span);
  return { compStart, compEnd };
}

function fmtDate(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtDateShort(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ─── Date presets ──────────────────────────────────────────────────────────────

type PresetKey =
  | 'today' | 'yesterday'
  | 'last7' | 'last14' | 'last28' | 'last30' | 'last90'
  | 'thisMonth' | 'lastMonth'
  | 'thisQuarter' | 'lastQuarter'
  | 'thisYear'
  | 'custom';

function getPresetDates(preset: PresetKey): { start: string; end: string } | null {
  const t = today();
  const d = new Date(t + 'T12:00:00');
  switch (preset) {
    case 'today':     return { start: t, end: t };
    case 'yesterday': { const y = addDays(t, -1); return { start: y, end: y }; }
    case 'last7':     return { start: addDays(t, -6), end: t };
    case 'last14':    return { start: addDays(t, -13), end: t };
    case 'last28':    return { start: addDays(t, -27), end: t };
    case 'last30':    return { start: addDays(t, -29), end: t };
    case 'last90':    return { start: addDays(t, -89), end: t };
    case 'thisMonth': {
      const s = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
      return { start: s, end: t };
    }
    case 'lastMonth': {
      const lm = new Date(d.getFullYear(), d.getMonth() - 1, 1);
      const lme = new Date(d.getFullYear(), d.getMonth(), 0);
      return { start: lm.toISOString().split('T')[0], end: lme.toISOString().split('T')[0] };
    }
    case 'thisQuarter': {
      const q = Math.floor(d.getMonth() / 3);
      const qs = new Date(d.getFullYear(), q * 3, 1);
      return { start: qs.toISOString().split('T')[0], end: t };
    }
    case 'lastQuarter': {
      const q = Math.floor(d.getMonth() / 3);
      const lqs = new Date(d.getFullYear(), (q - 1) * 3, 1);
      const lqe = new Date(d.getFullYear(), q * 3, 0);
      return { start: lqs.toISOString().split('T')[0], end: lqe.toISOString().split('T')[0] };
    }
    case 'thisYear':  return { start: `${d.getFullYear()}-01-01`, end: t };
    default: return null;
  }
}

const PRESETS: { key: PresetKey; label: string; group?: string }[] = [
  { key: 'today',        label: 'Today' },
  { key: 'yesterday',    label: 'Yesterday' },
  { key: 'last7',        label: 'Last 7 days' },
  { key: 'last14',       label: 'Last 14 days' },
  { key: 'last28',       label: 'Last 28 days' },
  { key: 'last30',       label: 'Last 30 days' },
  { key: 'last90',       label: 'Last 90 days' },
  { key: 'thisMonth',    label: 'This month' },
  { key: 'lastMonth',    label: 'Last month' },
  { key: 'thisQuarter',  label: 'This quarter' },
  { key: 'lastQuarter',  label: 'Last quarter' },
  { key: 'thisYear',     label: 'This year' },
  { key: 'custom',       label: 'Custom range' },
];

function detectPreset(start: string, end: string): PresetKey {
  for (const p of PRESETS) {
    if (p.key === 'custom') continue;
    const dates = getPresetDates(p.key);
    if (dates && dates.start === start && dates.end === end) return p.key;
  }
  return 'custom';
}

// ─── DateRangePicker ──────────────────────────────────────────────────────────

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

  // Sync when URL changes externally (back/forward)
  useEffect(() => {
    setActivePreset(detectPreset(start, end));
    setCustomStart(start);
    setCustomEnd(end);
  }, [start, end]);

  // Close on outside click
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
      <button
        onClick={() => setOpen(o => !o)}
        className={cn(
          'flex items-center gap-2 border rounded-xl px-3 py-2 text-sm font-semibold text-gray-700 transition-all',
          open
            ? 'bg-brand-forest text-white border-brand-forest shadow-sm'
            : 'bg-gray-50 border-gray-200 hover:bg-gray-100 hover:border-gray-300'
        )}
      >
        <Calendar className={cn('w-3.5 h-3.5', open ? 'text-white' : 'text-gray-400')} />
        <span className={open ? 'text-white' : ''}>{buttonLabel}</span>
        <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', open ? 'rotate-180 text-white' : 'text-gray-400')} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-2 z-50 bg-white rounded-2xl border border-gray-100 shadow-2xl overflow-hidden flex min-w-[320px]">
          {/* Preset list */}
          <div className="w-44 py-2 border-r border-gray-100 shrink-0">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-3 pb-2 pt-1">Date Range</p>
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

          {/* Custom date inputs — shown when Custom range is active */}
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
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-forest/20 focus:border-brand-forest/30"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1.5 block">To</label>
                <input
                  type="date"
                  value={customEnd}
                  onChange={e => setCustomEnd(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-forest/20 focus:border-brand-forest/30"
                />
              </div>
            </div>
            <button
              onClick={handleCustomApply}
              disabled={!customStart || !customEnd}
              className="w-full bg-brand-forest text-white py-2.5 rounded-xl text-sm font-bold hover:bg-brand-forest/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
            >
              Apply Range
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Generic Select ───────────────────────────────────────────────────────────

function Select({
  label, value, options, onChange, className,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{label}</label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="appearance-none bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 pr-8 text-sm font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-forest/20 cursor-pointer min-w-[120px]"
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
      </div>
    </div>
  );
}

// ─── DateInput (used for compare custom range) ────────────────────────────────

function DateInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{label}</label>
      <div className="relative">
        <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
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

// ─── Main FilterBar ───────────────────────────────────────────────────────────

type CompareMode = 'prev_period' | 'prev_year' | 'custom';

export interface FilterBarProps {
  showFocus?: boolean;
}

function FilterBarSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 h-[72px] animate-pulse" />
  );
}

function FilterBarInner({ showFocus = false }: FilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [start, setStart] = useState(searchParams.get('start') ?? addDays(today(), -29));
  const [end, setEnd]     = useState(searchParams.get('end')   ?? today());
  const [compareMode, setCompareMode] = useState<CompareMode>(
    (searchParams.get('compare') as CompareMode | null) ?? 'prev_period'
  );
  const [customCompStart, setCustomCompStart] = useState(searchParams.get('comp_start') ?? '');
  const [customCompEnd,   setCustomCompEnd]   = useState(searchParams.get('comp_end')   ?? '');
  const [channel, setChannel] = useState(searchParams.get('channel') ?? 'all');
  const [focus,   setFocus]   = useState(searchParams.get('focus')   ?? 'all');

  useEffect(() => {
    setStart(searchParams.get('start') ?? addDays(today(), -29));
    setEnd(searchParams.get('end')     ?? today());
    setCompareMode((searchParams.get('compare') as CompareMode | null) ?? 'prev_period');
    setCustomCompStart(searchParams.get('comp_start') ?? '');
    setCustomCompEnd(searchParams.get('comp_end')     ?? '');
    setChannel(searchParams.get('channel') ?? 'all');
    setFocus(searchParams.get('focus')     ?? 'all');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.toString()]);

  const buildParams = useCallback(
    (overrides: Partial<{
      start: string; end: string; compareMode: CompareMode;
      customCompStart: string; customCompEnd: string;
      channel: string; focus: string;
    }> = {}) => {
      const s   = overrides.start           ?? start;
      const e   = overrides.end             ?? end;
      const cm  = overrides.compareMode     ?? compareMode;
      const ccs = overrides.customCompStart ?? customCompStart;
      const cce = overrides.customCompEnd   ?? customCompEnd;
      const ch  = overrides.channel         ?? channel;
      const fo  = overrides.focus           ?? focus;

      const comp = cm === 'custom'
        ? { compStart: ccs, compEnd: cce }
        : computeCompDates(s, e, cm);

      return new URLSearchParams({
        start: s, end: e,
        comp_start: comp.compStart, comp_end: comp.compEnd,
        channel: ch, focus: fo, compare: cm,
      });
    },
    [start, end, compareMode, customCompStart, customCompEnd, channel, focus]
  );

  const apply = useCallback((overrides = {}) => {
    router.push(`${pathname}?${buildParams(overrides).toString()}`);
  }, [buildParams, pathname, router]);

  const handleDateRange = (newStart: string, newEnd: string) => {
    setStart(newStart);
    setEnd(newEnd);
    apply({ start: newStart, end: newEnd });
  };

  const handleChannel = (v: string) => { setChannel(v); apply({ channel: v }); };
  const handleFocus   = (v: string) => { setFocus(v);   apply({ focus: v }); };

  const handleCompareMode = (v: CompareMode) => {
    setCompareMode(v);
    if (v !== 'custom') apply({ compareMode: v });
  };

  const resolvedComp = compareMode === 'custom'
    ? { compStart: customCompStart, compEnd: customCompEnd }
    : computeCompDates(start, end, compareMode);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <div className="flex flex-wrap items-end gap-3">
        {/* Label */}
        <div className="flex items-center gap-2 self-end pb-2 mr-1">
          <SlidersHorizontal className="w-4 h-4 text-gray-400" />
          <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Filters</span>
        </div>

        {/* Date range picker */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Date Range</label>
          <DateRangePicker start={start} end={end} onApply={handleDateRange} />
        </div>

        {/* Divider */}
        <div className="self-end pb-2.5 text-gray-300 font-bold text-sm">vs.</div>

        {/* Compare mode */}
        <Select
          label="Compare to"
          value={compareMode}
          options={[
            { value: 'prev_period', label: 'Previous Period' },
            { value: 'prev_year',   label: 'Previous Year'   },
            { value: 'custom',      label: 'Custom Range'    },
          ]}
          onChange={(v) => handleCompareMode(v as CompareMode)}
        />

        {/* Custom comparison dates */}
        {compareMode === 'custom' && (
          <>
            <DateInput label="Comp From" value={customCompStart} onChange={(v) => { setCustomCompStart(v); }} />
            <DateInput label="Comp To"   value={customCompEnd}   onChange={(v) => { setCustomCompEnd(v); }} />
            <button
              onClick={() => apply()}
              className="self-end flex items-center gap-2 bg-brand-forest text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-brand-forest/90 transition-colors shadow-sm"
            >
              Apply
            </button>
          </>
        )}

        {/* Channel */}
        <Select
          label="Channel"
          value={channel}
          options={[
            { value: 'all',    label: 'All Channels' },
            { value: 'Google', label: 'Google Ads'   },
            { value: 'Meta',   label: 'Meta Ads'     },
          ]}
          onChange={handleChannel}
        />

        {/* Focus — overall page only */}
        {showFocus && (
          <Select
            label="Focus"
            value={focus}
            options={[
              { value: 'all',   label: 'All Segments' },
              { value: 'SMB',   label: 'SMB'          },
              { value: 'ABM',   label: 'ABM'          },
              { value: 'FD360', label: 'FD360'        },
            ]}
            onChange={handleFocus}
          />
        )}
      </div>

      {/* Comparison label */}
      {compareMode !== 'custom' && resolvedComp.compStart && (
        <p className="mt-2 ml-1 text-xs text-gray-400">
          Comparing{' '}
          <span className="font-semibold text-gray-500">{fmtDate(start)} – {fmtDate(end)}</span>
          {' '}vs.{' '}
          <span className="font-semibold text-gray-500">{fmtDate(resolvedComp.compStart)} – {fmtDate(resolvedComp.compEnd)}</span>
        </p>
      )}
    </div>
  );
}

export default function FilterBar(props: FilterBarProps) {
  return (
    <Suspense fallback={<FilterBarSkeleton />}>
      <FilterBarInner {...props} />
    </Suspense>
  );
}
