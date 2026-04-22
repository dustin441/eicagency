'use client';

import React, { Suspense, useState } from 'react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import {
  Monitor, MousePointer2, DollarSign, BarChart2,
  TrendingUp, Users, Activity, Target,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { NsiDashboardData, NsiSummary, NsiChannelRow, NsiCampaignRow } from '@/services/nsi-analytics';
import NsiFilterBar from './NsiFilterBar';

// ─── Formatters ───────────────────────────────────────────────────────────────

const fmtInt    = (v: number) => Math.round(v).toLocaleString();
const fmtCompact = (v: number) => {
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000)     return `${(v / 1_000).toFixed(1)}K`;
  return Math.round(v).toLocaleString();
};
const fmtDollar  = (v: number) => `$${Math.round(v).toLocaleString()}`;
const fmtCents   = (v: number) => `$${v.toFixed(2)}`;
const fmtPct     = (v: number) => `${(v * 100).toFixed(1)}%`;

// ─── Delta badge ──────────────────────────────────────────────────────────────

function Delta({ current, previous, inverted = false, fmt = fmtPct }: {
  current: number;
  previous: number;
  inverted?: boolean;
  fmt?: (v: number) => string;
}) {
  const pct = previous > 0 ? ((current - previous) / Math.abs(previous)) * 100 : null;
  const isGood = pct === null ? null : inverted ? pct < 0 : pct > 0;
  const showDelta = pct !== null && Math.abs(pct) >= 0.5;

  return (
    <p className={cn(
      'text-[11px] font-bold mt-1.5',
      !showDelta ? 'text-gray-300' : isGood ? 'text-emerald-600' : 'text-rose-600'
    )}>
      {showDelta && pct !== null ? `${pct > 0 ? '↑' : '↓'}${Math.abs(pct).toFixed(1)}%` : '—'}
    </p>
  );
}

// ─── Metric card ─────────────────────────────────────────────────────────────

function MetricCard({ title, value, current, previous, inverted = false }: {
  title: string;
  value: string;
  current: number;
  previous: number;
  inverted?: boolean;
}) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-4 flex-1 min-w-[130px] shadow-sm hover:shadow-md transition-all">
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 leading-tight">{title}</p>
      <p className="text-lg font-black text-brand-dark tracking-tight leading-none">{value}</p>
      <Delta current={current} previous={previous} inverted={inverted} />
    </div>
  );
}

// ─── KPI section ─────────────────────────────────────────────────────────────

function KpiSection({ title, icon: Icon, iconColor, children }: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-2.5 mb-3">
        <div className={cn('p-2 rounded-xl', iconColor)}>
          <Icon className="w-4 h-4 text-white" />
        </div>
        <span className="text-xs font-extrabold text-gray-400 uppercase tracking-widest">{title}</span>
      </div>
      <div className="flex flex-wrap gap-3">{children}</div>
    </div>
  );
}

// ─── Trend chart ─────────────────────────────────────────────────────────────

type MetricKey = 'impressions' | 'clicks' | 'sessions' | 'engagedSessions' | 'conversions' | 'ctr' | 'engagementRate' | 'costPerEngagedSession';

type MetricDef = {
  key: MetricKey;
  label: string;
  color: string;
  fmt: (v: number) => string;
};

const METRICS: MetricDef[] = [
  { key: 'impressions',           label: 'Impressions',           color: '#A5B4FC', fmt: fmtCompact },
  { key: 'clicks',                label: 'Clicks',                color: '#6366F1', fmt: fmtInt },
  { key: 'sessions',              label: 'Sessions',              color: '#7DD3FC', fmt: fmtInt },
  { key: 'engagedSessions',       label: 'Engaged Sessions',      color: '#0EA5E9', fmt: fmtInt },
  { key: 'conversions',           label: 'Conversions',           color: '#10B981', fmt: fmtInt },
  { key: 'ctr',                   label: 'CTR',                   color: '#F59E0B', fmt: fmtPct },
  { key: 'engagementRate',        label: 'Engagement Rate',       color: '#EC4899', fmt: fmtPct },
  { key: 'costPerEngagedSession', label: 'Cost / Eng. Session',   color: '#EF4444', fmt: fmtCents },
];

