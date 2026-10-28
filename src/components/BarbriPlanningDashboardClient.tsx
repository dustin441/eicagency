'use client';

import React from 'react';
import {
  Bar, BarChart, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from 'recharts';
import {
  ArrowUpRight, BadgeCheck, CalendarRange, CircleDollarSign, Database, Gauge,
  Lightbulb, Scale, ShieldCheck, ShoppingCart, Target, TrendingUp,
} from 'lucide-react';
import type { BarbriPlanningDashboardData } from '@/services/barbri-planning';

const COLORS = ['#0B4A31', '#EB541E', '#3B82F6'];
const ALLOCATION_GROUPS = [
  { key: 'google_core', label: 'Google core', color: '#0B4A31' },
  { key: 'meta', label: 'Meta', color: '#EB541E' },
  { key: 'linkedin', label: 'LinkedIn', color: '#3B82F6' },
  { key: 'ctv', label: 'Connected TV', color: '#8B5CF6' },
  { key: 'youtube', label: 'YouTube', color: '#DC2626' },
  { key: 'tiktok', label: 'TikTok', color: '#111827' },
  { key: 'geofencing', label: 'Geofencing', color: '#D97706' },
] as const;

function money(value: number) {
  return value.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}
function compactMoney(value: number) {
  return value.toLocaleString('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 });
}
function number(value: number) {
  return value.toLocaleString('en-US', { maximumFractionDigits: 0 });
}
function roas(value: number) { return `${value.toFixed(2)}x`; }
function pct(value: number) { return `${(value * 100).toFixed(1)}%`; }

function KpiCard({ label, value, note, icon }: { label: string; value: string; note: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">{label}</p>
          <p className="mt-3 text-3xl font-black tracking-tight text-slate-950">{value}</p>
        </div>
        <div className="rounded-xl bg-emerald-50 p-3 text-brand-forest">{icon}</div>
      </div>
      <p className="mt-4 text-sm leading-6 text-slate-500">{note}</p>
    </div>
  );
}

function EvidenceBadge({ children, modeled = false }: { children: React.ReactNode; modeled?: boolean }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
      modeled ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-200' : 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
    }`}>
      {children}
    </span>
  );
}

export default function BarbriPlanningDashboardClient({ data }: { data: BarbriPlanningDashboardData }) {
  const { snapshot, windows, measurement, channels, months, mediaPlan, roadmap } = data;
  const trendData = windows.map((window) => ({
    name: window.label.replace(' days', 'd'),
    native: Number(window.nativeRoas.toFixed(2)),
    ga4: Number(window.ga4Roas.toFixed(2)),
    spend: window.spend,
  }));
  const monthlyData = months.map((month) => ({
    name: month.label,
    spend: month.spend,
    revenue: month.revenue,
    roas: Number(month.roas.toFixed(2)),
  }));
  const channelData = channels.map((channel) => ({
    name: channel.key === 'google' ? 'Google' : channel.label,
    current: channel.currentRoas,
    forecast: channel.forecastRoas,
  }));
  const sumPlan = (key: keyof typeof mediaPlan[number], allocationKey?: string) => mediaPlan
    .filter((line) => !allocationKey || line.allocationKey === allocationKey)
    .reduce((total, line) => total + Number(line[key]), 0);
  const allocationData = [
    { name: 'Month 1', field: 'month1Spend' as const },
    { name: 'Month 2', field: 'month2Spend' as const },
    { name: 'Month 3', field: 'month3Spend' as const },
  ].map(({ name, field }) => ({
    name,
    ...Object.fromEntries(ALLOCATION_GROUPS.map((group) => [group.key, sumPlan(field, group.key)])),
  }));
  const allocationTotals = ALLOCATION_GROUPS.map((group) => ({
    ...group,
    spend: sumPlan('totalSpend', group.key),
  }));
  const googleCore = mediaPlan.filter((line) => line.allocationKey === 'google_core');
  const googleSpend = googleCore.reduce((total, line) => total + line.totalSpend, 0);
  const googleRevenue = googleCore.reduce((total, line) => total + line.forecastRevenue, 0);
  const googleSales = googleCore.reduce((total, line) => total + line.forecastSales, 0);
  const googleAssumption = googleCore[0]!;
  const googleImpressions = googleSpend / googleAssumption.cpm * 1000;
  const googleClicks = googleImpressions * googleAssumption.ctr;
  const googleAov = googleRevenue / googleSales;
  const stagedSpend = allocationTotals
    .filter((group) => ['ctv', 'youtube', 'tiktok', 'geofencing'].includes(group.key))
    .reduce((total, group) => total + group.spend, 0);

  return (
    <main className="min-w-0 space-y-8 pb-16">
      <section className="overflow-hidden rounded-3xl bg-brand-forest text-white shadow-xl">
        <div className="relative px-6 py-8 sm:px-9 lg:px-12 lg:py-12">
          <div className="absolute -right-24 -top-28 h-72 w-72 rounded-full bg-brand-orange/20 blur-3xl" />
          <div className="absolute -bottom-36 left-1/3 h-72 w-72 rounded-full bg-emerald-300/10 blur-3xl" />
          <div className="relative grid gap-8 lg:grid-cols-[1.25fr_0.75fr] lg:items-end">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-white/80">90-day media plan</span>
                <span className="rounded-full bg-brand-orange px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-white">Working preview</span>
              </div>
              <h1 className="mt-5 max-w-3xl text-4xl font-black tracking-tight sm:text-5xl">BARBRI growth plan, translated into decisions</h1>
              <p className="mt-5 max-w-3xl text-base leading-7 text-white/72 sm:text-lg">{snapshot.strategySummary}</p>
              <div className="mt-7 flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/65">
                <span className="inline-flex items-center gap-2"><CalendarRange size={16} /> {snapshot.forecastStart} to {snapshot.forecastEnd}</span>
                <span className="inline-flex items-center gap-2"><Database size={16} /> Source data through {snapshot.sourceCutoff}</span>
              </div>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/10 p-6 backdrop-blur-sm">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/55">The headline</p>
              <div className="mt-3 flex items-end gap-3">
                <span className="text-5xl font-black">{roas(snapshot.targetRoas)}</span>
                <span className="pb-1 text-sm font-semibold text-white/65">forecast portfolio ROAS</span>
              </div>
              <div className="mt-5 flex items-center gap-3 rounded-xl bg-white/10 p-3">
                <ArrowUpRight className="text-emerald-300" size={22} />
                <div>
                  <p className="font-bold">{pct(snapshot.improvementPct)} above modeled current</p>
                  <p className="text-xs text-white/55">{roas(snapshot.currentModeledRoas)} modeled baseline to {roas(snapshot.targetRoas)} plan</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="90-day investment" value={money(snapshot.forecastSpend)} note="Proposed paid-media portfolio budget." icon={<CircleDollarSign size={22} />} />
        <KpiCard label="Forecast revenue" value={compactMoney(snapshot.forecastRevenue)} note="Modeled revenue, not a guarantee." icon={<TrendingUp size={22} />} />
        <KpiCard label="Estimated sales" value={number(snapshot.forecastSales)} note="Derived from channel-specific plan assumptions." icon={<ShoppingCart size={22} />} />
        <KpiCard label="ROAS improvement" value={pct(snapshot.improvementPct)} note="Versus the documented 7.90x modeled portfolio baseline." icon={<Target size={22} />} />
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm lg:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-orange">Measurement bridge</p>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">One story, five deliberately different ROAS views</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">The dashboard keeps verified platform results, GA4 direct attribution and modeled planning assumptions separate. They should not be presented as interchangeable.</p>
          </div>
          <div className="flex gap-2">
            <EvidenceBadge>Verified</EvidenceBadge>
            <EvidenceBadge modeled>Modeled or planned</EvidenceBadge>
          </div>
        </div>
        <div className="mt-7 grid gap-3 md:grid-cols-5">
          {measurement.map((point, index) => {
            const modeled = index >= 2;
            return (
              <div key={point.key} className={`relative rounded-2xl border p-4 ${modeled ? 'border-amber-200 bg-amber-50/45' : 'border-emerald-200 bg-emerald-50/45'}`}>
                <p className="text-xs font-bold leading-5 text-slate-600">{point.label}</p>
                <p className="mt-2 text-3xl font-black text-slate-950">{point.value.toFixed(2)}{point.unit}</p>
                <p className="mt-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{point.evidenceType}</p>
                {index < measurement.length - 1 && <div className="absolute -right-2 top-1/2 z-10 hidden h-4 w-4 -translate-y-1/2 rotate-45 border-r border-t border-slate-200 bg-white md:block" />}
              </div>
            );
          })}
        </div>
        <div className="mt-5 rounded-2xl bg-slate-50 p-5">
          <div className="grid gap-4 lg:grid-cols-2">
            {measurement.map((point) => (
              <div key={`${point.key}-definition`} className="flex gap-3 text-sm leading-6 text-slate-600">
                <BadgeCheck size={18} className="mt-1 shrink-0 text-brand-forest" />
                <p><strong className="text-slate-900">{point.label}:</strong> {point.definition}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm lg:p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-orange">Historical signal</p>
              <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">Google efficiency by lookback window</h2>
            </div>
            <Gauge className="text-brand-forest" />
          </div>
          <div className="mt-7 h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={trendData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(v) => `${v}x`} tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(value) => roas(Number(value))} />
                <Legend />
                <Line type="monotone" dataKey="native" name="Google Ads native" stroke="#0B4A31" strokeWidth={3} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="ga4" name="GA4 Google direct" stroke="#EB541E" strokeWidth={3} dot={{ r: 4 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
            <strong>Short-window caution:</strong> the seven-day view still shows 63 GA4 purchases but unusually low order value. Use 90, 30 and 14-day direction together rather than scaling from the seven-day value alone.
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm lg:p-8">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-orange">Channel roles</p>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">Forecast lift without pretending every channel is equal</h2>
          </div>
          <div className="mt-7 h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={channelData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(v) => `${v}x`} tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(value) => roas(Number(value))} />
                <Legend />
                <Bar dataKey="current" name="Current benchmark" fill="#94a3b8" radius={[6, 6, 0, 0]} />
                <Bar dataKey="forecast" name="90-day forecast" fill="#0B4A31" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-5 space-y-3">
            {channels.map((channel, index) => (
              <div key={channel.key} className="flex gap-3 rounded-xl bg-slate-50 p-4">
                <span className="mt-1 h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: COLORS[index] }} />
                <div>
                  <p className="font-bold text-slate-900">{channel.label}: {money(channel.spend)} planned</p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{channel.roleInPlan}</p>
                  <p className="mt-1 text-xs font-semibold text-slate-400">{channel.evidenceType}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm lg:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-orange">Investment allocation</p>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">The actual media plan, by channel and month</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">Every dollar in the $280,333 plan is assigned below. Core Google captures demand, paid social supports the funnel, and new channels enter as ring-fenced tests instead of being blended into an untraceable growth assumption.</p>
          </div>
          <EvidenceBadge modeled>Planning model</EvidenceBadge>
        </div>

        <div className="mt-7 grid gap-7 xl:grid-cols-[1.25fr_0.75fr]">
          <div className="h-96 min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={allocationData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={compactMoney} tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(value) => money(Number(value))} />
                <Legend />
                {ALLOCATION_GROUPS.map((group) => (
                  <Bar key={group.key} dataKey={group.key} name={group.label} stackId="allocation" fill={group.color} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-2">
            {allocationTotals.map((group) => (
              <div key={group.key} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: group.color }} />
                  <p className="text-sm font-bold text-slate-800">{group.label}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-black text-slate-950">{money(group.spend)}</p>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{pct(group.spend / snapshot.forecastSpend)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
            <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">Core Google</p>
            <p className="mt-2 text-2xl font-black text-emerald-950">{money(googleSpend)}</p>
            <p className="mt-2 text-sm leading-6 text-emerald-900/70">{pct(googleSpend / snapshot.forecastSpend)} of investment remains in the strongest proven revenue engine.</p>
          </div>
          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
            <p className="text-xs font-bold uppercase tracking-wider text-blue-700">Meta + LinkedIn</p>
            <p className="mt-2 text-2xl font-black text-blue-950">{money(sumPlan('totalSpend', 'meta') + sumPlan('totalSpend', 'linkedin'))}</p>
            <p className="mt-2 text-sm leading-6 text-blue-900/70">The existing $35,000 monthly social envelope, not an undisclosed budget increase.</p>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
            <p className="text-xs font-bold uppercase tracking-wider text-amber-700">Staged tests</p>
            <p className="mt-2 text-2xl font-black text-amber-950">{money(stagedSpend)}</p>
            <p className="mt-2 text-sm leading-6 text-amber-900/70">CTV and YouTube begin in Month 2. TikTok and geofencing begin in Month 3.</p>
          </div>
        </div>

        <div className="mt-8 overflow-hidden rounded-3xl bg-slate-950 text-white">
          <div className="border-b border-white/10 p-6 lg:p-8">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-orange-300">Forecast engine</p>
            <h3 className="mt-2 text-2xl font-black">How spend becomes the revenue forecast</h3>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-white/60">The forecast is built from channel-level funnel assumptions, not by applying 9.00x to the budget. Each line starts with spend and earns revenue only where the plan contains a defensible conversion assumption.</p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                ['1. Reach', 'Spend ÷ CPM × 1,000', 'Estimated impressions'],
                ['2. Traffic', 'Impressions × CTR', 'Estimated clicks'],
                ['3. Sales', 'Clicks × conversion rate', 'Estimated purchases'],
                ['4. Revenue', 'Purchases × order value', 'Forecast revenue'],
              ].map(([step, formula, output]) => (
                <div key={step} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-orange-300">{step}</p>
                  <p className="mt-2 font-bold">{formula}</p>
                  <p className="mt-2 text-xs text-white/45">{output}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="grid gap-6 p-6 lg:grid-cols-2 lg:p-8">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-white/45">Google core example</p>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {[
                  ['Spend', money(googleSpend)],
                  ['CPM', money(googleAssumption.cpm)],
                  ['Impressions', number(googleImpressions)],
                  ['CTR', pct(googleAssumption.ctr)],
                  ['Clicks', number(googleClicks)],
                  ['Purchase CVR', pct(googleAssumption.conversionRate)],
                  ['Sales', number(googleSales)],
                  ['Order value', money(googleAov)],
                  ['Revenue', compactMoney(googleRevenue)],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl bg-white/5 p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-white/40">{label}</p>
                    <p className="mt-1 font-black">{value}</p>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-white/45">Portfolio revenue bridge</p>
              <div className="mt-4 space-y-2">
                {[
                  ['Google core', googleRevenue],
                  ['Meta', sumPlan('forecastRevenue', 'meta')],
                  ['LinkedIn', sumPlan('forecastRevenue', 'linkedin')],
                  ['TikTok direct test credit', sumPlan('forecastRevenue', 'tiktok')],
                ].map(([label, value]) => (
                  <div key={String(label)} className="flex items-center justify-between rounded-xl bg-white/5 px-4 py-3">
                    <span className="text-sm text-white/65">{label}</span>
                    <span className="font-black">{money(Number(value))}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between rounded-xl bg-brand-orange px-4 py-3">
                  <span className="text-sm font-bold">Total forecast revenue</span>
                  <span className="text-lg font-black">{money(snapshot.forecastRevenue)}</span>
                </div>
              </div>
              <p className="mt-3 text-xs leading-5 text-white/45">CTV, YouTube and geofencing receive no separate direct revenue credit, preventing assisted outcomes from being counted twice.</p>
            </div>
          </div>
        </div>

        <div className="mt-8">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-orange">Line-item plan</p>
              <h3 className="mt-2 text-xl font-black text-slate-950">Every campaign cell behind the forecast</h3>
            </div>
            <p className="text-xs text-slate-400">Scroll horizontally on smaller screens</p>
          </div>
          <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full min-w-[1080px] table-fixed border-collapse text-left text-xs xl:min-w-full">
              <thead className="bg-slate-950 text-white">
                <tr>
                  <th className="w-[300px] px-4 py-3 font-bold xl:w-[26%]">Channel / campaign</th>
                  <th className="px-4 py-3 text-right font-bold">Month 1</th>
                  <th className="px-4 py-3 text-right font-bold">Month 2</th>
                  <th className="px-4 py-3 text-right font-bold">Month 3</th>
                  <th className="px-4 py-3 text-right font-bold">90-day spend</th>
                  <th className="px-4 py-3 text-right font-bold">CTR</th>
                  <th className="px-4 py-3 text-right font-bold">CVR</th>
                  <th className="px-4 py-3 text-right font-bold">Sales</th>
                  <th className="px-4 py-3 text-right font-bold">Revenue</th>
                  <th className="px-4 py-3 text-right font-bold">ROAS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {mediaPlan.map((line) => {
                  const group = ALLOCATION_GROUPS.find((item) => item.key === line.allocationKey)!;
                  return (
                    <tr key={line.key} className="align-top hover:bg-slate-50">
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: group.color }} />
                          <span className="font-black text-slate-900">{line.label}</span>
                        </div>
                        <p className="mt-1 max-w-sm text-xs leading-5 text-slate-500">{line.operatingIntent}</p>
                      </td>
                      <td className="px-4 py-4 text-right font-semibold text-slate-700">{money(line.month1Spend)}</td>
                      <td className="px-4 py-4 text-right font-semibold text-slate-700">{money(line.month2Spend)}</td>
                      <td className="px-4 py-4 text-right font-semibold text-slate-700">{money(line.month3Spend)}</td>
                      <td className="px-4 py-4 text-right font-black text-slate-950">{money(line.totalSpend)}</td>
                      <td className="px-4 py-4 text-right text-slate-600">{pct(line.ctr)}</td>
                      <td className="px-4 py-4 text-right text-slate-600">{line.conversionRate > 0 ? pct(line.conversionRate) : 'Assist only'}</td>
                      <td className="px-4 py-4 text-right text-slate-600">{line.forecastSales > 0 ? line.forecastSales.toFixed(1) : 'No direct credit'}</td>
                      <td className="px-4 py-4 text-right font-semibold text-slate-700">{line.forecastRevenue > 0 ? money(line.forecastRevenue) : 'No direct credit'}</td>
                      <td className="px-4 py-4 text-right font-black text-slate-950">{line.forecastRoas > 0 ? roas(line.forecastRoas) : 'Assist only'}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="border-t-2 border-slate-300 bg-slate-50 font-black text-slate-950">
                <tr>
                  <td className="px-4 py-4">Total paid media portfolio</td>
                  <td className="px-4 py-4 text-right">{money(months[0]!.spend)}</td>
                  <td className="px-4 py-4 text-right">{money(months[1]!.spend)}</td>
                  <td className="px-4 py-4 text-right">{money(months[2]!.spend)}</td>
                  <td className="px-4 py-4 text-right">{money(snapshot.forecastSpend)}</td>
                  <td className="px-4 py-4 text-right" colSpan={2}>Blended forecast</td>
                  <td className="px-4 py-4 text-right">{number(snapshot.forecastSales)}</td>
                  <td className="px-4 py-4 text-right">{money(snapshot.forecastRevenue)}</td>
                  <td className="px-4 py-4 text-right">{roas(snapshot.targetRoas)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="mt-4 text-xs leading-5 text-slate-500">Forecast inputs are planning assumptions, not guarantees. Google uses the strongest audited benchmark. Meta, LinkedIn and staged-test assumptions remain subject to native-platform and first-party sale validation.</p>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm lg:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-orange">Pacing view</p>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">The plan scales deliberately across three months</h2>
          </div>
          <p className="max-w-lg text-sm leading-6 text-slate-500">Google remains the revenue foundation. New tests enter in waves so their direct and assisted contribution can be evaluated without masking the core engine.</p>
        </div>
        <div className="mt-7 grid gap-7 xl:grid-cols-[1.4fr_0.6fr]">
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={monthlyData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="money" tickFormatter={compactMoney} tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="roas" orientation="right" tickFormatter={(v) => `${v}x`} tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(value, name) => name === 'ROAS' ? roas(Number(value)) : money(Number(value))} />
                <Legend />
                <Bar yAxisId="money" dataKey="spend" name="Spend" fill="#EB541E" radius={[7, 7, 0, 0]} />
                <Bar yAxisId="money" dataKey="revenue" name="Revenue" fill="#0B4A31" radius={[7, 7, 0, 0]} />
                <Line yAxisId="roas" dataKey="roas" name="ROAS" stroke="#3B82F6" strokeWidth={3} dot={{ r: 5 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-3">
            {months.map((month, index) => (
              <div key={month.key} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-black text-slate-950">{month.label}</p>
                    <p className="text-xs text-slate-400">{month.dateRange}</p>
                  </div>
                  <span className="rounded-full px-2.5 py-1 text-xs font-bold text-white" style={{ backgroundColor: COLORS[index] }}>{roas(month.roas)}</span>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div><p className="text-slate-400">Spend</p><p className="font-bold text-slate-900">{money(month.spend)}</p></div>
                  <div><p className="text-slate-400">Revenue</p><p className="font-bold text-slate-900">{money(month.revenue)}</p></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-orange">Operating roadmap</p>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">Four gates from stabilization to controlled scale</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">Each phase has a decision gate and a clear ownership boundary. Tracking implementation and CRO remain outside EIC’s current paid-media scope.</p>
        </div>
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {roadmap.map((phase, index) => (
            <article key={phase.key} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl text-sm font-black text-white" style={{ backgroundColor: COLORS[index % COLORS.length] }}>{index + 1}</span>
                  <div><p className="text-xs font-bold uppercase tracking-wider text-slate-400">{phase.timing}</p><h3 className="text-lg font-black text-slate-950">{phase.theme}</h3></div>
                </div>
                <Lightbulb className="text-brand-orange" size={20} />
              </div>
              <p className="mt-5 text-sm leading-6 text-slate-600">{phase.actions}</p>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl bg-slate-50 p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Decision gate</p><p className="mt-2 text-sm leading-5 text-slate-700">{phase.decisionGate}</p></div>
                <div className="rounded-xl bg-emerald-50 p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">Primary KPI</p><p className="mt-2 text-sm font-bold leading-5 text-emerald-900">{phase.primaryKpi}</p></div>
              </div>
              <div className="mt-4 flex gap-2 rounded-xl border border-slate-200 p-3 text-xs leading-5 text-slate-500"><ShieldCheck size={17} className="mt-0.5 shrink-0 text-brand-forest" /><p>{phase.ownerBoundary}</p></div>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-3xl bg-slate-950 p-6 text-white lg:p-8">
        <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
          <div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-orange"><Scale size={22} /></div>
            <h2 className="mt-4 text-2xl font-black">What this dashboard makes clear</h2>
            <p className="mt-3 text-sm leading-6 text-white/60">The same governed data can support a client conversation, weekly pacing and a durable reporting layer without flattening verified results and assumptions into one number.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              ['Evidence stays labeled', 'Native, GA4 direct and modeled metrics remain visibly distinct.'],
              ['The plan is actionable', 'Budget, channel role, timing and decision gates live in one view.'],
              ['Ownership stays clear', 'Paid-media execution and client-owned measurement responsibilities stay separated.'],
            ].map(([title, copy]) => (
              <div key={title} className="rounded-2xl border border-white/10 bg-white/5 p-4"><p className="font-bold">{title}</p><p className="mt-2 text-sm leading-6 text-white/55">{copy}</p></div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
