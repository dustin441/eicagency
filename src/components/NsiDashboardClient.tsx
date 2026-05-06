'use client';

import React, { Suspense, useState } from 'react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import {
  Monitor, MousePointer2, DollarSign, BarChart2,
  TrendingUp, Users, Activity, Target, Layers, Cpu, Search, AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { NsiDashboardData, NsiSummary, NsiChannelRow, NsiCampaignRow, NsiSubCampaignRow, NsiCampaignTypeRow, NsiAudienceTypeRow } from '@/services/nsi-analytics';
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

function MetricCard({ title, value, current, previous, inverted = false, badge }: {
  title: string;
  value: string;
  current: number;
  previous: number;
  inverted?: boolean;
  badge?: string;
}) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-4 flex-1 min-w-[140px] shadow-sm hover:shadow-md transition-all">
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 leading-tight">{title}</p>
      {badge && (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-brand-forest/10 text-brand-forest mb-2">
          {badge}
        </span>
      )}
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

type MetricKey = 'impressions' | 'clicks' | 'sessions' | 'engagedSessions' | 'conversions' | 'ctr' | 'engagementRate' | 'costPerEngagedSession' | 'costPerConversion';

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
  { key: 'conversions',           label: 'Submittals',            color: '#10B981', fmt: fmtInt },
  { key: 'ctr',                   label: 'CTR',                   color: '#F59E0B', fmt: fmtPct },
  { key: 'engagementRate',        label: 'Engagement Rate',       color: '#EC4899', fmt: fmtPct },
  { key: 'costPerEngagedSession', label: 'Cost / Eng. Session',   color: '#EF4444', fmt: fmtCents },
  { key: 'costPerConversion',     label: 'Cost Per Submittal',    color: '#F97316', fmt: fmtDollar },
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

// ─── Platform grouping ────────────────────────────────────────────────────────

const PLATFORM_MAP: Record<string, string> = {
  'Google':      'Google',
  'Google Pmax': 'Google',
  'Facebook':    'Facebook',
  'LinkedIn':    'LinkedIn',
};

const PLATFORM_ORDER = ['Google', 'LinkedIn', 'Facebook'];

function groupByPlatform(rows: NsiChannelRow[]): NsiChannelRow[] {
  const map = new Map<string, NsiChannelRow>();
  for (const row of rows) {
    const platform = PLATFORM_MAP[row.channel];
    if (!platform) continue;
    const entry = map.get(platform) ?? {
      channel: platform,
      impressions: 0, prevImpressions: 0,
      clicks: 0, prevClicks: 0,
      cost: 0, prevCost: 0,
      conversions: 0, prevConversions: 0,
      sessions: 0, prevSessions: 0,
      engagedSessions: 0, prevEngagedSessions: 0,
    };
    entry.impressions      += row.impressions;
    entry.prevImpressions  += row.prevImpressions;
    entry.clicks           += row.clicks;
    entry.prevClicks       += row.prevClicks;
    entry.cost             += row.cost;
    entry.prevCost         += row.prevCost;
    entry.conversions      += row.conversions;
    entry.prevConversions  += row.prevConversions;
    entry.sessions         += row.sessions;
    entry.prevSessions     += row.prevSessions;
    entry.engagedSessions  += row.engagedSessions;
    entry.prevEngagedSessions += row.prevEngagedSessions;
    map.set(platform, entry);
  }
  return PLATFORM_ORDER.map((p) => map.get(p)).filter((r): r is NsiChannelRow => !!r && r.cost > 0);
}

// ─── Channel breakdown table ──────────────────────────────────────────────────

// ─── Shared column definitions ────────────────────────────────────────────────

type PeriodRow = {
  impressions: number; prevImpressions: number;
  clicks: number; prevClicks: number;
  cost: number; prevCost: number;
  conversions: number; prevConversions: number;
  sessions: number; prevSessions: number;
  engagedSessions: number; prevEngagedSessions: number;
};

type ColDef<T extends PeriodRow> = {
  label: string;
  curr: (r: T) => number;
  prev: (r: T) => number;
  fmt: (v: number) => string;
  inverted?: boolean;
};

