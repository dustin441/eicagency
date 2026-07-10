import React from 'react';
import { ArrowDownRight, ArrowUpRight, BarChart2, BarChart3, CheckCircle2, DatabaseZap, DollarSign, FileWarning, Gauge, Layers, Sparkles, Target, TrendingUp, Users, Zap, Activity } from 'lucide-react';
import { requireClientAccess } from '@/lib/auth-guard';
import { cn } from '@/lib/utils';
import { fetchNsiH1RecapData, type H1MetricSummary, type H1RevenueFamily } from '@/services/nsi-h1-recap';
import DashboardPdfDownloadButton from '@/components/DashboardPdfDownloadButton';
import type { NsiAudienceTypeRow, NsiCampaignTypeRow, NsiChannelRow, NsiSubCampaignRow } from '@/services/nsi-analytics';

export const dynamic = 'force-dynamic';

type IconType = React.ComponentType<{ className?: string }>;

const fmtCurrency = (value: number, digits = 1) => {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `$${(value / 1_000_000).toFixed(digits)}M`;
  if (abs >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  if (digits > 0) return `$${value.toFixed(digits)}`;
  return `$${Math.round(value).toLocaleString()}`;
};

const fmtNumber = (value: number, digits = 0) => {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(digits)}K`;
  return value.toLocaleString(undefined, { maximumFractionDigits: digits });
};

const fmtPct = (value: number | null, digits = 1) => (value == null ? '—' : `${value > 0 ? '+' : ''}${value.toFixed(digits)}%`);
const fmtPlainPct = (value: number, digits = 1) => `${value.toFixed(digits)}%`;

function pctChange(current: number, previous: number): number | null {
  if (!previous) return null;
  return ((current - previous) / previous) * 100;
}

function KpiCard({
  title,
  value,
  sub,
  delta,
  icon: Icon,
  tone = 'green',
  invertDelta = false,
}: {
  title: string;
  value: string;
  sub: string;
  delta?: number | null;
  icon: IconType;
  tone?: 'green' | 'blue' | 'amber' | 'purple';
  invertDelta?: boolean;
}) {
  const positive = delta == null ? null : invertDelta ? delta < 0 : delta > 0;
  const color = {
    green: 'bg-emerald-600',
    blue: 'bg-blue-600',
    amber: 'bg-amber-500',
    purple: 'bg-purple-600',
  }[tone];
  return (
    <div className="bg-white rounded-3xl border border-gray-100 p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className={cn('w-11 h-11 rounded-2xl flex items-center justify-center', color)}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        {delta != null && (
          <div className={cn('flex items-center gap-1 text-xs font-black rounded-full px-2.5 py-1', positive ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700')}>
            {positive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {fmtPct(delta, 1)}
          </div>
        )}
      </div>
      <p className="text-[10px] uppercase tracking-[0.2em] font-black text-gray-400 mt-5">{title}</p>
      <p className="text-3xl font-black tracking-tight text-brand-dark mt-1">{value}</p>
      <p className="text-xs text-gray-500 mt-2 leading-relaxed">{sub}</p>
    </div>
  );
}

function RevenueFamilyCard({ family, maxRevenue }: { family: H1RevenueFamily; maxRevenue: number }) {
  const width = maxRevenue ? Math.max(8, (family.current / maxRevenue) * 100) : 0;
  return (
    <div className={cn('rounded-3xl border p-6 shadow-sm', family.spotlight ? 'bg-brand-dark text-white border-brand-dark ring-4 ring-amber-300/50' : 'bg-white border-gray-100')}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <p className={cn('text-[10px] uppercase tracking-[0.22em] font-black', family.spotlight ? 'text-amber-200' : 'text-gray-400')}>{family.shortLabel}</p>
            {family.spotlight && <span className="text-[10px] uppercase tracking-widest bg-amber-300 text-brand-dark font-black px-2 py-0.5 rounded-full">Data Center Focus</span>}
          </div>
          <h3 className="text-xl font-black mt-1">{family.label}</h3>
        </div>
        <div className={cn('flex items-center gap-1 text-sm font-black rounded-full px-3 py-1', family.spotlight ? 'bg-emerald-400 text-brand-dark' : 'bg-emerald-50 text-emerald-700')}>
          <ArrowUpRight className="w-4 h-4" />
          {fmtPct(family.changePct, 1)}
        </div>
      </div>
      <p className="text-4xl font-black tracking-tight mt-5">{fmtCurrency(family.current, 1)}</p>
      <p className={cn('text-sm mt-1', family.spotlight ? 'text-white/70' : 'text-gray-500')}>{fmtCurrency(family.previous, 1)} in H1 2025 · {fmtCurrency(family.change, 1)} increase</p>
      <div className={cn('h-3 rounded-full mt-5 overflow-hidden', family.spotlight ? 'bg-white/15' : 'bg-gray-100')}>
        <div className={cn('h-full rounded-full', family.spotlight ? 'bg-amber-300' : 'bg-brand-forest')} style={{ width: `${width}%` }} />
      </div>
      <p className={cn('text-sm leading-relaxed mt-4', family.spotlight ? 'text-white/80' : 'text-gray-600')}>{family.story}</p>
    </div>
  );
}

function HighlightSalesFocus({ text }: { text: string }) {
  const pattern = /(Gravity Forms|HubSpot|sales outcome loop|sales follow-up|sales attribution|closed-won attribution|closed-won|SQLs?|lifecycle stages?|submittals?|buying portal|direct response|e-?commerce|revenue tracking|deal association|deal amount|open deals?)/i;
  return (
    <>
      {text.split(pattern).map((part, index) =>
        pattern.test(part) ? <strong key={`${part}-${index}`} className="font-black text-brand-dark">{part}</strong> : part
      )}
    </>
  );
}

function InsightList({ title, items, icon: Icon, empty, highlightSales = false }: { title: string; items?: string[]; icon: IconType; empty: string; highlightSales?: boolean }) {
  const safeItems = items?.filter(Boolean) ?? [];
  return (
    <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-2xl bg-brand-forest/10 flex items-center justify-center">
          <Icon className="w-5 h-5 text-brand-forest" />
        </div>
        <h2 className="text-lg font-black text-brand-dark">{title}</h2>
      </div>
      {safeItems.length ? (
        <ul className="space-y-3">
          {safeItems.map((item) => (
            <li key={item} className="flex gap-3 text-sm leading-relaxed text-gray-700">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>{highlightSales ? <HighlightSalesFocus text={item} /> : item}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-gray-500">{empty}</p>
      )}
    </div>
  );
}

function MetricComparison({ metrics, prevMetrics }: { metrics: H1MetricSummary; prevMetrics: H1MetricSummary }) {
  const rows = [
    { label: 'CTR', current: fmtPlainPct(metrics.ctr), previous: fmtPlainPct(prevMetrics.ctr), delta: pctChange(metrics.ctr, prevMetrics.ctr) },
    { label: 'CPC', current: fmtCurrency(metrics.cpc, 2), previous: fmtCurrency(prevMetrics.cpc, 2), delta: pctChange(metrics.cpc, prevMetrics.cpc), invert: true },
    { label: 'Engaged Sessions', current: fmtNumber(metrics.engagedSessions), previous: fmtNumber(prevMetrics.engagedSessions), delta: pctChange(metrics.engagedSessions, prevMetrics.engagedSessions) },
    { label: 'Cost / Engaged Session', current: fmtCurrency(metrics.costPerEngagedSession, 2), previous: fmtCurrency(prevMetrics.costPerEngagedSession, 2), delta: pctChange(metrics.costPerEngagedSession, prevMetrics.costPerEngagedSession), invert: true },
  ];

  return (
    <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-2xl bg-blue-50 flex items-center justify-center">
          <Gauge className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <h2 className="text-lg font-black text-brand-dark">Efficiency Signals</h2>
          <p className="text-xs text-gray-500">Paid media quality moved materially even before the sales loop is fully closed.</p>
        </div>
      </div>
      <div className="divide-y divide-gray-100">
        {rows.map((row) => {
          const positive = row.delta == null ? null : row.invert ? row.delta < 0 : row.delta > 0;
          return (
            <div key={row.label} className="py-3 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-bold text-brand-dark">{row.label}</p>
                <p className="text-xs text-gray-400">{row.previous} in H1 2025</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-black text-brand-dark">{row.current}</p>
                <p className={cn('text-xs font-black', positive ? 'text-emerald-600' : 'text-rose-600')}>{fmtPct(row.delta, 1)}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

type PeriodRow = {
  impressions: number; prevImpressions: number;
  clicks: number; prevClicks: number;
  cost: number; prevCost: number;
  conversions: number; prevConversions: number;
  sessions: number; prevSessions: number;
  engagedSessions: number; prevEngagedSessions: number;
};

type PeriodCol<T extends PeriodRow> = {
  label: string;
  curr: (row: T) => number;
  prev: (row: T) => number;
  fmt: (value: number) => string;
  inverted?: boolean;
};

const fmtTableCurrency = (value: number) => `$${Math.round(value).toLocaleString()}`;
const fmtTableCents = (value: number) => `$${value.toFixed(2)}`;
const fmtTablePct = (value: number) => `${(value * 100).toFixed(1)}%`;

function periodCols<T extends PeriodRow>(): PeriodCol<T>[] {
  return [
    { label: 'Impressions', curr: (row) => row.impressions, prev: (row) => row.prevImpressions, fmt: fmtNumber },
    { label: 'Clicks', curr: (row) => row.clicks, prev: (row) => row.prevClicks, fmt: (value) => fmtNumber(value) },
    { label: 'CTR', curr: (row) => row.impressions ? row.clicks / row.impressions : 0, prev: (row) => row.prevImpressions ? row.prevClicks / row.prevImpressions : 0, fmt: fmtTablePct },
    { label: 'Spend', curr: (row) => row.cost, prev: (row) => row.prevCost, fmt: fmtTableCurrency },
    { label: 'CPC', curr: (row) => row.clicks ? row.cost / row.clicks : 0, prev: (row) => row.prevClicks ? row.prevCost / row.prevClicks : 0, fmt: fmtTableCents, inverted: true },
    { label: 'Sessions', curr: (row) => row.sessions, prev: (row) => row.prevSessions, fmt: (value) => fmtNumber(value) },
    { label: 'Engaged Sessions', curr: (row) => row.engagedSessions, prev: (row) => row.prevEngagedSessions, fmt: (value) => fmtNumber(value) },
    { label: 'Engagement Rate', curr: (row) => row.sessions ? row.engagedSessions / row.sessions : 0, prev: (row) => row.prevSessions ? row.prevEngagedSessions / row.prevSessions : 0, fmt: fmtTablePct },
    { label: 'Cost / Eng. Session', curr: (row) => row.engagedSessions ? row.cost / row.engagedSessions : 0, prev: (row) => row.prevEngagedSessions ? row.prevCost / row.prevEngagedSessions : 0, fmt: fmtTableCents, inverted: true },
    { label: 'Submittals', curr: (row) => row.conversions, prev: (row) => row.prevConversions, fmt: (value) => fmtNumber(value) },
    { label: 'Submittal Rate', curr: (row) => row.clicks ? row.conversions / row.clicks : 0, prev: (row) => row.prevClicks ? row.prevConversions / row.prevClicks : 0, fmt: fmtTablePct },
    { label: 'Cost / Submittal', curr: (row) => row.conversions ? row.cost / row.conversions : 0, prev: (row) => row.prevConversions ? row.prevCost / row.prevConversions : 0, fmt: fmtTableCurrency, inverted: true },
  ];
}

function periodDelta(curr: number, prev: number): number | null {
  if (!prev) return null;
  return ((curr - prev) / Math.abs(prev)) * 100;
}

function PerformanceCell({ curr, prev, fmt, inverted, suppressComparison = false }: { curr: number; prev: number; fmt: (value: number) => string; inverted?: boolean; suppressComparison?: boolean }) {
  const delta = suppressComparison ? null : periodDelta(curr, prev);
  const positive = delta == null ? null : inverted ? delta < 0 : delta > 0;
  return (
    <td className="py-3 px-3 text-right whitespace-nowrap">
      <div className="font-semibold text-gray-800">{fmt(curr)}</div>
      {delta != null && (
        <div className={cn('text-[10px] font-black', positive ? 'text-emerald-600' : 'text-rose-600')}>
          {delta > 0 ? '+' : ''}{delta.toFixed(1)}%
        </div>
      )}
    </td>
  );
}

function PerformanceTableShell<T extends PeriodRow>({ label, rows, nameForRow, empty, suppressComparisonForRow }: { label: string; rows: T[]; nameForRow: (row: T) => string; empty: string; suppressComparisonForRow?: (row: T) => boolean }) {
  const cols = periodCols<T>();
  if (!rows.length) return <p className="text-sm text-gray-400">{empty}</p>;
  return (
    <div className="overflow-x-auto">
      <table className="min-w-max w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100">
            <th className="text-left py-3 pr-6 text-[10px] font-bold text-gray-400 uppercase tracking-widest sticky left-0 bg-white">{label}</th>
            {cols.map((col) => <th key={col.label} className="text-right py-3 px-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">{col.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={nameForRow(row)} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
              <td className="py-3 pr-6 font-semibold text-brand-dark whitespace-nowrap sticky left-0 bg-white">{nameForRow(row)}</td>
              {cols.map((col) => (
                <PerformanceCell key={col.label} curr={col.curr(row)} prev={col.prev(row)} fmt={col.fmt} inverted={col.inverted} suppressComparison={suppressComparisonForRow?.(row)} />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const PLATFORM_MAP: Record<string, string> = { Google: 'Google', 'Google Pmax': 'Google', LinkedIn: 'LinkedIn', Facebook: 'Facebook' };
const PLATFORM_ORDER = ['Google', 'LinkedIn', 'Facebook'];

function groupByPlatform(rows: NsiChannelRow[]): NsiChannelRow[] {
  const map = new Map<string, NsiChannelRow>();
  for (const row of rows) {
    const platform = PLATFORM_MAP[row.channel] ?? row.channel;
    const entry = map.get(platform) ?? {
      channel: platform,
      impressions: 0, prevImpressions: 0,
      clicks: 0, prevClicks: 0,
      cost: 0, prevCost: 0,
      conversions: 0, prevConversions: 0,
      sessions: 0, prevSessions: 0,
      engagedSessions: 0, prevEngagedSessions: 0,
    };
    entry.impressions += row.impressions;
    entry.prevImpressions += row.prevImpressions;
    entry.clicks += row.clicks;
    entry.prevClicks += row.prevClicks;
    entry.cost += row.cost;
    entry.prevCost += row.prevCost;
    entry.conversions += row.conversions;
    entry.prevConversions += row.prevConversions;
    entry.sessions += row.sessions;
    entry.prevSessions += row.prevSessions;
    entry.engagedSessions += row.engagedSessions;
    entry.prevEngagedSessions += row.prevEngagedSessions;
    map.set(platform, entry);
  }
  return PLATFORM_ORDER.map((platform) => map.get(platform)).filter((row): row is NsiChannelRow => Boolean(row && row.cost > 0));
}

function PerformanceTableCard({ title, subtitle, icon: Icon, iconColor, children }: { title: string; subtitle: string; icon: IconType; iconColor: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm">
      <div className="flex items-start gap-3 mb-5">
        <div className={cn('w-10 h-10 rounded-2xl flex items-center justify-center shrink-0', iconColor)}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="text-sm font-black text-brand-dark uppercase tracking-widest">{title}</h3>
          <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

export default async function NsiH1RecapPage() {
  await requireClientAccess('nsi');
  const data = await fetchNsiH1RecapData();
  const { metrics, prevMetrics, readout } = data;
  const maxFamilyRevenue = Math.max(...data.revenueFamilies.map((family) => family.current), 1);
  const compression = data.revenueFamilies.find((family) => family.key === 'CMP');
  const channelRows: NsiChannelRow[] = groupByPlatform(data.performanceTables.channelRows);
  const hiddenSubCampaigns = new Set(['CON-CON-MCH', 'CCF-PEN-100']);
  const subCampaignRows: NsiSubCampaignRow[] = data.performanceTables.subCampaignRows.filter((row) => row.cost > 0 && !hiddenSubCampaigns.has(row.subCampaign));
  const campaignTypeRows: NsiCampaignTypeRow[] = data.performanceTables.campaignTypeRows;
  const audienceTypeRows: NsiAudienceTypeRow[] = data.performanceTables.audienceTypeRows.filter((row) => row.cost > 0);

  return (
    <div className="min-h-screen bg-[#F8FAF7]">
      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        <header className="bg-brand-dark rounded-[2rem] p-8 text-white overflow-hidden relative shadow-xl">
          <div className="absolute -right-16 -top-16 w-64 h-64 bg-brand-green/20 rounded-full blur-3xl" />
          <div className="absolute right-20 bottom-0 w-48 h-48 bg-amber-300/10 rounded-full blur-2xl" />
          <div className="relative z-10 max-w-4xl">
            <div className="flex flex-wrap items-center gap-3 mb-5">
              <span className="text-[10px] uppercase tracking-[0.25em] bg-white/10 border border-white/10 rounded-full px-3 py-1 font-black">NSI H1 Recap</span>
              <span className="text-[10px] uppercase tracking-[0.25em] bg-amber-300 text-brand-dark rounded-full px-3 py-1 font-black">Revenue + Sales Alignment</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-black tracking-tight leading-tight">H1 proved the growth story. H2 is about removing the sales-tracking blockers.</h1>
            <p className="text-white/75 text-lg mt-5 leading-relaxed">
              {data.period.label} compared to {data.comparison.label}. The headline is clear: Polaris + Bridgeport revenue grew, compression accelerated as its own breakout, and the next unlock is HubSpot + Gravity Forms integration so demand can convert at higher velocity.
            </p>
            <DashboardPdfDownloadButton client="nsi" className="mt-6 sm:items-start" />
          </div>
        </header>

        <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
          <KpiCard title="Tracked Revenue" value={fmtCurrency(data.trackedRevenue, 1)} sub={`${fmtCurrency(data.prevTrackedRevenue, 1)} in H1 2025`} delta={data.trackedRevenueChangePct} icon={DollarSign} tone="green" />
          <KpiCard title="Media Spend" value={fmtCurrency(metrics.spend, 1)} sub={`${fmtCurrency(prevMetrics.spend, 1)} in H1 2025`} delta={pctChange(metrics.spend, prevMetrics.spend)} icon={DollarSign} tone="purple" />
          <KpiCard title="Impressions" value={fmtNumber(metrics.impressions)} sub={`${fmtNumber(prevMetrics.impressions)} in H1 2025 · eyeballs reached`} delta={pctChange(metrics.impressions, prevMetrics.impressions)} icon={BarChart2} tone="amber" />
          <KpiCard title="Clicks" value={fmtNumber(metrics.clicks)} sub={`${fmtNumber(prevMetrics.clicks)} in H1 2025 · visitors sent to site`} delta={pctChange(metrics.clicks, prevMetrics.clicks)} icon={Zap} tone="blue" />
          <KpiCard title="CTR" value={fmtPlainPct(metrics.ctr, 2)} sub={`${fmtPlainPct(prevMetrics.ctr, 2)} in H1 2025`} delta={pctChange(metrics.ctr, prevMetrics.ctr)} icon={Target} tone="green" />
          <KpiCard title="Engaged Sessions" value={fmtNumber(metrics.engagedSessions)} sub={`${fmtNumber(prevMetrics.engagedSessions)} in H1 2025 · qualified site visits`} delta={pctChange(metrics.engagedSessions, prevMetrics.engagedSessions)} icon={BarChart3} tone="amber" />
          <KpiCard title="Cost / Engaged Session" value={fmtCurrency(metrics.costPerEngagedSession, 2)} sub={`${fmtCurrency(prevMetrics.costPerEngagedSession, 2)} in H1 2025`} delta={pctChange(metrics.costPerEngagedSession, prevMetrics.costPerEngagedSession)} icon={Gauge} tone="purple" invertDelta />
          <KpiCard title="CPC" value={fmtCurrency(metrics.cpc, 2)} sub={`${fmtCurrency(prevMetrics.cpc, 2)} in H1 2025`} delta={pctChange(metrics.cpc, prevMetrics.cpc)} icon={TrendingUp} tone="blue" invertDelta />
          <KpiCard title="Submittals" value={fmtNumber(metrics.submittals)} sub="First reliable tracking year — no YoY comparison" icon={FileWarning} tone="green" />
          <KpiCard title="Cost / Submittal" value={fmtCurrency(metrics.costPerSubmittal, 2)} sub="Directional 2026 bridge KPI — no YoY comparison" icon={Gauge} tone="blue" invertDelta />
        </section>

        <section className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
          <strong className="font-black">Submittal tracking note:</strong> H1 2026 is the first usable year for submittals and cost per submittal, so these are shown as sales-proximate bridge KPIs without a year-over-year delta. Performance metrics here are paid-digital traffic metrics; the revenue family totals are tracked business revenue used to show directional correlation until the HubSpot deal loop is fully closed.
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
            <p className="text-[10px] uppercase tracking-[0.22em] font-black text-emerald-700">Spend-to-revenue context</p>
            <p className="text-sm text-emerald-950 leading-relaxed mt-2">
              H1 media spend increased {fmtPct(pctChange(metrics.spend, prevMetrics.spend), 1)} while tracked family revenue increased {fmtPct(data.trackedRevenueChangePct, 1)}. The story is that budget shifted out of lower-value tech/tooling costs and into working media, creating far more impressions, clicks, and measurable demand without sacrificing efficiency.
            </p>
          </div>
          <div className="rounded-3xl border border-blue-200 bg-blue-50 p-5 shadow-sm">
            <p className="text-[10px] uppercase tracking-[0.22em] font-black text-blue-700">Attribution caveat</p>
            <p className="text-sm text-blue-950 leading-relaxed mt-2">
              Revenue is shown as a business outcome alongside paid-media movement, not as fully closed-loop ad attribution yet. The H2 reporting unlock is connecting submittals and paid interactions to HubSpot contacts, deals, closed-won stage, and deal amount.
            </p>
          </div>
        </section>

        {compression && (
          <section className="bg-amber-50 border border-amber-200 rounded-[2rem] p-6 flex flex-col lg:flex-row gap-5 items-start lg:items-center shadow-sm">
            <div className="w-14 h-14 rounded-2xl bg-amber-300 flex items-center justify-center shrink-0">
              <DatabaseZap className="w-7 h-7 text-brand-dark" />
            </div>
            <div className="flex-1">
              <p className="text-[10px] uppercase tracking-[0.22em] font-black text-amber-700 mb-1">Compression Spotlight</p>
              <h2 className="text-2xl font-black text-brand-dark">Compression revenue grew {fmtPct(compression.changePct, 1)} YoY — the clearest data-center growth signal.</h2>
              <p className="text-sm text-gray-700 mt-2 leading-relaxed">
                CMP / compression reached {fmtCurrency(compression.current, 1)} in H1 2026, up {fmtCurrency(compression.change, 1)} from H1 2025. This is the lane to accelerate: keep the campaign velocity up, remove the HubSpot/Gravity Forms blocker, and turn form demand into visible SQL and sales follow-up.
              </p>
            </div>
          </section>
        )}

        <section>
          <div className="flex items-end justify-between gap-4 mb-4">
            <div>
              <p className="text-[10px] uppercase tracking-[0.22em] font-black text-gray-400">Revenue by Family</p>
              <h2 className="text-2xl font-black text-brand-dark">Family-level revenue increases</h2>
            </div>
            <p className="text-xs text-gray-500 max-w-md text-right hidden md:block">Total revenue uses Polaris + Bridgeport only. Compression is shown separately as the data-center-specific breakout and is not added again to the total.</p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {data.revenueFamilies.map((family) => <RevenueFamilyCard key={family.key} family={family} maxRevenue={maxFamilyRevenue} />)}
          </div>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-white rounded-3xl border border-gray-100 p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <h2 className="text-lg font-black text-brand-dark">Executive Summary</h2>
                <p className="text-xs text-gray-500">Generated from dashboard data, Fathom call summaries, and ClickUp context.</p>
              </div>
            </div>
            <p className="text-gray-700 leading-relaxed text-sm">
              {readout?.overallStory || 'H1 recap narrative has not been generated yet. Run the H1 readout workflow or add a row for this period.'}
            </p>
            {readout?.familyInsights && Object.keys(readout.familyInsights).length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-5">
                {Object.entries(readout.familyInsights).map(([key, value]) => (
                  <div key={key} className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                    <p className="text-[10px] uppercase tracking-widest font-black text-gray-400 mb-1">{key}</p>
                    <p className="text-sm text-gray-700 leading-relaxed">{value}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
          <MetricComparison metrics={metrics} prevMetrics={prevMetrics} />
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <InsightList title="Needle-moving H1 accomplishments" items={readout?.accomplishments} icon={CheckCircle2} empty="No accomplishments have been generated yet." />
          <div className="space-y-4">
            <InsightList title="H2 focus: unblock and accelerate" items={readout?.focusNextHalf} icon={Target} empty="No H2 focus items have been generated yet." highlightSales />
            <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
              <p className="text-[10px] uppercase tracking-[0.22em] font-black text-emerald-700">H2 testing opportunity</p>
              <p className="text-sm text-emerald-950 leading-relaxed mt-2">
                Test display ads that send qualified, already-engaged audiences to product category pages with clear submittal paths. The goal is to help bottom-of-funnel prospects move from product interest into a measurable submittal action without adding friction.
              </p>
            </div>
            <div className="rounded-3xl border border-blue-200 bg-blue-50 p-5 shadow-sm">
              <p className="text-[10px] uppercase tracking-[0.22em] font-black text-blue-700">H2 revenue initiative</p>
              <p className="text-sm text-blue-950 leading-relaxed mt-2">
                Build on the Q1 buying portal test by driving more awareness and qualified users into the portal, where customers can log in, purchase directly, and reduce reliance on sales-assisted follow-up. This keeps H2 focused on direct response, e-commerce readiness, and clearer revenue tracking from paid traffic to purchase behavior.
              </p>
            </div>
            <div className="rounded-3xl border border-violet-200 bg-violet-50 p-5 shadow-sm">
              <p className="text-[10px] uppercase tracking-[0.22em] font-black text-violet-700">Closed-loop sales requirement</p>
              <p className="text-sm text-violet-950 leading-relaxed mt-2">
                Make HubSpot deal association part of the operating plan: when a paid-media-influenced contact or submittal connects to an open deal, the contact needs to be attached to that deal and the deal amount / closed-won status needs to be maintained so revenue influence can be reported.
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-[0.22em] font-black text-gray-400">What got done — performance detail</p>
              <h2 className="text-2xl font-black text-brand-dark">H1 sub-campaign, channel, and audience performance</h2>
            </div>
            <p className="text-xs text-gray-500 max-w-xl">
              Same core tables as the NSI dashboard, locked to Jan 1 – Jun 30, 2026 vs Jan 1 – Jun 30, 2025 so the recap connects the narrative to the underlying campaign data.
            </p>
          </div>

          <PerformanceTableCard title="Channel Breakdown" subtitle="Google, LinkedIn, and Facebook performance grouped to the main dashboard channel view." icon={BarChart2} iconColor="bg-indigo-500">
            <PerformanceTableShell<NsiChannelRow> label="Channel" rows={channelRows} nameForRow={(row) => row.channel} empty="No channel data for H1." />
          </PerformanceTableCard>

          <PerformanceTableCard title="Contractor vs Distributor" subtitle="Audience-type split used to show how contractor-facing demand is developing against distributor activity." icon={Users} iconColor="bg-brand-forest">
            <PerformanceTableShell<NsiAudienceTypeRow>
              label="Type"
              rows={audienceTypeRows}
              nameForRow={(row) => row.audienceType}
              empty="No contractor/distributor data for H1."
              suppressComparisonForRow={(row) => Boolean(row.suppressComparison)}
            />
            {data.performanceTables.contractorComparisonWarning && (
              <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Contractor-focused campaigns started on January 1, 2026, so pre-2026 contractor comparisons are intentionally suppressed when needed.
              </p>
            )}
          </PerformanceTableCard>

          <PerformanceTableCard title="Sub Campaign Performance" subtitle="Family and campaign-lane detail behind the H1 revenue and demand-generation story." icon={Layers} iconColor="bg-teal-500">
            <PerformanceTableShell<NsiSubCampaignRow> label="Sub Campaign" rows={subCampaignRows} nameForRow={(row) => row.subCampaign} empty="No sub-campaign data for H1." />
          </PerformanceTableCard>

          <PerformanceTableCard title="Campaign Type Performance" subtitle="Search, Performance Max, Display, LinkedIn, and Facebook roles across direct-response and awareness work." icon={Activity} iconColor="bg-violet-500">
            <PerformanceTableShell<NsiCampaignTypeRow> label="Campaign Type" rows={campaignTypeRows} nameForRow={(row) => row.campaignType} empty="No campaign type data for H1." />
          </PerformanceTableCard>
        </section>

        <section className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-2xl bg-rose-50 flex items-center justify-center shrink-0">
              <FileWarning className="w-5 h-5 text-rose-600" />
            </div>
            <div>
              <h2 className="text-lg font-black text-brand-dark">Tracking note</h2>
              <p className="text-sm text-gray-700 leading-relaxed mt-1">
                Submittals are treated as the bridge KPI for 2026 because they are the closest measurable step before sales follow-up. YoY submittal comparison is intentionally not emphasized because pre-2026 conversion tracking is not apples-to-apples. H2 priority is getting the <strong className="font-black text-brand-dark">Gravity Forms → HubSpot integration</strong> fully reliable so compression and contractor demand can become visible contacts, <strong className="font-black text-brand-dark">lifecycle stages, SQLs, sales follow-up, deal association, deal amount, and the full sales outcome loop</strong> through closed-won attribution.
              </p>
              {readout?.executionContext?.length ? (
                <ul className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-2">
                  {readout.executionContext.map((item) => <li key={item} className="text-xs text-gray-500 bg-gray-50 rounded-xl px-3 py-2">{item}</li>)}
                </ul>
              ) : null}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
