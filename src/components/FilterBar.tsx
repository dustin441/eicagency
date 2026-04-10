'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Calendar, ChevronDown, SlidersHorizontal, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Date helpers ─────────────────────────────────────────────────────────────

function today() { return new Date().toISOString().split('T')[0]; }
function firstOfMonth() { return `${today().slice(0, 7)}-01`; }

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
  // prev_period: same span, ending the day before start
  const span = daysBetween(start, end);
  const compEnd = addDays(start, -1);
  const compStart = addDays(compEnd, -span);
  return { compStart, compEnd };
}

function fmtDate(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

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

function DateInput({
  label, value, onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
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
  /** When true, renders the Focus dropdown (All / SMB / ABM / FD360) */
  showFocus?: boolean;
}

export default function FilterBar({ showFocus = false }: FilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // ── Read initial values from URL (with defaults) ───────────────────────────
  const [start, setStart] = useState(searchParams.get('start') ?? firstOfMonth());
  const [end, setEnd] = useState(searchParams.get('end') ?? today());
  const [compareMode, setCompareMode] = useState<CompareMode>(
    (searchParams.get('compare') as CompareMode | null) ?? 'prev_period'
  );
  const [customCompStart, setCustomCompStart] = useState(searchParams.get('comp_start') ?? '');
  const [customCompEnd, setCustomCompEnd] = useState(searchParams.get('comp_end') ?? '');
  const [channel, setChannel] = useState(searchParams.get('channel') ?? 'all');
  const [focus, setFocus] = useState(searchParams.get('focus') ?? 'all');
  const [dirty, setDirty] = useState(false);

  // Keep local state in sync with URL (e.g. browser back/forward)
  useEffect(() => {
    setStart(searchParams.get('start') ?? firstOfMonth());
    setEnd(searchParams.get('end') ?? today());
    setCompareMode((searchParams.get('compare') as CompareMode | null) ?? 'prev_period');
    setCustomCompStart(searchParams.get('comp_start') ?? '');
    setCustomCompEnd(searchParams.get('comp_end') ?? '');
    setChannel(searchParams.get('channel') ?? 'all');
    setFocus(searchParams.get('focus') ?? 'all');
    setDirty(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.toString()]);

  // ── Resolve comparison dates ───────────────────────────────────────────────
  const resolvedComp = compareMode === 'custom'
    ? { compStart: customCompStart, compEnd: customCompEnd }
    : computeCompDates(start, end, compareMode);

  // ── Build and push URL ────────────────────────────────────────────────────
  const buildParams = useCallback(
    (overrides: Partial<{
      start: string; end: string; compareMode: CompareMode;
      customCompStart: string; customCompEnd: string;
      channel: string; focus: string;
    }> = {}) => {
      const s      = overrides.start          ?? start;
      const e      = overrides.end            ?? end;
      const cm     = overrides.compareMode    ?? compareMode;
      const ccs    = overrides.customCompStart ?? customCompStart;
      const cce    = overrides.customCompEnd   ?? customCompEnd;
      const ch     = overrides.channel        ?? channel;
      const fo     = overrides.focus          ?? focus;

      const comp = cm === 'custom'
        ? { compStart: ccs, compEnd: cce }
        : computeCompDates(s, e, cm);

      return new URLSearchParams({
        start: s, end: e,
        comp_start: comp.compStart,
        comp_end:   comp.compEnd,
        channel: ch,
        focus:   fo,
        compare: cm,
      });
    },
    [start, end, compareMode, customCompStart, customCompEnd, channel, focus]
  );

  const apply = useCallback((overrides = {}) => {
    const params = buildParams(overrides);
    router.push(`${pathname}?${params.toString()}`);
    setDirty(false);
  }, [buildParams, pathname, router]);

  // ── Immediate-apply handlers (channel, focus) ─────────────────────────────
  const handleChannel = (v: string) => {
    setChannel(v);
    apply({ channel: v });
  };
  const handleFocus = (v: string) => {
    setFocus(v);
    apply({ focus: v });
  };

  // Compare mode change auto-applies (preset modes)
  const handleCompareMode = (v: CompareMode) => {
    setCompareMode(v);
    if (v !== 'custom') {
      apply({ compareMode: v });
    } else {
      // Just update local state for custom — user fills in dates then hits Apply
      setDirty(true);
    }
  };

  // Date changes mark dirty
  const handleStart = (v: string) => { setStart(v); setDirty(true); };
  const handleEnd   = (v: string) => { setEnd(v);   setDirty(true); };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <div className="flex flex-wrap items-end gap-3">
        {/* Icon */}
        <div className="flex items-center gap-2 self-end pb-2 mr-1">
          <SlidersHorizontal className="w-4 h-4 text-gray-400" />
          <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Filters</span>
        </div>

        {/* Current period */}
        <DateInput label="From" value={start} onChange={handleStart} />
        <DateInput label="To"   value={end}   onChange={handleEnd} />

        {/* Divider */}
        <div className="self-end pb-2.5 text-gray-300 font-bold text-sm">vs.</div>

        {/* Compare mode */}
        <Select
          label="Compare to"
          value={compareMode}
          options={[
            { value: 'prev_period', label: 'Previous Period' },
            { value: 'prev_year',   label: 'Previous Year' },
            { value: 'custom',      label: 'Custom Range' },
          ]}
          onChange={(v) => handleCompareMode(v as CompareMode)}
        />

        {/* Custom comparison dates — only visible when compareMode = custom */}
        {compareMode === 'custom' && (
          <>
            <DateInput label="Comp From" value={customCompStart} onChange={(v) => { setCustomCompStart(v); setDirty(true); }} />
            <DateInput label="Comp To"   value={customCompEnd}   onChange={(v) => { setCustomCompEnd(v);   setDirty(true); }} />
          </>
        )}

        {/* Channel */}
        <Select
          label="Channel"
          value={channel}
          options={[
            { value: 'all',    label: 'All Channels' },
            { value: 'Google', label: 'Google Ads' },
            { value: 'Meta',   label: 'Meta Ads' },
          ]}
          onChange={handleChannel}
        />

        {/* Focus — overall page only */}
        {showFocus && (
          <Select
            label="Focus"
            value={focus}
            options={[
              { value: 'all',  label: 'All Segments' },
              { value: 'SMB',  label: 'SMB' },
              { value: 'ABM',  label: 'ABM' },
              { value: 'FD360', label: 'FD360' },
            ]}
            onChange={handleFocus}
          />
        )}

        {/* Apply button — shows when date fields are dirty */}
        {dirty && (
          <button
            onClick={() => apply()}
            className="self-end flex items-center gap-2 bg-brand-forest text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-brand-forest/90 transition-colors shadow-sm"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Apply
          </button>
        )}
      </div>

      {/* Comparison period label */}
      {compareMode !== 'custom' && resolvedComp.compStart && (
        <p className="mt-2 ml-1 text-xs text-gray-400">
          Comparing <span className="font-semibold text-gray-500">{fmtDate(start)} – {fmtDate(end)}</span>
          {' '}vs.{' '}
          <span className="font-semibold text-gray-500">{fmtDate(resolvedComp.compStart)} – {fmtDate(resolvedComp.compEnd)}</span>
        </p>
      )}
    </div>
  );
}