function periodCols<T extends PeriodRow>(): ColDef<T>[] {
  return [
    { label: 'Impressions',            curr: r => r.impressions,      prev: r => r.prevImpressions,      fmt: fmtCompact },
    { label: 'Clicks',                 curr: r => r.clicks,           prev: r => r.prevClicks,           fmt: fmtInt },
    { label: 'CTR',                    curr: r => r.impressions > 0 ? r.clicks / r.impressions : 0,
                                       prev: r => r.prevImpressions > 0 ? r.prevClicks / r.prevImpressions : 0,
                                       fmt: fmtPct },
    { label: 'Spend',                  curr: r => r.cost,             prev: r => r.prevCost,             fmt: fmtDollar },
    { label: 'CPC',                    curr: r => r.clicks > 0 ? r.cost / r.clicks : 0,
                                       prev: r => r.prevClicks > 0 ? r.prevCost / r.prevClicks : 0,
                                       fmt: fmtCents, inverted: true },
    { label: 'Sessions',               curr: r => r.sessions,         prev: r => r.prevSessions,         fmt: fmtInt },
    { label: 'Engaged Sessions',       curr: r => r.engagedSessions,  prev: r => r.prevEngagedSessions,  fmt: fmtInt },
    { label: 'Engagement Rate',        curr: r => r.sessions > 0 ? r.engagedSessions / r.sessions : 0,
                                       prev: r => r.prevSessions > 0 ? r.prevEngagedSessions / r.prevSessions : 0,
                                       fmt: fmtPct },
    { label: 'Cost Per Eng. Session',  curr: r => r.engagedSessions > 0 ? r.cost / r.engagedSessions : 0,
                                       prev: r => r.prevEngagedSessions > 0 ? r.prevCost / r.prevEngagedSessions : 0,
                                       fmt: fmtCents, inverted: true },
    { label: 'Submittals',             curr: r => r.conversions,      prev: r => r.prevConversions,      fmt: fmtInt },
    { label: 'Cost Per Submittal',     curr: r => r.conversions > 0 ? r.cost / r.conversions : 0,
                                       prev: r => r.prevConversions > 0 ? r.prevCost / r.prevConversions : 0,
                                       fmt: fmtDollar, inverted: true },
  ];
}