function TrendChart({ data }: { data: NsiDashboardData['timeSeries'] }) {
  const [active, setActive] = useState<Set<MetricKey>>(new Set(['engagedSessions', 'clicks']));

  const toggle = (key: MetricKey) => {
    setActive((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-extrabold text-gray-500 uppercase tracking-widest">Spend vs. Metrics Over Time</h3>
      </div>

      {/* metric toggles */}
      <div className="flex flex-wrap gap-2 mb-5">
        {METRICS.map((m) => (
          <button
            key={m.key}
            onClick={() => toggle(m.key)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition-all',
              active.has(m.key)
                ? 'text-white border-transparent shadow-sm'
                : 'bg-white text-gray-400 border-gray-200 hover:border-gray-300'
            )}
            style={active.has(m.key) ? { backgroundColor: m.color, borderColor: m.color } : {}}
          >
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: m.color }} />
            {m.label}
          </button>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={320}>
        <ComposedChart data={data} margin={{ top: 4, right: 20, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: '#9CA3AF' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            yAxisId="spend"
            orientation="left"
            tick={{ fontSize: 11, fill: '#9CA3AF' }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `$${fmtCompact(v)}`}
          />
          {/* hidden axes for each metric line (independent scaling) */}
          {METRICS.map((m) => (
            <YAxis key={m.key} yAxisId={m.key} hide />
          ))}
          <Tooltip
            contentStyle={{ borderRadius: 12, border: '1px solid #E5E7EB', fontSize: 12 }}
            formatter={(value, name) => {
              const v = Number(value);
              const metric = METRICS.find((m) => m.label === name);
              if (metric) return [metric.fmt(v), name as string];
              return [`$${Math.round(v).toLocaleString()}`, name as string];
            }}
          />
          <Bar yAxisId="spend" dataKey="spend" fill="#0B4A31" opacity={0.15} radius={[3, 3, 0, 0]} name="Spend" />
          {METRICS.filter((m) => active.has(m.key)).map((m) => (
            <Line
              key={m.key}
              yAxisId={m.key}
              type="monotone"
              dataKey={m.key}
              stroke={m.color}
              strokeWidth={2}
              dot={false}
              name={m.label}
            />
          ))}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Channel breakdown table ──────────────────────────────────────────────────

function pctDelta(curr: number, prev: number): string | null {
  if (prev === 0) return null;
  const pct = ((curr - prev) / Math.abs(prev)) * 100;
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`;
}

function ChannelTable({ rows }: { rows: NsiChannelRow[] }) {
  const cols: { label: string; curr: keyof NsiChannelRow; prev: keyof NsiChannelRow; fmt: (v: number) => string; inverted?: boolean }[] = [
    { label: 'Impressions',      curr: 'impressions',      prev: 'prevImpressions',      fmt: fmtCompact },
    { label: 'Clicks',           curr: 'clicks',           prev: 'prevClicks',           fmt: fmtInt },
    { label: 'Spend',            curr: 'cost',             prev: 'prevCost',             fmt: fmtDollar },
    { label: 'Conversions',      curr: 'conversions',      prev: 'prevConversions',      fmt: fmtInt },
    { label: 'Sessions',         curr: 'sessions',         prev: 'prevSessions',         fmt: fmtInt },
    { label: 'Eng. Sessions',    curr: 'engagedSessions',  prev: 'prevEngagedSessions',  fmt: fmtInt },
  ];

  if (!rows.length) return <p className="text-sm text-gray-400">No channel data.</p>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100">
            <th className="text-left py-3 pr-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Channel</th>
            {cols.map((c) => (
              <th key={c.label} className="text-right py-3 px-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.channel} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
              <td className="py-3 pr-4 font-semibold text-brand-dark whitespace-nowrap">{row.channel}</td>
              {cols.map((c) => {
                const curr = Number(row[c.curr]);
                const prev = Number(row[c.prev]);
                const delta = pctDelta(curr, prev);
                const isGood = delta === null ? null : c.inverted ? delta.startsWith('+') ? false : true : delta.startsWith('+');
                return (
                  <td key={c.label} className="py-3 px-3 text-right">
                    <div className="font-semibold text-gray-800">{c.fmt(curr)}</div>
                    {delta && (
                      <div className={cn('text-[10px] font-bold', isGood ? 'text-emerald-600' : 'text-rose-600')}>{delta}</div>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Campaign table ───────────────────────────────────────────────────────────

function CampaignTable({ rows }: { rows: NsiCampaignRow[] }) {
  if (!rows.length) return <p className="text-sm text-gray-400">No campaign data.</p>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100">
            <th className="text-left py-3 pr-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Campaign</th>
            <th className="text-left py-3 px-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Channel</th>
            <th className="text-left py-3 px-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Torpedo</th>
            <th className="text-right py-3 px-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Impressions</th>
            <th className="text-right py-3 px-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Clicks</th>
            <th className="text-right py-3 px-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Spend</th>
            <th className="text-right py-3 px-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Conv.</th>
            <th className="text-right py-3 px-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Sessions</th>
            <th className="text-right py-3 px-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Eng. Sessions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
              <td className="py-2.5 pr-4 font-medium text-gray-800 max-w-[220px] truncate" title={row.campaign}>{row.campaign}</td>
              <td className="py-2.5 px-3">
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-brand-forest/10 text-brand-forest">{row.channel}</span>
              </td>
              <td className="py-2.5 px-3 text-gray-500 text-xs">{row.torpedo || '—'}</td>
              <td className="py-2.5 px-3 text-right font-medium text-gray-700">{fmtCompact(row.impressions)}</td>
              <td className="py-2.5 px-3 text-right font-medium text-gray-700">{fmtInt(row.clicks)}</td>
              <td className="py-2.5 px-3 text-right font-semibold text-gray-800">{fmtDollar(row.cost)}</td>
              <td className="py-2.5 px-3 text-right font-medium text-gray-700">{fmtInt(row.conversions)}</td>
              <td className="py-2.5 px-3 text-right font-medium text-gray-700">{fmtInt(row.sessions)}</td>
              <td className="py-2.5 px-3 text-right font-medium text-gray-700">{fmtInt(row.engagedSessions)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function NsiDashboardClient({ data }: { data: NsiDashboardData }) {
  const { filterParams, channels, torpedoes, campaigns, summary, prevSummary, timeSeries, channelRows, campaignRows } = data;

  const s = summary;
  const p = prevSummary;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-brand-dark tracking-tight">NSI Performance</h1>
        <p className="text-sm text-gray-400 mt-1">
          Cross-channel campaign analytics for NSI
        </p>
      </div>

      {/* Filter bar */}
      <Suspense>
        <NsiFilterBar
          params={filterParams}
          channels={channels}
          torpedoes={torpedoes}
          campaigns={campaigns}
        />
      </Suspense>

      {/* KPI Cards */}
      <div className="space-y-5">
        <KpiSection title="Paid Media" icon={DollarSign} iconColor="bg-brand-forest">
          <MetricCard title="Impressions"   value={fmtCompact(s.impressions)}  current={s.impressions}  previous={p.impressions} />
          <MetricCard title="Clicks"         value={fmtInt(s.clicks)}            current={s.clicks}        previous={p.clicks} />
          <MetricCard title="Spend"          value={fmtDollar(s.cost)}           current={s.cost}          previous={p.cost} />
          <MetricCard title="CTR"            value={fmtPct(s.ctr)}               current={s.ctr}           previous={p.ctr} />
          <MetricCard title="CPC"            value={fmtCents(s.cpc)}             current={s.cpc}           previous={p.cpc}           inverted />
          <MetricCard title="Conversions"    value={fmtInt(s.conversions)}       current={s.conversions}   previous={p.conversions} />
          <MetricCard title="Cost / Conv."   value={fmtCents(s.costPerConversion)} current={s.costPerConversion} previous={p.costPerConversion} inverted />
        </KpiSection>

        <KpiSection title="Website / GA4" icon={Monitor} iconColor="bg-sky-500">
          <MetricCard title="Sessions"         value={fmtInt(s.sessions)}          current={s.sessions}         previous={p.sessions} />
          <MetricCard title="Engaged Sessions" value={fmtInt(s.engagedSessions)}   current={s.engagedSessions}  previous={p.engagedSessions} />
          <MetricCard title="Engagement Rate"  value={fmtPct(s.engagementRate)}    current={s.engagementRate}   previous={p.engagementRate} />
          <MetricCard title="Total Users"      value={fmtInt(s.totalUsers)}        current={s.totalUsers}       previous={p.totalUsers} />
        </KpiSection>

        <KpiSection title="Efficiency" icon={Target} iconColor="bg-brand-orange">
          <MetricCard title="Cost / Eng. Session" value={fmtCents(s.costPerEngagedSession)} current={s.costPerEngagedSession} previous={p.costPerEngagedSession} inverted />
        </KpiSection>
      </div>

      {/* Trend Chart */}
      <TrendChart data={timeSeries} />

      {/* Channel Breakdown */}
      <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-2.5 mb-5">
          <div className="p-2 rounded-xl bg-indigo-500">
            <BarChart2 className="w-4 h-4 text-white" />
          </div>
          <h3 className="text-xs font-extrabold text-gray-400 uppercase tracking-widest">Channel Breakdown</h3>
        </div>
        <ChannelTable rows={channelRows} />
      </div>

      {/* Campaign Table */}
      <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-2.5 mb-5">
          <div className="p-2 rounded-xl bg-violet-500">
            <Activity className="w-4 h-4 text-white" />
          </div>
          <h3 className="text-xs font-extrabold text-gray-400 uppercase tracking-widest">Campaign Performance</h3>
          <span className="ml-auto text-xs text-gray-400">Top {campaignRows.length} by spend</span>
        </div>
        <CampaignTable rows={campaignRows} />
      </div>
    </div>
  );
}
