'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import {
  TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp, CheckCircle2, AlertTriangle, ClipboardList,
} from 'lucide-react';
import type { AuritDashboardData } from '@/services/aurit-analytics';
import { sumSelected, type AuritChannel, type AuritConversionType } from '@/lib/aurit-metrics';
import FilterBar from '@/components/FilterBar';

// ─── helpers ─────────────────────────────────────────────────────────────────

function fmtUsd(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
function fmtUsd2(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtN(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
// Google reports fractional (data-driven attribution) conversions; show one decimal when needed.
function fmtConv(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: Number.isInteger(n) ? 0 : 1 });
}
function fmtPct(n: number) { return n.toFixed(2) + '%'; }
function ratio(a: number, b: number) { return b > 0 ? a / b : 0; }
function delta(curr: number, prev: number) {
  if (prev === 0) return null;
  return ((curr - prev) / prev) * 100;
}

// ─── sub-components ───────────────────────────────────────────────────────────

function DeltaBadge({ curr, prev, invert = false }: { curr: number; prev: number; invert?: boolean }) {
  const d = delta(curr, prev);
  if (d === null) return <span className="text-xs text-gray-300">—</span>;
  const positive = invert ? d < 0 : d > 0;
  const neutral = Math.abs(d) < 0.5;
  return (
    <span className={`inline-flex w-fit items-center gap-0.5 text-xs font-semibold px-1.5 py-0.5 rounded-full ${
      neutral ? 'bg-gray-100 text-gray-500' :
      positive ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'
    }`}>
      {neutral ? <Minus size={10} /> : positive ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
      {(d >= 0 ? '+' : '') + d.toFixed(1) + '%'}
    </span>
  );
}

function KpiCard({ label, value, prev, format, invert = false, highlight = false }: {
  label: string; value: number; prev: number; format: (n: number) => string; invert?: boolean; highlight?: boolean;
}) {
  return (
    <div className={`rounded-xl border shadow-sm p-5 flex flex-col gap-2 ${highlight ? 'bg-emerald-50 border-emerald-100' : 'bg-white border-gray-100'}`}>
      <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">{label}</p>
      <p className="text-2xl font-bold text-gray-900">{format(value)}</p>
      <DeltaBadge curr={value} prev={prev} invert={invert} />
    </div>
  );
}

function ChannelBadge({ channel }: { channel: AuritChannel }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
      channel === 'Meta' ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'
    }`}>
      {channel}
    </span>
  );
}

// ─── Conversion filter (multi-select next to the channel filter) ────────────

function ConversionFilter({
  types, selected, onToggle, onSetMany,
}: {
  types: AuritConversionType[];
  selected: ReadonlySet<string>;
  onToggle: (key: string) => void;
  onSetMany: (keys: string[], on: boolean) => void;
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

  const channels = (['Meta', 'Google'] as const).filter(channel => types.some(type => type.channel === channel));
  const selectedCount = types.filter(type => selected.has(type.key)).length;
  const buttonLabel = types.length === 0
    ? 'No conversions'
    : selectedCount === types.length
      ? 'All Conversions'
      : selectedCount === 0
        ? 'None selected'
        : selectedCount === 1
          ? types.find(type => selected.has(type.key))!.label
          : `${selectedCount} of ${types.length} selected`;

  return (
    <div ref={ref} className="flex flex-col gap-1">
      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Conversions</label>
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen(value => !value)}
          disabled={types.length === 0}
          className={`flex items-center gap-2 border rounded-xl px-3 py-2 text-sm font-semibold transition-all max-w-[240px] disabled:opacity-50 ${
            open ? 'bg-brand-forest text-white border-brand-forest shadow-sm' : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100 hover:border-gray-300'
          }`}
        >
          <span className="truncate">{buttonLabel}</span>
          <ChevronDown className={`w-3.5 h-3.5 shrink-0 transition-transform ${open ? 'rotate-180 text-white' : 'text-gray-400'}`} />
        </button>

        {open && (
          <div className="absolute top-full left-0 mt-2 z-50 bg-white rounded-2xl border border-gray-100 shadow-2xl overflow-hidden w-[min(340px,calc(100vw-2rem))]">
            <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-gray-100">
              <span className="text-xs text-gray-400">Counts for the selected period</span>
              <div className="flex gap-3">
                <button type="button" onClick={() => onSetMany(types.map(t => t.key), true)} className="text-xs font-semibold text-brand-forest hover:underline">All</button>
                <button type="button" onClick={() => onSetMany(types.map(t => t.key), false)} className="text-xs font-semibold text-gray-500 hover:underline">Clear</button>
              </div>
            </div>
            <div className="max-h-[360px] overflow-y-auto py-1">
              {channels.map(channel => {
                const channelTypes = types.filter(type => type.channel === channel);
                const keys = channelTypes.map(type => type.key);
                const onCount = channelTypes.filter(type => selected.has(type.key)).length;
                const allOn = onCount === channelTypes.length;
                return (
                  <div key={channel} className="py-1">
                    <label className="flex items-center gap-2 px-3 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={allOn}
                        ref={el => { if (el) el.indeterminate = onCount > 0 && !allOn; }}
                        onChange={() => onSetMany(keys, !allOn)}
                        className="accent-brand-forest"
                      />
                      <span className="flex-1">{channel} Conversions (All)</span>
                      <span className="text-xs text-gray-400">{fmtConv(channelTypes.reduce((sum, type) => sum + type.conversions, 0))}</span>
                    </label>
                    {channelTypes.map(type => (
                      <label key={type.key} className="flex items-center gap-2 pl-8 pr-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selected.has(type.key)}
                          onChange={() => onToggle(type.key)}
                          className="accent-brand-forest"
                        />
                        <span className="flex-1 truncate" title={type.label}>{type.label}</span>
                        <span className="text-xs text-gray-400">{fmtConv(type.conversions)}</span>
                      </label>
                    ))}
                  </div>
                );
              })}
            </div>
            <p className="px-3 py-2 border-t border-gray-100 text-[11px] leading-4 text-gray-400">
              Google counts include primary and secondary actions and can be fractional (data-driven attribution).
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Weekly executive summary ────────────────────────────────────────────────

function ReadoutColumn({ title, items, icon }: { title: string; items: string[]; icon: React.ReactNode }) {
  if (!items.length) return null;
  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
      <div className="flex items-center gap-2 text-sm font-bold text-gray-900">
        {icon}
        {title}
      </div>
      <ul className="mt-3 space-y-2">
        {items.map((item, index) => (
          <li key={`${title}-${index}`} className="text-sm leading-6 text-gray-600">{item}</li>
        ))}
      </ul>
    </div>
  );
}

function WeeklyExecutiveSummary({ readout }: { readout: AuritDashboardData['weeklyReadout'] }) {
  const [expanded, setExpanded] = useState(false);

  if (!readout) {
    return (
      <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Weekly Executive Summary</h3>
        <p className="text-sm text-gray-400">No weekly executive summary yet. It will appear here once published.</p>
      </section>
    );
  }

  return (
    <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Weekly Executive Summary</p>
          <h2 className="mt-2 text-xl font-bold text-gray-900">Aurit Mediation</h2>
          <p className="mt-1 text-xs font-medium text-gray-400">{readout.periodStart} - {readout.periodEnd}</p>
        </div>
        <button
          type="button"
          onClick={() => setExpanded(value => !value)}
          className="inline-flex w-fit items-center gap-2 rounded-full border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 transition-colors hover:border-gray-300 hover:bg-gray-50"
        >
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          {expanded ? 'Hide details' : 'Show details'}
        </button>
      </div>

      {readout.overallStory && (
        <p className="mt-5 max-w-5xl text-sm leading-7 text-gray-700">{readout.overallStory}</p>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <ReadoutColumn title="Wins" items={readout.wins} icon={<CheckCircle2 size={16} className="text-emerald-600" />} />
        <ReadoutColumn title="Opportunities" items={readout.opportunities} icon={<AlertTriangle size={16} className="text-amber-500" />} />
        <ReadoutColumn title="Next Week" items={readout.focusNextWeek} icon={<ClipboardList size={16} className="text-brand-orange" />} />
      </div>

      {expanded && (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <ReadoutColumn title="Accomplishments" items={readout.accomplishments} icon={<CheckCircle2 size={16} className="text-brand-forest" />} />
          <ReadoutColumn title="Context" items={readout.executionContext} icon={<ClipboardList size={16} className="text-gray-500" />} />
        </div>
      )}
    </section>
  );
}

// ─── Trend chart ─────────────────────────────────────────────────────────────

function TrendChart({ points }: { points: { label: string; spend: number; conversions: number }[] }) {
  if (points.length === 0) {
    return (
      <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Spend vs. Conversions</h3>
        <p className="text-sm text-gray-400">No data for this period.</p>
      </section>
    );
  }
  return (
    <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">Spend vs. Conversions</h3>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={points} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={v => String(v).slice(5)} />
            <YAxis yAxisId="spend" tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={v => fmtUsd(Number(v))} width={70} />
            <YAxis yAxisId="conv" orientation="right" tick={{ fontSize: 11, fill: '#94a3b8' }} allowDecimals={false} width={40} />
            <Tooltip
              formatter={(value, name) => (name === 'Spend' ? fmtUsd2(Number(value)) : fmtConv(Number(value)))}
              labelStyle={{ fontWeight: 600 }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar yAxisId="spend" dataKey="spend" name="Spend" fill="#0B4A31" opacity={0.85} radius={[3, 3, 0, 0]} />
            <Line yAxisId="conv" type="monotone" dataKey="conversions" name="Conversions (selected)" stroke="#EB541E" strokeWidth={2} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

// ─── Tables ──────────────────────────────────────────────────────────────────

const TH = 'py-2 pr-3 text-xs font-semibold uppercase tracking-wider text-gray-400';

function ChannelTable({ rows }: { rows: { channel: AuritChannel; spend: number; prevSpend: number; impressions: number; clicks: number; conversions: number; prevConversions: number }[] }) {
  return (
    <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">Channel Breakdown</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left">
              <th className={TH}>Channel</th>
              <th className={`${TH} text-right`}>Spend</th>
              <th className={`${TH} text-right`}>Impressions</th>
              <th className={`${TH} text-right`}>Clicks</th>
              <th className={`${TH} text-right`}>CTR</th>
              <th className={`${TH} text-right`}>Conversions</th>
              <th className={`${TH} text-right`}>Cost / Conversion</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.channel} className="border-b border-gray-50 text-gray-700">
                <td className="py-2.5 pr-3"><ChannelBadge channel={row.channel} /></td>
                <td className="py-2.5 pr-3 text-right font-medium">{fmtUsd(row.spend)} <span className="ml-1"><DeltaBadge curr={row.spend} prev={row.prevSpend} /></span></td>
                <td className="py-2.5 pr-3 text-right">{fmtN(row.impressions)}</td>
                <td className="py-2.5 pr-3 text-right">{fmtN(row.clicks)}</td>
                <td className="py-2.5 pr-3 text-right">{fmtPct(ratio(row.clicks, row.impressions) * 100)}</td>
                <td className="py-2.5 pr-3 text-right font-medium">{fmtConv(row.conversions)} <span className="ml-1"><DeltaBadge curr={row.conversions} prev={row.prevConversions} /></span></td>
                <td className="py-2.5 text-right">{row.conversions > 0 ? fmtUsd2(row.spend / row.conversions) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

const CAMPAIGN_PAGE_SIZE = 25;

function CampaignTable({ rows }: { rows: { key: string; campaign: string; channel: AuritChannel; campaignType: string | null; spend: number; impressions: number; clicks: number; conversions: number; prevConversions: number }[] }) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? rows : rows.slice(0, CAMPAIGN_PAGE_SIZE);
  return (
    <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">Campaign Performance</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-gray-400">No campaign activity in this period.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left">
                <th className={TH}>Campaign</th>
                <th className={TH}>Channel</th>
                <th className={`${TH} text-right`}>Spend</th>
                <th className={`${TH} text-right`}>Impressions</th>
                <th className={`${TH} text-right`}>Clicks</th>
                <th className={`${TH} text-right`}>CTR</th>
                <th className={`${TH} text-right`}>Conversions</th>
                <th className={`${TH} text-right`}>Cost / Conversion</th>
              </tr>
            </thead>
            <tbody>
              {visible.map(row => (
                <tr key={row.key} className="border-b border-gray-50 text-gray-700">
                  <td className="py-2.5 pr-3 max-w-xs">
                    <p className="font-medium text-gray-900 truncate" title={row.campaign}>{row.campaign}</p>
                    {row.campaignType && <p className="text-xs text-gray-400">{row.campaignType.replaceAll('_', ' ').toLowerCase()}</p>}
                  </td>
                  <td className="py-2.5 pr-3"><ChannelBadge channel={row.channel} /></td>
                  <td className="py-2.5 pr-3 text-right font-medium">{fmtUsd2(row.spend)}</td>
                  <td className="py-2.5 pr-3 text-right">{fmtN(row.impressions)}</td>
                  <td className="py-2.5 pr-3 text-right">{fmtN(row.clicks)}</td>
                  <td className="py-2.5 pr-3 text-right">{fmtPct(ratio(row.clicks, row.impressions) * 100)}</td>
                  <td className="py-2.5 pr-3 text-right">{fmtConv(row.conversions)} <span className="ml-1"><DeltaBadge curr={row.conversions} prev={row.prevConversions} /></span></td>
                  <td className="py-2.5 text-right">{row.conversions > 0 ? fmtUsd2(row.spend / row.conversions) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length > CAMPAIGN_PAGE_SIZE && (
            <button type="button" onClick={() => setShowAll(v => !v)} className="mt-4 text-xs font-semibold text-brand-forest hover:underline">
              {showAll ? 'Show top 25' : `Show all ${rows.length} campaigns`}
            </button>
          )}
        </div>
      )}
    </section>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function AuritDashboardClient({ data }: { data: AuritDashboardData }) {
  const { channelRows, conversionTypes, campaignRows, timeSeries, lastSyncedDate, weeklyReadout } = data;

  // Unchecked types are tracked (not checked ones) so new types appear selected by default.
  const [excluded, setExcluded] = useState<ReadonlySet<string>>(new Set());
  const selected = useMemo(
    () => new Set(conversionTypes.map(type => type.key).filter(key => !excluded.has(key))),
    [conversionTypes, excluded],
  );
  const toggle = (key: string) => setExcluded(prev => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });
  const setMany = (keys: string[], on: boolean) => setExcluded(prev => {
    const next = new Set(prev);
    for (const key of keys) { if (on) next.delete(key); else next.add(key); }
    return next;
  });

  const totals = channelRows.reduce(
    (acc, row) => ({
      spend: acc.spend + row.spend, prevSpend: acc.prevSpend + row.prevSpend,
      impressions: acc.impressions + row.impressions, prevImpressions: acc.prevImpressions + row.prevImpressions,
      clicks: acc.clicks + row.clicks, prevClicks: acc.prevClicks + row.prevClicks,
    }),
    { spend: 0, prevSpend: 0, impressions: 0, prevImpressions: 0, clicks: 0, prevClicks: 0 },
  );
  const selectedTypes = conversionTypes.filter(type => selected.has(type.key));
  const conversions = selectedTypes.reduce((sum, type) => sum + type.conversions, 0);
  const prevConversions = selectedTypes.reduce((sum, type) => sum + type.prevConversions, 0);
  // Cost per conversion only counts spend from channels that have a selected type,
  // so a Google-only selection is not inflated by Meta spend.
  const costChannels = channelRows.filter(row => selectedTypes.some(type => type.channel === row.channel));
  const costSpend = costChannels.reduce((sum, row) => sum + row.spend, 0);
  const prevCostSpend = costChannels.reduce((sum, row) => sum + row.prevSpend, 0);

  const channelTableRows = channelRows.map(row => {
    const types = selectedTypes.filter(type => type.channel === row.channel);
    return {
      ...row,
      conversions: types.reduce((sum, type) => sum + type.conversions, 0),
      prevConversions: types.reduce((sum, type) => sum + type.prevConversions, 0),
    };
  });
  const campaignTableRows = campaignRows.map(row => ({
    ...row,
    conversions: sumSelected(row.conversionsByType, selected),
    prevConversions: sumSelected(row.prevConversionsByType, selected),
  }));
  const trendPoints = timeSeries.map(point => ({
    label: point.label,
    spend: point.spend,
    conversions: sumSelected(point.conversionsByType, selected),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Aurit Mediation</h1>
        <p className="text-sm text-gray-500 mt-1">
          Meta and Google Ads performance{lastSyncedDate ? ` · Data through ${lastSyncedDate}` : ''}
        </p>
      </div>

      <FilterBar
        extraFilters={
          <ConversionFilter types={conversionTypes} selected={selected} onToggle={toggle} onSetMany={setMany} />
        }
      />

      <WeeklyExecutiveSummary readout={weeklyReadout} />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-7">
        <KpiCard label="Spend" value={totals.spend} prev={totals.prevSpend} format={fmtUsd} />
        <KpiCard label="Impressions" value={totals.impressions} prev={totals.prevImpressions} format={fmtN} />
        <KpiCard label="Clicks" value={totals.clicks} prev={totals.prevClicks} format={fmtN} />
        <KpiCard label="CTR" value={ratio(totals.clicks, totals.impressions) * 100} prev={ratio(totals.prevClicks, totals.prevImpressions) * 100} format={fmtPct} />
        <KpiCard label="CPC" value={ratio(totals.spend, totals.clicks)} prev={ratio(totals.prevSpend, totals.prevClicks)} format={fmtUsd2} invert />
        <KpiCard label="Conversions" value={conversions} prev={prevConversions} format={fmtConv} />
        <KpiCard label="Cost / Conversion" value={ratio(costSpend, conversions)} prev={ratio(prevCostSpend, prevConversions)} format={fmtUsd2} invert highlight />
      </div>

      <TrendChart points={trendPoints} />

      <ChannelTable rows={channelTableRows} />

      <CampaignTable rows={campaignTableRows} />
    </div>
  );
}
