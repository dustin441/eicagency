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
  const { snapshot, windows, measurement, channels, months, roadmap } = data;
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