function pctDelta(curr: number, prev: number): string | null {
  if (prev === 0) return null;
  const pct = ((curr - prev) / Math.abs(prev)) * 100;
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`;
}

function PeriodCell({ curr, prev, fmt, inverted }: { curr: number; prev: number; fmt: (v: number) => string; inverted?: boolean }) {
  const delta = pctDelta(curr, prev);
  const isGood = delta === null ? null : inverted ? !delta.startsWith('+') : delta.startsWith('+');
  return (
    <td className="py-3 px-3 text-right whitespace-nowrap">
      <div className="font-semibold text-gray-800">{fmt(curr)}</div>
      {delta && <div className={cn('text-[10px] font-bold', isGood ? 'text-emerald-600' : 'text-rose-600')}>{delta}</div>}
    </td>
  );
}

// ─── Channel table ────────────────────────────────────────────────────────────

function ChannelTable({ rows }: { rows: NsiChannelRow[] }) {
  const cols = periodCols<NsiChannelRow>();
  if (!rows.length) return <p className="text-sm text-gray-400">No channel data.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="min-w-max w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100">
            <th className="text-left py-3 pr-6 text-[10px] font-bold text-gray-400 uppercase tracking-widest sticky left-0 bg-white">Channel</th>
            {cols.map((c) => (
              <th key={c.label} className="text-right py-3 px-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.channel} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
              <td className="py-3 pr-6 font-semibold text-brand-dark whitespace-nowrap sticky left-0 bg-white">{row.channel}</td>
              {cols.map((c) => (
                <PeriodCell key={c.label} curr={c.curr(row)} prev={c.prev(row)} fmt={c.fmt} inverted={c.inverted} />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Sub Campaign table ───────────────────────────────────────────────────────

function SubCampaignTable({ rows }: { rows: NsiSubCampaignRow[] }) {
  const visible = rows.filter((r) => r.cost > 0);
  const cols = periodCols<NsiSubCampaignRow>();
  if (!visible.length) return <p className="text-sm text-gray-400">No sub campaign data.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="min-w-max w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100">
            <th className="text-left py-3 pr-6 text-[10px] font-bold text-gray-400 uppercase tracking-widest sticky left-0 bg-white">Sub Campaign</th>
            {cols.map((c) => (
              <th key={c.label} className="text-right py-3 px-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visible.map((row) => (
            <tr key={row.subCampaign} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
              <td className="py-3 pr-6 font-semibold text-brand-dark whitespace-nowrap sticky left-0 bg-white">{row.subCampaign}</td>
              {cols.map((c) => (
                <PeriodCell key={c.label} curr={c.curr(row)} prev={c.prev(row)} fmt={c.fmt} inverted={c.inverted} />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Campaign table ───────────────────────────────────────────────────────────

function CampaignTable({ rows, hideChannel = false }: { rows: NsiCampaignRow[]; hideChannel?: boolean }) {
  if (!rows.length) return <p className="text-sm text-gray-400 py-2">No campaigns in this period.</p>;

  const cols: { label: string; val: (r: NsiCampaignRow) => number; fmt: (v: number) => string }[] = [
    { label: 'Impressions',           val: r => r.impressions,  fmt: fmtCompact },
    { label: 'Clicks',                val: r => r.clicks,       fmt: fmtInt },
    { label: 'CTR',                   val: r => r.impressions > 0 ? r.clicks / r.impressions : 0, fmt: fmtPct },
    { label: 'Spend',                 val: r => r.cost,         fmt: fmtDollar },
    { label: 'CPC',                   val: r => r.clicks > 0 ? r.cost / r.clicks : 0,             fmt: fmtCents },
    { label: 'Sessions',              val: r => r.sessions,     fmt: fmtInt },
    { label: 'Engaged Sessions',      val: r => r.engagedSessions, fmt: fmtInt },
    { label: 'Engagement Rate',       val: r => r.sessions > 0 ? r.engagedSessions / r.sessions : 0, fmt: fmtPct },
    { label: 'Cost Per Eng. Session', val: r => r.engagedSessions > 0 ? r.cost / r.engagedSessions : 0, fmt: fmtCents },
    { label: 'Submittals',            val: r => r.conversions,  fmt: fmtInt },
    { label: 'Cost Per Submittal',    val: r => r.conversions > 0 ? r.cost / r.conversions : 0,   fmt: fmtDollar },
  ];

  return (
    <div className="overflow-x-auto">
      <table className="min-w-max w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100">
            <th className="text-left py-3 pr-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest sticky left-0 bg-white">Campaign</th>
            {!hideChannel && (
              <th className="text-left py-3 px-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">Channel</th>
            )}
            <th className="text-left py-3 px-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">Torpedo</th>
            {cols.map((c) => (
              <th key={c.label} className="text-right py-3 px-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
              <td className="py-2.5 pr-4 font-medium text-gray-800 whitespace-nowrap sticky left-0 bg-white max-w-[220px] truncate" title={row.campaign}>{row.campaign}</td>
              {!hideChannel && (
                <td className="py-2.5 px-3 whitespace-nowrap">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-brand-forest/10 text-brand-forest">{row.channel}</span>
                </td>
              )}
              <td className="py-2.5 px-3 text-gray-500 text-xs whitespace-nowrap">{row.torpedo || '—'}</td>
              {cols.map((c) => (
                <td key={c.label} className="py-2.5 px-3 text-right font-medium text-gray-700 whitespace-nowrap">{c.fmt(c.val(row))}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Audience type table ──────────────────────────────────────────────────────

function AudienceTypeTable({ rows }: { rows: NsiAudienceTypeRow[] }) {
  const visible = rows.filter((r) => r.cost > 0);
  const cols = periodCols<NsiAudienceTypeRow>();
  if (!visible.length) {
    return (
      <p className="text-sm text-gray-400 py-2">
        No data yet — populate the <code className="bg-gray-100 px-1 rounded text-xs">type</code> column in Supabase with <code className="bg-gray-100 px-1 rounded text-xs">contractor</code> or <code className="bg-gray-100 px-1 rounded text-xs">distributor</code> to see this breakdown.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="min-w-max w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100">
            <th className="text-left py-3 pr-6 text-[10px] font-bold text-gray-400 uppercase tracking-widest sticky left-0 bg-white">Type</th>
            {cols.map((c) => (
              <th key={c.label} className="text-right py-3 px-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visible.map((row) => (
            <tr key={row.audienceType} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
              <td className="py-3 pr-6 font-semibold text-brand-dark whitespace-nowrap sticky left-0 bg-white">{row.audienceType}</td>
              {cols.map((c) => (
                <PeriodCell key={c.label} curr={c.curr(row)} prev={c.prev(row)} fmt={c.fmt} inverted={c.inverted} />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Campaign type table ──────────────────────────────────────────────────────

function CampaignTypeTable({ rows }: { rows: NsiCampaignTypeRow[] }) {
  const cols = periodCols<NsiCampaignTypeRow>();
  if (!rows.length) return <p className="text-sm text-gray-400 py-2">No data in this period.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="min-w-max w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100">
            <th className="text-left py-3 pr-6 text-[10px] font-bold text-gray-400 uppercase tracking-widest sticky left-0 bg-white">Campaign Type</th>
            {cols.map((c) => (
              <th key={c.label} className="text-right py-3 px-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.campaignType} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
              <td className="py-3 pr-6 font-semibold text-brand-dark whitespace-nowrap sticky left-0 bg-white">{row.campaignType}</td>
              {cols.map((c) => (
                <PeriodCell key={c.label} curr={c.curr(row)} prev={c.prev(row)} fmt={c.fmt} inverted={c.inverted} />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function NsiDashboardClient({ data }: { data: NsiDashboardData }) {
  const { filterParams, channels, torpedoes, campaigns, summary, prevSummary, timeSeries, channelRows, audienceTypeRows, campaignTypeRows, subCampaignRows, campaignRows, submittalDataWarning } = data;

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

      {/* Submittal tracking warning */}
      {submittalDataWarning && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
          <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800">Submittal data not available before 2026</p>
            <p className="text-sm text-amber-700 mt-0.5">
              Submittal tracking was not fully implemented until Q1 2026. Your selected date range or comparison period includes dates before January 1, 2026 — submittal counts and cost-per-submittal figures for those dates are excluded and will appear as zero.
            </p>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="space-y-5">
        <KpiSection title="Paid Media" icon={DollarSign} iconColor="bg-brand-forest">
          <MetricCard title="Impressions"   value={fmtCompact(s.impressions)}  current={s.impressions}  previous={p.impressions} />
          <MetricCard title="Clicks"         value={fmtInt(s.clicks)}            current={s.clicks}        previous={p.clicks} />
          <MetricCard title="Spend"          value={fmtDollar(s.cost)}           current={s.cost}          previous={p.cost} />
          <MetricCard title="CTR"            value={fmtPct(s.ctr)}               current={s.ctr}           previous={p.ctr} />
          <MetricCard title="CPC"            value={fmtCents(s.cpc)}             current={s.cpc}           previous={p.cpc}           inverted />
          <MetricCard title="Submittals"          value={fmtInt(s.conversions)}         current={s.conversions}         previous={p.conversions} />
          <MetricCard title="Cost Per Submittal" value={fmtCents(s.costPerConversion)} current={s.costPerConversion} previous={p.costPerConversion} inverted />
        </KpiSection>

        <KpiSection title="Website / GA4" icon={Monitor} iconColor="bg-sky-500">
          <MetricCard title="Sessions"         value={fmtInt(s.sessions)}          current={s.sessions}         previous={p.sessions} />
          <MetricCard title="Engaged Sessions" value={fmtInt(s.engagedSessions)}   current={s.engagedSessions}  previous={p.engagedSessions} />
          <MetricCard title="Engagement Rate"  value={fmtPct(s.engagementRate)}    current={s.engagementRate}   previous={p.engagementRate} />
          <MetricCard title="Total Users"      value={fmtInt(s.totalUsers)}        current={s.totalUsers}       previous={p.totalUsers} />
        </KpiSection>

        <KpiSection title="Efficiency — North Star Metrics" icon={Target} iconColor="bg-brand-orange">
          <MetricCard
            title="Cost Per Eng. Session"
            value={fmtCents(s.costPerEngagedSession)}
            current={s.costPerEngagedSession}
            previous={p.costPerEngagedSession}
            inverted
            badge="Awareness Focused"
          />
          <MetricCard
            title="Cost Per Submittal"
            value={fmtCents(s.costPerConversion)}
            current={s.costPerConversion}
            previous={p.costPerConversion}
            inverted
            badge="Direct Response Focused"
          />
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
        <ChannelTable rows={groupByPlatform(channelRows)} />
      </div>

      {/* Contractor vs Distributor */}
      <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-2.5 mb-5">
          <div className="p-2 rounded-xl bg-brand-forest">
            <Users className="w-4 h-4 text-white" />
          </div>
          <h3 className="text-xs font-extrabold text-gray-400 uppercase tracking-widest">Contractor vs Distributor</h3>
        </div>
        <AudienceTypeTable rows={audienceTypeRows} />
      </div>

      {/* Sub Campaign Table */}
      <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-2.5 mb-5">
          <div className="p-2 rounded-xl bg-teal-500">
            <Layers className="w-4 h-4 text-white" />
          </div>
          <h3 className="text-xs font-extrabold text-gray-400 uppercase tracking-widest">Sub Campaign</h3>
        </div>
        <SubCampaignTable rows={subCampaignRows} />
      </div>

      {/* Campaign Type Breakdown */}
      <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-2.5 mb-5">
          <div className="p-2 rounded-xl bg-violet-500">
            <Activity className="w-4 h-4 text-white" />
          </div>
          <h3 className="text-xs font-extrabold text-gray-400 uppercase tracking-widest">Campaign Type Performance</h3>
        </div>
        <CampaignTypeTable rows={campaignTypeRows} />
      </div>
    </div>
  );
}
