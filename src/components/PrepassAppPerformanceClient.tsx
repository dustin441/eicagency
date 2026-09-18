'use client';

import React, { useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  ArrowRight,
  CheckCircle2,
  CircleDot,
  Info,
  MousePointerClick,
  Smartphone,
  TrendingDown,
  TrendingUp,
  UsersRound,
} from 'lucide-react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type {
  PrepassAppMetricKey,
  PrepassAppMilestone,
  PrepassAppPerformance,
  PrepassAppRangeDays,
} from '@/services/prepass-app-performance';

const COLORS: Record<PrepassAppMetricKey, string> = {
  welcome: '#0B4A31',
  services: '#EB541E',
  about: '#2563EB',
  fleet: '#7C3AED',
  verification: '#D97706',
  company: '#0891B2',
  vehicles: '#4F46E5',
  payment: '#DB2777',
  review: '#059669',
  onboarding: '#15803D',
  requestSuccess: '#475569',
  flowComplete: '#111827',
};

const SELECTABLE_METRICS: PrepassAppMetricKey[] = [
  'welcome',
  'services',
  'about',
  'fleet',
  'verification',
  'company',
  'vehicles',
  'payment',
  'review',
  'onboarding',
  'requestSuccess',
  'flowComplete',
];

const SCORECARD_KEYS: PrepassAppMetricKey[] = ['welcome', 'services', 'company', 'onboarding'];

function number(value: number) {
  return new Intl.NumberFormat('en-US').format(Math.round(value));
}

function percent(value: number | null, digits = 1) {
  return value == null ? 'Not available' : `${(value * 100).toFixed(digits)}%`;
}

function dateLabel(value: string, includeYear = false) {
  return new Date(`${value}T12:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(includeYear ? { year: 'numeric' } : {}),
  });
}

function trendLabel(value: number | null) {
  if (value == null) return 'New vs prior period';
  const rounded = Math.abs(value).toFixed(1);
  return `${value > 0 ? '+' : value < 0 ? '-' : ''}${rounded}% vs prior period`;
}

function TrendBadge({ value }: { value: number | null }) {
  const positive = value != null && value > 0;
  const negative = value != null && value < 0;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-black ${
      positive ? 'bg-emerald-50 text-emerald-700' : negative ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-500'
    }`}>
      {positive ? <TrendingUp className="h-3 w-3" /> : negative ? <TrendingDown className="h-3 w-3" /> : null}
      {trendLabel(value)}
    </span>
  );
}

function Scorecard({ milestone, icon: Icon }: { milestone: PrepassAppMilestone; icon: React.ComponentType<{ className?: string }> }) {
  const isCompletionSignal = milestone.key === 'requestSuccess' || milestone.key === 'flowComplete';
  return (
    <article className="rounded-[1.75rem] border border-gray-100 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="rounded-2xl bg-orange-50 p-3 text-brand-orange"><Icon className="h-5 w-5" /></div>
        <TrendBadge value={milestone.changePct} />
      </div>
      <p className="mt-5 text-[11px] font-black uppercase tracking-[0.18em] text-gray-400">{milestone.shortLabel}</p>
      <p className="mt-2 text-4xl font-black tracking-tight text-gray-950 tabular-nums">{number(milestone.value)}</p>
      <p className="mt-2 text-xs font-semibold text-gray-500">
        {milestone.key === 'welcome'
          ? 'Sum of daily unique welcome-screen users'
          : `${percent(milestone.conversionFromWelcome)} of app audience${isCompletionSignal ? ' · reported separately' : ''}`}
      </p>
    </article>
  );
}

