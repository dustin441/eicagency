'use client';

import React, { useMemo, useState } from 'react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
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

// ─── Conversion breakdown (drives the selection used everywhere else) ────────

function ConversionBreakdown({
  types, selected, onToggle, onSetMany, spendByChannel,
}: {
  types: AuritConversionType[];
  selected: ReadonlySet<string>;
  onToggle: (key: string) => void;
  onSetMany: (keys: string[], on: boolean) => void;
  spendByChannel: Record<AuritChannel, number>;
}) {
  const channels = (['Meta', 'Google'] as const).filter(channel => types.some(type => type.channel === channel));

  return (
    <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-700">Conversions by Type</h3>
          <p className="text-xs text-gray-400 mt-1">
            Check the conversion types to include. Totals, cost per conversion, the trend chart and the tables below all use this selection.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button type="button" onClick={() => onSetMany(types.map(t => t.key), true)} className="rounded-full border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-50">Select all</button>
          <button type="button" onClick={() => onSetMany(types.map(t => t.key), false)} className="rounded-full border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-50">Clear</button>
        </div>
      </div>

      {types.length === 0 ? (
        <p className="text-sm text-gray-400">No conversions recorded in this period.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">
                <th className="py-2 pr-3 w-8" />
                <th className="py-2 pr-3">Conversion Type</th>
                <th className="py-2 pr-3 text-right">Conversions</th>
                <th className="py-2 pr-3 text-right">Prior Period</th>
                <th className="py-2 pr-3 text-right">Change</th>
                <th className="py-2 text-right">Cost / Conversion</th>
              </tr>
            </thead>
            <tbody>
              {channels.map(channel => {
                const channelTypes = types.filter(type => type.channel === channel);
                const keys = channelTypes.map(type => type.key);
                const selectedTypes = channelTypes.filter(type => selected.has(type.key));
                const allOn = selectedTypes.length === channelTypes.length;
                const total = selectedTypes.reduce((sum, type) => sum + type.conversions, 0);
                const prevTotal = selectedTypes.reduce((sum, type) => sum + type.prevConversions, 0);
                return (
                  <React.Fragment key={channel}>
                    <tr className="bg-gray-50 border-b border-gray-100 font-semibold text-gray-900">
                      <td className="py-2.5 pr-3 pl-2">
                        <input
                          type="checkbox"
                          aria-label={`Include all ${channel} conversions`}
                          checked={allOn}
                          ref={el => { if (el) el.indeterminate = selectedTypes.length > 0 && !allOn; }}
                          onChange={() => onSetMany(keys, !allOn)}
                          className="accent-brand-forest"
                        />
                      </td>
                      <td className="py-2.5 pr-3">{channel} Conversions ({allOn ? 'All' : 'Selected'})</td>
                      <td className="py-2.5 pr-3 text-right">{fmtConv(total)}</td>
                      <td className="py-2.5 pr-3 text-right text-gray-500">{fmtConv(prevTotal)}</td>
                      <td className="py-2.5 pr-3 text-right"><DeltaBadge curr={total} prev={prevTotal} /></td>
                      <td className="py-2.5 text-right">{total > 0 ? fmtUsd2(spendByChannel[channel] / total) : '—'}</td>
                    </tr>
                    {channelTypes.map(type => (
                      <tr key={type.key} className={`border-b border-gray-50 ${selected.has(type.key) ? 'text-gray-700' : 'text-gray-300'}`}>
                        <td className="py-2 pr-3 pl-2">
                          <input
                            type="checkbox"
                            aria-label={`Include ${type.label}`}
                            checked={selected.has(type.key)}
                            onChange={() => onToggle(type.key)}
                            className="accent-brand-forest"
                          />
                        </td>
                        <td className="py-2 pr-3 pl-4">{type.label}</td>
                        <td className="py-2 pr-3 text-right font-medium">{fmtConv(type.conversions)}</td>
                        <td className="py-2 pr-3 text-right">{fmtConv(type.prevConversions)}</td>
                        <td className="py-2 pr-3 text-right"><DeltaBadge curr={type.conversions} prev={type.prevConversions} /></td>
                        <td className="py-2 text-right">{type.conversions > 0 ? fmtUsd2(spendByChannel[channel] / type.conversions) : '—'}</td>
                      </tr>
                    ))}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
          <p className="mt-3 text-xs text-gray-400">
            Cost per conversion per type uses the platform&apos;s total spend for the period. Google conversions include primary and secondary actions (All Conversions) and can be fractional due to data-driven attribution.
          </p>
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
  const { channelRows, conversionTypes, campaignRows, timeSeries, lastSyncedDate } = data;

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

  const spendByChannel: Record<AuritChannel, number> = { Meta: 0, Google: 0 };
  for (const row of channelRows) spendByChannel[row.channel] = row.spend;

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
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Aurit Mediation</h1>
          <p className="text-sm text-gray-500 mt-1">
            Meta and Google Ads performance{lastSyncedDate ? ` · Data through ${lastSyncedDate}` : ''}
          </p>
        </div>
        <FilterBar />
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-7">
        <KpiCard label="Spend" value={totals.spend} prev={totals.prevSpend} format={fmtUsd} />
        <KpiCard label="Impressions" value={totals.impressions} prev={totals.prevImpressions} format={fmtN} />
        <KpiCard label="Clicks" value={totals.clicks} prev={totals.prevClicks} format={fmtN} />
        <KpiCard label="CTR" value={ratio(totals.clicks, totals.impressions) * 100} prev={ratio(totals.prevClicks, totals.prevImpressions) * 100} format={fmtPct} />
        <KpiCard label="CPC" value={ratio(totals.spend, totals.clicks)} prev={ratio(totals.prevSpend, totals.prevClicks)} format={fmtUsd2} invert />
        <KpiCard label="Conversions" value={conversions} prev={prevConversions} format={fmtConv} />
        <KpiCard label="Cost / Conversion" value={ratio(costSpend, conversions)} prev={ratio(prevCostSpend, prevConversions)} format={fmtUsd2} invert highlight />
      </div>

      <ConversionBreakdown
        types={conversionTypes}
        selected={selected}
        onToggle={toggle}
        onSetMany={setMany}
        spendByChannel={spendByChannel}
      />

      <TrendChart points={trendPoints} />

      <ChannelTable rows={channelTableRows} />

      <CampaignTable rows={campaignTableRows} />
    </div>
  );
}
