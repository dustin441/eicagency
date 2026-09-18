'use client';

import React, { useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  ArrowRight,
  BarChart3,
  Building2,
  CheckCircle2,
  CircleDot,
  Database,
  Download,
  Info,
  Link2,
  MousePointerClick,
  Route,
  Smartphone,
  TrendingDown,
  TrendingUp,
  Truck,
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

const IMPROVEMENT_REQUESTS = [
  {
    icon: Download,
    title: 'Establish the true install baseline',
    request: 'Provide daily App Store Connect downloads and Google Play first-time installer data, plus one canonical first_open event in both production apps.',
    decision: 'Separates downloads from repeat app users and shows install-to-enrollment performance.',
  },
  {
    icon: Link2,
    title: 'Persist acquisition through enrollment',
    request: 'Capture source, medium, campaign, campaign/ad IDs, click IDs, platform, and attribution provider at first open, then persist them through signup and enrollment completion.',
    decision: 'Shows which traffic sources and campaigns create enrolled customers instead of only clicks or installs.',
  },
  {
    icon: Route,
    title: 'Standardize one cross-platform funnel',
    request: 'Use the same canonical event names and step properties on iOS and Android, including first open, enrollment start, each major step, request success, and flow completion.',
    decision: 'Enables a true same-user funnel and trustworthy iOS-versus-Android comparisons.',
  },
  {
    icon: Building2,
    title: 'Connect users to business outcomes',
    request: 'Attach a stable account/company/customer ID after signup and add a dedicated paid or activated account event that can reconcile to the customer system of record.',
    decision: 'Connects app behavior to activated accounts and confirms which enrollment paths produce customers.',
  },
  {
    icon: Truck,
    title: 'Add fleet-size context',
    request: 'Send fleet size or vehicle count as a normalized property when Fleet Information is completed and on the final enrollment outcome.',
    decision: 'Shows which fleet segments progress, complete, and create the most value.',
  },
  {
    icon: BarChart3,
    title: 'Explain abandonment and retries',
    request: 'Send standardized validation error, cancellation, retry, and failure-reason properties with the enrollment step where each issue occurs.',
    decision: 'Distinguishes product friction from low intent and identifies the fixes most likely to increase completion.',
  },
  {
    icon: Database,
    title: 'Enable durable event-level reporting',
    request: 'Grant raw-event export permission only to the dedicated Supabase ETL service account and provide the intended Supabase project, destination schema, and write path.',
    decision: 'Creates an auditable event history for same-user cohorts, reconciliation, and reporting without relying only on rate-limited aggregate queries.',
  },
] as const;

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
  const [startDate, setStartDate] = useState(data.start);
  const [endDate, setEndDate] = useState(data.end);

  const milestonesByKey = useMemo(
    () => new Map(data.milestones.map((milestone) => [milestone.key, milestone])),
    [data.milestones],
  );
  const scorecards = [
    ...SCORECARD_KEYS.map((key) => milestonesByKey.get(key)).filter(Boolean),
    ...data.completionSignals,
  ] as PrepassAppMilestone[];
  const max = data.milestones[0]?.value ?? 0;
  const stageRatio = (to: PrepassAppMetricKey, from: PrepassAppMetricKey) => {
    const numerator = milestonesByKey.get(to)?.value ?? 0;
    const denominator = milestonesByKey.get(from)?.value ?? 0;
    return denominator > 0 ? numerator / denominator : null;
  };
  const observedFocus = [
    {
      title: 'Increase enrollment starts',
      metric: `${percent(stageRatio('services', 'welcome'))} welcome-to-pricing reach`,
      recommendation: 'Test a clearer value proposition, pricing expectation, and primary signup action on the welcome screen.',
    },
    {
      title: 'Reduce early form friction',
      metric: `${percent(stageRatio('fleet', 'about'))} about-to-fleet reach`,
      recommendation: 'Audit required fields, explain why information is needed, and make save, resume, and inline validation obvious.',
    },
    {
      title: 'Protect late-stage completion',
      metric: `${percent(stageRatio('payment', 'vehicles'))} vehicles-to-payment reach`,
      recommendation: 'Simplify vehicle entry or import, clarify payment expectations, and provide recoverable error states before review.',
    },
  ];

  function applyDateRange(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!startDate || !endDate || startDate > endDate || endDate > data.maxDate) return;
    const params = new URLSearchParams({ start: startDate, end: endDate });
    router.push(`${pathname}?${params.toString()}`);
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
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-black uppercase tracking-[0.2em] text-emerald-100 ring-1 ring-white/15">
                <Smartphone className="h-4 w-4" /> PrePass mobile app
              </div>
              <h1 className="text-3xl font-black tracking-tight sm:text-4xl">App performance</h1>
              <p className="mt-3 max-w-2xl text-sm font-medium leading-6 text-emerald-50/85 sm:text-base">
                See how many app users reach each self-service enrollment stage, where stage reach narrows, and how completion signals change over time.
              </p>
            </div>
            <form onSubmit={applyDateRange} className="rounded-2xl bg-white/10 p-3 ring-1 ring-white/15">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <label className="text-[11px] font-black uppercase tracking-widest text-emerald-100">
                  Start date
                  <input
                    type="date"
                    value={startDate}
                    max={endDate || data.maxDate}
                    onChange={(event) => setStartDate(event.target.value)}
                    className="mt-1 block rounded-xl border border-white/20 bg-white px-3 py-2 text-sm font-bold text-gray-900 outline-none focus:ring-2 focus:ring-orange-300"
                  />
                </label>
                <label className="text-[11px] font-black uppercase tracking-widest text-emerald-100">
                  End date
                  <input
                    type="date"
                    value={endDate}
                    min={startDate}
                    max={data.maxDate}
                    onChange={(event) => setEndDate(event.target.value)}
                    className="mt-1 block rounded-xl border border-white/20 bg-white px-3 py-2 text-sm font-bold text-gray-900 outline-none focus:ring-2 focus:ring-orange-300"
                  />
                </label>
                <button type="submit" className="rounded-xl bg-white px-4 py-2.5 text-sm font-black text-brand-forest shadow-sm transition hover:bg-orange-50">
                  Apply dates
                </button>
              </div>
              <p className="mt-2 text-[11px] font-semibold text-emerald-100/75">Choose up to 366 completed days.</p>
            </form>
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

        <section className="space-y-5 rounded-[2rem] border border-orange-100 bg-gradient-to-br from-orange-50 via-white to-emerald-50 p-5 shadow-sm sm:p-7">
          <div className="max-w-4xl">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-brand-orange">Action plan</p>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-gray-950 sm:text-3xl">Two separate ways to improve app outcomes</h2>
            <p className="mt-2 text-sm font-medium leading-6 text-gray-600">
              The black cards are actions PrePass can test now using the data already available. The white cards are separate instrumentation and data requests. They do not correspond one-to-one with the black cards.
            </p>
          </div>

          <div className="rounded-[1.75rem] bg-gray-950 p-5 sm:p-6">
            <div className="max-w-3xl">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-orange-300">1. Performance recommendations</p>
              <h3 className="mt-2 text-xl font-black text-white">What can be tested now</h3>
              <p className="mt-1 text-sm font-medium leading-6 text-gray-300">Based on the stage-reach patterns in the selected date range.</p>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-3">
              {observedFocus.map((item) => (
                <article key={item.title} className="rounded-2xl border border-white/10 bg-white/5 p-4 text-white">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-orange-300">Recommendation</p>
                  <h4 className="mt-2 text-base font-black">{item.title}</h4>
                  <p className="mt-1 text-xs font-black text-emerald-300">{item.metric}</p>
                  <p className="mt-3 text-sm font-medium leading-6 text-gray-300">{item.recommendation}</p>
                </article>
              ))}
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-gray-200 bg-white/90 p-5 sm:p-6">
            <div className="max-w-3xl">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-brand-orange">2. Measurement and reporting requests</p>
              <h3 className="mt-2 text-xl font-black text-gray-950">What additional data would unlock</h3>
              <p className="mt-1 text-sm font-medium leading-6 text-gray-600">These are independent requests for better attribution, segmentation, funnel measurement, and business-outcome reporting.</p>
            </div>
            <div className="mt-5 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
              {IMPROVEMENT_REQUESTS.map(({ icon: Icon, title, request, decision }, index) => (
                <article key={title} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className="rounded-xl bg-orange-50 p-2.5 text-brand-orange"><Icon className="h-5 w-5" /></div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-400">Request {String(index + 1).padStart(2, '0')}</p>
                      <h4 className="mt-1 text-sm font-black text-gray-950">{title}</h4>
                      <p className="mt-2 text-sm font-medium leading-6 text-gray-600">{request}</p>
                    </div>
                  </div>
                  <div className="mt-4 rounded-xl bg-emerald-50 px-3 py-2.5 text-xs font-bold leading-5 text-emerald-800">
                    Decision unlocked: {decision}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

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
          <article className="rounded-[2rem] border border-gray-100 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-black text-gray-950">How to read the current data</h2>
            <p className="mt-3 text-sm font-medium leading-6 text-gray-600">
              App audience is the sum of daily unique welcome-screen users, so a person active on multiple days can appear more than once. Stage reach compares the number of users seen at each screen, not a same-session funnel. Enrollment request success and flow completion are reported separately because the production apps do not yet use one canonical completion signal.
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
