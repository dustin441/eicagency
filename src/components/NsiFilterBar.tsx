'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Calendar, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  fmtDate,
  fmtDateShort,
  detectPreset,
  getPresetDates,
  PRESETS,
  computeCompDates,
  type PresetKey,
} from '@/lib/date-utils';
import type { NsiFilterParams } from '@/services/nsi-analytics';

type CompMode = NsiFilterParams['compMode'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function resolveComp(
  s: string,
  e: string,
  mode: CompMode,
  customCs: string,
  customCe: string
): { compStart: string; compEnd: string } {
  if (mode === 'custom') return { compStart: customCs, compEnd: customCe };
  return computeCompDates(s, e, mode === 'prev_year' ? 'prev_year' : 'prev_period');
}

// ─── Generic Select ───────────────────────────────────────────────────────────

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
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <ChevronDown className="w-3.5 h-3.5 text-gray-400 pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" />
      </div>
    </div>
  );
}

// ─── Date Range Picker (with built-in Compare To) ─────────────────────────────

const COMP_MODES: { value: CompMode; label: string }[] = [
  { value: 'prev_period', label: 'Prev Period' },
  { value: 'prev_year',   label: 'Prev Year' },
  { value: 'custom',      label: 'Custom' },
];

function DateRangePicker({
  start,
  end,
  compMode,
  compStart,
  compEnd,
  onApply,
}: {
  start: string;
  end: string;
  compMode: CompMode;
  compStart: string;
  compEnd: string;
  onApply: (start: string, end: string, compMode: CompMode, compStart: string, compEnd: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [activePreset, setActivePreset] = useState<PresetKey>(() => detectPreset(start, end));
  const [customStart, setCustomStart] = useState(start);
  const [customEnd, setCustomEnd] = useState(end);
  const [localCompMode, setLocalCompMode] = useState<CompMode>(compMode);
  const [customCompStart, setCustomCompStart] = useState(compStart);
  const [customCompEnd, setCustomCompEnd] = useState(compEnd);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setActivePreset(detectPreset(start, end));
    setCustomStart(start);
    setCustomEnd(end);
  }, [start, end]);

  useEffect(() => {
    setLocalCompMode(compMode);
    setCustomCompStart(compStart);
    setCustomCompEnd(compEnd);
  }, [compMode, compStart, compEnd]);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  function commit(s: string, e: string, mode: CompMode, cs: string, ce: string) {
    onApply(s, e, mode, cs, ce);
    setOpen(false);
  }

  function handlePreset(key: PresetKey) {
    setActivePreset(key);
    if (key === 'custom') return;
    const dates = getPresetDates(key)!;
    setCustomStart(dates.start);
    setCustomEnd(dates.end);
    const comp = resolveComp(dates.start, dates.end, localCompMode, customCompStart, customCompEnd);
    commit(dates.start, dates.end, localCompMode, comp.compStart, comp.compEnd);
  }

  function handleCompModeChange(mode: CompMode) {
    setLocalCompMode(mode);
    if (mode !== 'custom') {
      const s = customStart || start;
      const e = customEnd || end;
      const comp = computeCompDates(s, e, mode === 'prev_year' ? 'prev_year' : 'prev_period');
      setCustomCompStart(comp.compStart);
      setCustomCompEnd(comp.compEnd);
    }
  }

  const buttonLabel =
    activePreset !== 'custom'
      ? (PRESETS.find((p) => p.key === activePreset)?.label ?? `${fmtDateShort(start)} – ${fmtDateShort(end)}`)
      : `${fmtDateShort(start)} – ${fmtDateShort(end)}`;

  return (
    <div ref={ref} className="relative">
      <div className="flex flex-col gap-1">
        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Date Range</label>
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm font-semibold text-gray-700 hover:border-gray-300 transition-colors"
        >
          <Calendar className="w-3.5 h-3.5 text-gray-400" />
          {buttonLabel}
          <ChevronDown className={cn('w-3.5 h-3.5 text-gray-400 transition-transform ml-1', open && 'rotate-180')} />
        </button>
      </div>

      {open && (
        <div className="absolute top-full left-0 mt-2 z-50 bg-white rounded-2xl shadow-xl border border-gray-100 p-4 w-[300px]">

          {/* Primary range — presets */}
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Date Range</p>
          <div className="grid grid-cols-2 gap-1">
            {PRESETS.filter((p) => p.key !== 'custom').map((p) => (
              <button
                key={p.key}
                onClick={() => handlePreset(p.key)}
                className={cn(
                  'text-left px-3 py-1.5 rounded-lg text-sm transition-colors',
                  activePreset === p.key
                    ? 'bg-brand-forest text-white font-semibold'
                    : 'hover:bg-gray-50 text-gray-700'
                )}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Primary range — custom */}
          <div className="border-t border-gray-100 mt-3 pt-3">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Custom Range</p>
            <div className="flex gap-2 items-center">
              <input
                type="date"
                value={customStart}
                onChange={(e) => { setCustomStart(e.target.value); setActivePreset('custom'); }}
                className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-forest/20"
              />
              <span className="text-gray-400 text-xs">–</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => { setCustomEnd(e.target.value); setActivePreset('custom'); }}
                className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-forest/20"
              />
            </div>
            <button
              onClick={() => {
                if (customStart && customEnd) {
                  const comp = resolveComp(customStart, customEnd, localCompMode, customCompStart, customCompEnd);
                  commit(customStart, customEnd, localCompMode, comp.compStart, comp.compEnd);
                }
              }}
              className="mt-2 w-full bg-brand-forest text-white text-sm font-semibold py-1.5 rounded-lg hover:bg-brand-forest/90 transition-colors"
            >
              Apply Range
            </button>
          </div>

          {/* Compare To */}
          <div className="border-t border-gray-100 mt-3 pt-3">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Compare To</p>
            <div className="flex gap-1">
              {COMP_MODES.map((m) => (
                <button
                  key={m.value}
                  onClick={() => handleCompModeChange(m.value)}
                  className={cn(
                    'flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold transition-all',
                    localCompMode === m.value
                      ? 'bg-brand-forest text-white'
                      : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                  )}
                >
                  {m.label}
                </button>
              ))}
            </div>
            {localCompMode === 'custom' ? (
              <>
                <div className="flex gap-2 items-center mt-2">
                  <input
                    type="date"
                    value={customCompStart}
                    onChange={(e) => setCustomCompStart(e.target.value)}
                    className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-forest/20"
                  />
                  <span className="text-gray-400 text-xs">–</span>
                  <input
                    type="date"
                    value={customCompEnd}
                    onChange={(e) => setCustomCompEnd(e.target.value)}
                    className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-forest/20"
                  />
                </div>
                <button
                  onClick={() => {
                    if (customCompStart && customCompEnd) {
                      commit(start, end, 'custom', customCompStart, customCompEnd);
                    }
                  }}
                  className="mt-2 w-full bg-brand-forest text-white text-sm font-semibold py-1.5 rounded-lg hover:bg-brand-forest/90 transition-colors"
                >
                  Apply Comparison
                </button>
              </>
            ) : (
              <p className="text-xs text-gray-400 mt-1.5">
                {customCompStart && customCompEnd
                  ? `${fmtDateShort(customCompStart)} – ${fmtDateShort(customCompEnd)}`
                  : '—'}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Filter Bar ───────────────────────────────────────────────────────────────

export default function NsiFilterBar({
  params,
  channels,
  torpedoes,
  campaigns,
}: {
  params: NsiFilterParams;
  channels: string[];
  torpedoes: string[];
  campaigns: string[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function update(changes: Record<string, string>) {
    const next = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(changes)) {
      if (v === 'all' || v === '') {
        next.delete(k);
      } else {
        next.set(k, v);
      }
    }
    router.push(`?${next.toString()}`);
  }

  const handleDateApply = (
    start: string,
    end: string,
    compMode: CompMode,
    compStart: string,
    compEnd: string
  ) => {
    update({ start, end, comp_start: compStart, comp_end: compEnd, comp_mode: compMode });
  };

  const channelOptions = [
    { value: 'all', label: 'All Channels' },
    ...channels.map((c) => ({ value: c, label: c })),
  ];

  const torpedoOptions = [
    { value: 'all', label: 'All Torpedoes' },
    ...torpedoes.map((t) => ({ value: t, label: t })),
  ];

  const campaignOptions = [
    { value: 'all', label: 'All Campaigns' },
    ...campaigns.map((c) => ({ value: c, label: c })),
  ];

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex flex-wrap items-end gap-4 mb-6">
      <DateRangePicker
        start={params.start}
        end={params.end}
        compMode={params.compMode}
        compStart={params.compStart}
        compEnd={params.compEnd}
        onApply={handleDateApply}
      />
      <div className="flex flex-col gap-1">
        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Compare Period</label>
        <div className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm font-semibold text-gray-700 whitespace-nowrap">
          {fmtDate(params.compStart)} – {fmtDate(params.compEnd)}
        </div>
      </div>
      <Select
        label="Channel"
        value={params.channel}
        options={channelOptions}
        onChange={(v) => update({ channel: v })}
      />
      <Select
        label="Torpedo"
        value={params.torpedo}
        options={torpedoOptions}
        onChange={(v) => update({ torpedo: v })}
      />
      <Select
        label="Campaign"
        value={params.campaign}
        options={campaignOptions}
        onChange={(v) => update({ campaign: v })}
      />
    </div>
  );
}