function FunnelStep({ milestone, max }: { milestone: PrepassAppMilestone; max: number }) {
  const width = max > 0 ? Math.max(3, (milestone.value / max) * 100) : 0;
  return (
    <div className="grid gap-2 md:grid-cols-[190px_minmax(0,1fr)_110px] md:items-center md:gap-4">
      <div>
        <p className="text-sm font-black text-gray-900">{milestone.shortLabel}</p>
        <p className="text-xs font-semibold text-gray-400">{number(milestone.value)} daily unique users</p>
      </div>
      <div className="h-8 overflow-hidden rounded-xl bg-gray-100">
        <div className="flex h-full min-w-[12px] items-center rounded-xl bg-gradient-to-r from-brand-forest to-emerald-500 px-3 transition-all" style={{ width: `${width}%` }}>
          {width > 14 ? <span className="text-[11px] font-black text-white">{percent(milestone.conversionFromWelcome)}</span> : null}
        </div>
      </div>
      <div className="text-left md:text-right">
        {milestone.conversionFromPrevious == null ? (
          <span className="text-xs font-bold text-gray-400">Starting point</span>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs font-black text-brand-orange">
            {percent(milestone.conversionFromPrevious)} <ArrowRight className="h-3 w-3" />
          </span>
        )}
      </div>
    </div>
  );
}

