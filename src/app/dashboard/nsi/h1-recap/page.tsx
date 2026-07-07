import React from 'react';
import { ArrowDownRight, ArrowUpRight, BarChart3, CheckCircle2, DatabaseZap, DollarSign, FileWarning, Gauge, Sparkles, Target, TrendingUp, Zap } from 'lucide-react';
import { requireClientAccess } from '@/lib/auth-guard';
import { cn } from '@/lib/utils';
import { fetchNsiH1RecapData, type H1MetricSummary, type H1RevenueFamily } from '@/services/nsi-h1-recap';

export const dynamic = 'force-dynamic';

type IconType = React.ComponentType<{ className?: string }>;

const fmtCurrency = (value: number, digits = 1) => {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `$${(value / 1_000_000).toFixed(digits)}M`;
  if (abs >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
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

function InsightList({ title, items, icon: Icon, empty }: { title: string; items?: string[]; icon: IconType; empty: string }) {
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
              <span>{item}</span>
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

export default async function NsiH1RecapPage() {
  await requireClientAccess('nsi');
  const data = await fetchNsiH1RecapData();
  const { metrics, prevMetrics, readout } = data;
  const maxFamilyRevenue = Math.max(...data.revenueFamilies.map((family) => family.current), 1);
  const compression = data.revenueFamilies.find((family) => family.key === 'CMP');

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
              {data.period.label} compared to {data.comparison.label}. The headline is clear: tracked family revenue grew, compression accelerated fastest, and the next unlock is HubSpot + Gravity Forms integration so demand can convert at higher velocity.
            </p>
          </div>
        </header>

        <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <KpiCard title="Tracked Revenue" value={fmtCurrency(data.trackedRevenue, 1)} sub={`${fmtCurrency(data.prevTrackedRevenue, 1)} in H1 2025`} delta={data.trackedRevenueChangePct} icon={DollarSign} tone="green" />
          <KpiCard title="Clicks" value={fmtNumber(metrics.clicks)} sub={`${fmtNumber(prevMetrics.clicks)} in H1 2025`} delta={pctChange(metrics.clicks, prevMetrics.clicks)} icon={Zap} tone="blue" />
          <KpiCard title="CPC" value={fmtCurrency(metrics.cpc, 2)} sub={`${fmtCurrency(prevMetrics.cpc, 2)} in H1 2025`} delta={pctChange(metrics.cpc, prevMetrics.cpc)} icon={TrendingUp} tone="purple" invertDelta />
          <KpiCard title="Engaged Sessions" value={fmtNumber(metrics.engagedSessions)} sub={`${fmtNumber(prevMetrics.engagedSessions)} in H1 2025`} delta={pctChange(metrics.engagedSessions, prevMetrics.engagedSessions)} icon={BarChart3} tone="amber" />
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
            <p className="text-xs text-gray-500 max-w-md text-right hidden md:block">Compression is shown both inside Polaris overall and separately because it is the data-center-specific growth lane.</p>
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
                <h2 className="text-lg font-black text-brand-dark">AI Readout</h2>
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
          <InsightList title="H2 focus: unblock and accelerate" items={readout?.focusNextHalf} icon={Target} empty="No H2 focus items have been generated yet." />
        </section>

        <section className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-2xl bg-rose-50 flex items-center justify-center shrink-0">
              <FileWarning className="w-5 h-5 text-rose-600" />
            </div>
            <div>
              <h2 className="text-lg font-black text-brand-dark">Tracking note</h2>
              <p className="text-sm text-gray-700 leading-relaxed mt-1">
                Submittals are treated as the bridge KPI for 2026 because they are the closest measurable step before sales follow-up. YoY submittal comparison is intentionally not emphasized because pre-2026 conversion tracking is not apples-to-apples. H2 priority is getting the Gravity Forms → HubSpot integration fully reliable so compression and contractor demand can become visible contacts, lifecycle stages, SQLs, and eventually closed-won attribution.
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
