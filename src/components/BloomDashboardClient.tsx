'use client';

import React, { useState } from 'react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp } from 'lucide-react';
import type { BloomDashboardData } from '@/services/bloom-analytics';
import FilterBar from '@/components/FilterBar';
import { MetaAdPreviews } from '@/components/AdPreviews';

// ─── helpers ────────────────────────────────────────────────────────────────

function fmt$(n: number) {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
function fmtN(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
function fmtPct(n: number) {
  return n.toFixed(2) + '%';
}
function delta(curr: number, prev: number) {
  if (prev === 0) return null;
  return ((curr - prev) / prev) * 100;
}
function fmtDelta(d: number | null) {
  if (d === null) return null;
  return (d >= 0 ? '+' : '') + d.toFixed(1) + '%';
}

// ─── sub-components ──────────────────────────────────────────────────────────

function DeltaBadge({ curr, prev, invert = false }: { curr: number; prev: number; invert?: boolean }) {
  const d = delta(curr, prev);
  if (d === null) return null;
  const positive = invert ? d < 0 : d > 0;
  const neutral = Math.abs(d) < 0.5;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-semibold px-1.5 py-0.5 rounded-full ${
      neutral ? 'bg-gray-100 text-gray-500' :
      positive ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'
    }`}>
      {neutral ? <Minus size={10} /> : positive ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
      {fmtDelta(d)}
    </span>
  );
}

function KpiCard({
  label, value, prev, format, invert = false,
}: {
  label: string; value: number; prev: number;
  format: (n: number) => string; invert?: boolean;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex flex-col gap-2">
      <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">{label}</p>
      <p className="text-2xl font-bold text-gray-900">{format(value)}</p>
      <DeltaBadge curr={value} prev={prev} invert={invert} />
    </div>
  );
}

// ─── Trend Chart ─────────────────────────────────────────────────────────────

function TrendChart({ timeSeries }: { timeSeries: BloomDashboardData['timeSeries'] }) {
  if (timeSeries.length === 0) return null;

  const tickFormatter = (label: string) => {
    const d = new Date(label + 'T00:00:00Z');
    return (d.getMonth() + 1) + '/' + d.getDate();
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">Spend &amp; Leads Over Time</h3>
      <ResponsiveContainer width="100%" height={240}>
        <ComposedChart data={timeSeries} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
          <XAxis dataKey="label" tickFormatter={tickFormatter} tick={{ fontSize: 11, fill: '#9ca3af' }} tickLine={false} axisLine={false} />
          <YAxis yAxisId="spend" orientation="left" tickFormatter={(v) => '$' + (v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v)} tick={{ fontSize: 11, fill: '#9ca3af' }} tickLine={false} axisLine={false} width={48} />
          <YAxis yAxisId="leads" orientation="right" tick={{ fontSize: 11, fill: '#9ca3af' }} tickLine={false} axisLine={false} width={32} />
          <Tooltip
            formatter={(value, name) =>
              name === 'spend' ? [fmt$(Number(value)), 'Spend'] : [fmtN(Number(value)), 'Leads']
            }
            labelFormatter={(label) => {
              const d = new Date(label + 'T00:00:00Z');
              return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            }}
            contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12 }}
          />
          <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
          <Bar yAxisId="spend" dataKey="spend" name="Spend" fill="#0B4A31" opacity={0.85} radius={[2, 2, 0, 0]} />
          <Line yAxisId="leads" dataKey="leads" name="Leads" stroke="#EB541E" strokeWidth={2} dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Campaign Table ───────────────────────────────────────────────────────────

function CampaignTable({ rows }: { rows: BloomDashboardData['campaignRows'] }) {
  if (rows.length === 0) return null;

  const cols = [
    { key: 'campaign' as const, label: 'Campaign', numeric: false, fmt: (v: string) => v },
    { key: 'spend' as const, label: 'Spend', numeric: true, fmt: fmt$ },
    { key: 'impressions' as const, label: 'Impr.', numeric: true, fmt: fmtN },
    { key: 'clicks' as const, label: 'Clicks', numeric: true, fmt: fmtN },
    { key: 'ctr' as const, label: 'CTR', numeric: true, fmt: fmtPct },
    { key: 'leads' as const, label: 'Leads', numeric: true, fmt: fmtN },
    { key: 'costPerLead' as const, label: 'CPL', numeric: true, fmt: fmt$ },
  ];

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-700">Campaign Performance</h3>
        <p className="text-xs text-gray-400 mt-0.5">Top 25 by spend</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/50">
              {cols.map(c => (
                <th key={c.key} className={`px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider ${c.numeric ? 'text-right' : 'text-left'}`}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {rows.map((row, i) => (
              <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                {cols.map(c => (
                  <td key={c.key} className={`px-4 py-3 text-gray-700 ${c.numeric ? 'text-right font-mono text-xs' : 'max-w-[280px] truncate text-sm'}`}>
                    {c.fmt(row[c.key] as never)}
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

// ─── Weekly Notes ─────────────────────────────────────────────────────────────

function WeeklyNotes({ readout }: { readout: BloomDashboardData['weeklyReadout'] }) {
  const [open, setOpen] = useState(true);

  if (!readout) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Weekly Notes</h3>
        <p className="text-sm text-gray-400">No weekly notes yet. Notes will appear here once published.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50/50 transition-colors"
      >
        <div>
          <h3 className="text-sm font-semibold text-gray-700 text-left">Weekly Notes</h3>
          <p className="text-xs text-gray-400 text-left mt-0.5">{readout.periodStart} – {readout.periodEnd}</p>
        </div>
        {open ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
      </button>
      {open && (
        <div className="px-6 pb-6 border-t border-gray-100 space-y-5 pt-4">
          {readout.overallStory && (
            <p className="text-sm text-gray-700 leading-relaxed">{readout.overallStory}</p>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {readout.wins.length > 0 && (
              <div className="bg-emerald-50/60 rounded-lg p-4">
                <p className="text-xs font-bold uppercase tracking-widest text-emerald-700 mb-2">Wins</p>
                <ul className="space-y-1.5">
                  {readout.wins.map((w, i) => (
                    <li key={i} className="flex gap-2 text-sm text-gray-700">
                      <span className="text-emerald-500 mt-0.5 shrink-0">✓</span>
                      {w}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {readout.opportunities.length > 0 && (
              <div className="bg-amber-50/70 rounded-lg p-4">
                <p className="text-xs font-bold uppercase tracking-widest text-amber-700 mb-2">Opportunities</p>
                <ul className="space-y-1.5">
                  {readout.opportunities.map((o, i) => (
                    <li key={i} className="flex gap-2 text-sm text-gray-700">
                      <span className="text-amber-500 mt-0.5 shrink-0">→</span>
                      {o}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          {readout.accomplishments.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">Accomplishments</p>
              <ul className="space-y-1">
                {readout.accomplishments.map((a, i) => (
                  <li key={i} className="text-sm text-gray-600 flex gap-2">
                    <span className="text-gray-300 shrink-0">•</span>{a}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {readout.focusNextWeek.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">Focus Next Week</p>
              <ul className="space-y-1">
                {readout.focusNextWeek.map((f, i) => (
                  <li key={i} className="text-sm text-gray-600 flex gap-2">
                    <span className="text-gray-300 shrink-0">•</span>{f}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function BloomDashboardClient({ data }: { data: BloomDashboardData }) {
  const { summary, prevSummary, timeSeries, campaignRows, metaCreatives, weeklyReadout } = data;

  return (
    <div className="min-h-screen bg-gray-50/50">
      <div className="bg-white border-b border-gray-100 px-6 py-5">
        <div className="max-w-7xl mx-auto flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900">Bloom Aesthetics</h1>
              <p className="text-sm text-gray-400 mt-0.5">Performance Dashboard</p>
            </div>
          </div>
          <FilterBar />
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">

        {/* Weekly Notes */}
        <WeeklyNotes readout={weeklyReadout} />

        {/* KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <KpiCard label="Spend" value={summary.spend} prev={prevSummary.spend} format={fmt$} />
          <KpiCard label="Impressions" value={summary.impressions} prev={prevSummary.impressions} format={fmtN} />
          <KpiCard label="Clicks" value={summary.clicks} prev={prevSummary.clicks} format={fmtN} />
          <KpiCard label="CTR" value={summary.ctr} prev={prevSummary.ctr} format={fmtPct} />
          <KpiCard label="Leads" value={summary.leads} prev={prevSummary.leads} format={fmtN} />
          <KpiCard label="Cost / Lead" value={summary.costPerLead} prev={prevSummary.costPerLead} format={fmt$} invert />
        </div>

        {/* Trend Chart */}
        <TrendChart timeSeries={timeSeries} />

        {/* Campaign Table */}
        <CampaignTable rows={campaignRows} />

        {/* Meta Ad Creatives */}
        <MetaAdPreviews
          creatives={metaCreatives}
          title="Meta Ad Creatives"
          description="Meta ad-level creative performance for Bloom Aesthetics"
          advertiserName="Bloom Aesthetics"
        />

      </div>
    </div>
  );
}