function MetricSelector({
  selected,
  toggle,
  labels,
}: {
  selected: PrepassAppMetricKey[];
  toggle: (key: PrepassAppMetricKey) => void;
  labels: PrepassAppPerformance['metricLabels'];
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {SELECTABLE_METRICS.map((key) => {
        const active = selected.includes(key);
        const disabled = !active && selected.length >= 4;
        return (
          <button
            key={key}
            type="button"
            onClick={() => toggle(key)}
            disabled={disabled}
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-black transition ${
              active
                ? 'border-transparent bg-gray-950 text-white shadow-sm'
                : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:text-gray-800 disabled:cursor-not-allowed disabled:opacity-40'
            }`}
          >
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: COLORS[key] }} />
            {labels[key]}
          </button>
        );
      })}
    </div>
  );
}

export default function PrepassAppPerformanceClient({ data }: { data: PrepassAppPerformance }) {
  const router = useRouter();
  const pathname = usePathname();
  const [selected, setSelected] = useState<PrepassAppMetricKey[]>(['welcome', 'services', 'fleet', 'onboarding']);

  const milestonesByKey = useMemo(
    () => new Map(data.milestones.map((milestone) => [milestone.key, milestone])),
    [data.milestones],
  );
  const scorecards = [
    ...SCORECARD_KEYS.map((key) => milestonesByKey.get(key)).filter(Boolean),
    ...data.completionSignals,
  ] as PrepassAppMilestone[];
  const max = data.milestones[0]?.value ?? 0;

  function setRange(range: PrepassAppRangeDays) {
    router.push(`${pathname}?range=${range}`);
  }

  function toggleMetric(key: PrepassAppMetricKey) {
    setSelected((current) => {
      if (current.includes(key)) return current.length === 1 ? current : current.filter((item) => item !== key);
      return current.length >= 4 ? current : [...current, key];
    });
  }

  return (
    <main className="min-h-screen bg-gray-50/70 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1500px] space-y-6">
        <header className="overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#072f20] via-brand-forest to-[#176b48] p-6 text-white shadow-lg sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-black uppercase tracking-[0.2em] text-emerald-100 ring-1 ring-white/15">
                <Smartphone className="h-4 w-4" /> PrePass mobile app
              </div>
              <h1 className="text-3xl font-black tracking-tight sm:text-4xl">App performance</h1>
              <p className="mt-3 max-w-2xl text-sm font-medium leading-6 text-emerald-50/85 sm:text-base">
                See how many app users reach each self-service enrollment stage, where stage reach narrows, and how completion signals change over time.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {([7, 30, 90] as const).map((range) => (
                <button
                  key={range}
                  type="button"
                  onClick={() => setRange(range)}
                  className={`rounded-full px-4 py-2 text-sm font-black transition ${data.rangeDays === range ? 'bg-white text-brand-forest shadow-sm' : 'bg-white/10 text-white hover:bg-white/20'}`}
                >
                  Last {range} days
                </button>
              ))}
            </div>
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-white/10 pt-4 text-xs font-bold text-emerald-100/80">
            <span>{dateLabel(data.start, true)} to {dateLabel(data.end, true)}</span>
            <span>Compared with {dateLabel(data.comparisonStart)} to {dateLabel(data.comparisonEnd)}</span>
            <span>Data through yesterday</span>
          </div>
        </header>

        {data.warning ? (
          <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
            <div className="flex items-start gap-3"><Info className="mt-0.5 h-5 w-5 shrink-0" /><span>{data.warning}</span></div>
          </section>
        ) : null}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {scorecards.map((milestone, index) => (
            <Scorecard
              key={milestone.key}
              milestone={milestone}
              icon={[UsersRound, MousePointerClick, CircleDot, CheckCircle2, CheckCircle2, CheckCircle2][index]}
            />
          ))}
        </section>

        <section className="rounded-[2rem] border border-gray-100 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-6 flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-brand-orange">Enrollment path</p>
              <h2 className="mt-1 text-2xl font-black tracking-tight text-gray-950">How many users reach each stage</h2>
              <p className="mt-1 text-sm font-medium text-gray-500">The right column shows stage reach relative to the immediately preceding screen.</p>
            </div>
            <div className="rounded-full bg-gray-100 px-3 py-1.5 text-xs font-black text-gray-500">Daily unique users summed by stage, not a same-session funnel</div>
          </div>
          <div className="space-y-4">
            {data.milestones.map((milestone) => <FunnelStep key={milestone.key} milestone={milestone} max={max} />)}
          </div>
        </section>

        <section className="rounded-[2rem] border border-gray-100 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-brand-orange">Trend explorer</p>
                <h2 className="mt-1 text-2xl font-black tracking-tight text-gray-950">Major app KPIs over time</h2>
                <p className="mt-1 text-sm font-medium text-gray-500">Select up to four metrics to compare daily movement.</p>
              </div>
            </div>
            <MetricSelector selected={selected} toggle={toggleMetric} labels={data.metricLabels} />
            <div className="h-[390px] w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.daily} margin={{ top: 10, right: 14, left: 0, bottom: 8 }}>
                  <CartesianGrid stroke="#E5E7EB" strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="date"
                    axisLine={false}
                    tickLine={false}
                    minTickGap={26}
                    tick={{ fill: '#9CA3AF', fontSize: 11, fontWeight: 700 }}
                    tickFormatter={(value) => dateLabel(String(value))}
                    dy={10}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    width={52}
                    tick={{ fill: '#9CA3AF', fontSize: 11, fontWeight: 700 }}
                    tickFormatter={(value) => new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(Number(value))}
                  />
                  <Tooltip
                    contentStyle={{ border: 'none', borderRadius: 18, boxShadow: '0 18px 45px rgb(15 23 42 / 0.14)', padding: 14 }}
                    labelFormatter={(value) => dateLabel(String(value), true)}
                    formatter={(value, name) => [number(Number(value)), data.metricLabels[name as PrepassAppMetricKey] ?? String(name)]}
                  />
                  {selected.map((key) => (
                    <Line
                      key={key}
                      type="monotone"
                      dataKey={key}
                      name={key}
                      stroke={COLORS[key]}
                      strokeWidth={3}
                      dot={false}
                      activeDot={{ r: 5 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <article className="rounded-[2rem] border border-gray-100 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-black text-gray-950">What this page can answer now</h2>
            <ul className="mt-4 space-y-3 text-sm font-medium leading-6 text-gray-600">
              <li className="flex gap-3"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />How many users reach each major enrollment stage and how that changes over time.</li>
              <li className="flex gap-3"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />Which later stages have materially lower reach than earlier screens.</li>
              <li className="flex gap-3"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />Whether product or campaign activity is increasing enrollment starts and completions.</li>
            </ul>
          </article>
          <article className="rounded-[2rem] border border-gray-100 bg-gradient-to-br from-orange-50 to-white p-6 shadow-sm">
            <h2 className="text-lg font-black text-gray-950">What would make it more actionable</h2>
            <p className="mt-3 text-sm font-medium leading-6 text-gray-600">
              App-store installs would separate downloads from repeat app users. Acquisition fields would connect traffic sources and campaigns to downstream enrollment. A fleet-size value would show which customer segments reach later stages most often. A cross-platform funnel definition would confirm same-user, same-session conversion.
            </p>
            <p className="mt-4 text-xs font-bold leading-5 text-gray-400">
              Current completion metrics represent the self-service enrollment flow, not confirmed paid activation.
            </p>
          </article>
        </section>
      </div>
    </main>
  );
}
