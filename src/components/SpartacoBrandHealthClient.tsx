'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  ChevronRight,
  CircleGauge,
  HeartPulse,
  Layers3,
  TrendingUp,
} from 'lucide-react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import ProductTrendChart from '@/components/ProductTrendChart';
import DashboardCsvDownloadButton from '@/components/DashboardCsvDownloadButton';
import type {
  BrandHealthFormat,
  BrandHealthSummary,
  SpartacoBrandHealthData,
  SpartacoHealthBrand,
} from '@/services/spartaco-brand-health';

const BRAND_COLORS: Record<SpartacoHealthBrand, string> = {
  Jameson: '#4F46E5',
  Huskie: '#0EA5E9',
  Ronin: '#10B981',
  Tiiger: '#F59E0B',
};

function compact(value: number): string {
  return Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

function currency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: value < 100 ? 2 : 0,
  }).format(value);
}

function percent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function formatValue(value: number | null, format: BrandHealthFormat): string {
  if (value === null || !Number.isFinite(value)) return 'Not enough data';
  if (format === 'currency') return currency(value);
  if (format === 'percent') return percent(value);
  if (format === 'roas') return `${value.toFixed(2)}x`;
  return compact(value);
}

function comparisonCopy(actual: number | null, previous: number | null): string {
  if (actual === null || previous === null || previous === 0) return '12-over-12 comparison unavailable';
  const raw = (actual - previous) / previous;
  if (raw === 0) return 'Flat vs previous 12 months';
  return `${Math.abs(raw * 100).toFixed(0)}% ${raw > 0 ? 'up' : 'down'} vs previous 12 months`;
}

function MetricCard({
  label,
  value,
  previous,
  format,
  currentCoverage,
  previousCoverage,
  lowerIsBetter = false,
}: {
  label: string;
  value: number | null;
  previous: number | null;
  format: BrandHealthFormat;
  currentCoverage: number;
  previousCoverage: number;
  lowerIsBetter?: boolean;
}) {
  const copy = comparisonCopy(value, previous);
  const raw = value !== null && previous !== null && previous !== 0 ? (value - previous) / previous : null;
  const favorable = raw !== null && (lowerIsBetter ? raw <= 0 : raw >= 0);

  return (
    <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-gray-400">{label}</p>
      <p className="mt-3 text-3xl font-black tracking-tight text-brand-dark">{formatValue(value, format)}</p>
      <p className={`mt-2 text-xs font-bold ${favorable ? 'text-emerald-600' : 'text-gray-500'}`}>{copy}</p>
      <div className="mt-4 grid grid-cols-2 gap-2 border-t border-gray-100 pt-3 text-xs">
        <div>
          <p className="font-bold uppercase tracking-wider text-gray-400">Current 12 months</p>
          <p className="mt-1 text-[10px] font-bold text-gray-400">{currentCoverage}/12 months reported</p>
        </div>
        <div>
          <p className="font-bold uppercase tracking-wider text-gray-400">Previous 12 months</p>
          <p className="mt-1 font-black text-gray-700">{formatValue(previous, format)}</p>
          <p className="mt-1 text-[10px] font-bold text-gray-400">{previousCoverage}/12 months reported</p>
        </div>
      </div>
    </div>
  );
}

function BrandTabs({ selectedBrand }: { selectedBrand: SpartacoHealthBrand | null }) {
  const tabs: { label: string; href: string; active: boolean }[] = [
    { label: 'All Brands', href: '/dashboard/spartaco/brand-health', active: selectedBrand === null },
    ...(['Jameson', 'Huskie', 'Ronin', 'Tiiger'] as SpartacoHealthBrand[]).map(brand => ({
      label: brand,
      href: `/dashboard/spartaco/brand-health/${brand.toLowerCase()}`,
      active: selectedBrand === brand,
    })),
  ];

  return (
    <nav className="flex flex-wrap gap-2" aria-label="Brand Health views">
      {tabs.map(tab => (
        <Link
          key={tab.label}
          href={tab.href}
          className={tab.active
            ? 'rounded-full bg-brand-dark px-4 py-2 text-xs font-black uppercase tracking-wider text-white'
            : 'rounded-full border border-gray-200 bg-white px-4 py-2 text-xs font-black uppercase tracking-wider text-gray-500 transition hover:border-gray-300 hover:text-brand-dark'}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}

function AllBrandTrend({ brands }: { brands: BrandHealthSummary[] }) {
  const [metric, setMetric] = useState<'engagedSessions' | 'leads' | 'onlineRevenue'>('engagedSessions');
  const monthly = brands[0]?.monthly.map((point, index) => ({
    label: point.label,
    ...Object.fromEntries(brands.map(brand => {
      const month = brand.monthly[index];
      const availableSources = brand.monthlySourceAvailability[month.bucket] ?? [];
      const requiredSource = metric === 'leads' ? 'ads' : 'ga4';
      const value = metric === 'engagedSessions'
        ? availableSources.includes(requiredSource) ? month.ga4_engaged_sessions : null
        : metric === 'leads'
          ? availableSources.includes(requiredSource) ? month.ad_conversions : null
          : availableSources.includes(requiredSource) ? month.ga4_revenue : null;
      return [brand.brand, value];
    })),
  })) ?? [];

  return (
    <section className="rounded-[2rem] border border-gray-100 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-indigo-500">Twenty-four-month comparison</p>
          <h2 className="mt-2 text-xl font-black text-brand-dark">How brand health is moving month by month</h2>
          <p className="mt-2 text-sm text-gray-500">Completed months only. Choose one outcome to compare brands on the same scale.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {([
            ['engagedSessions', 'Engaged sessions'],
            ['leads', 'Tracked paid conversions'],
            ['onlineRevenue', 'Online revenue'],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setMetric(key)}
              className={metric === key
                ? 'rounded-full bg-indigo-600 px-3 py-2 text-xs font-black text-white'
                : 'rounded-full bg-gray-50 px-3 py-2 text-xs font-black text-gray-500 ring-1 ring-gray-200'}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-6 h-[360px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={monthly} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
            <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#9CA3AF', fontSize: 10 }} interval={2} />
            <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9CA3AF', fontSize: 10 }} tickFormatter={compact} width={48} />
            <Tooltip
              formatter={(value, name) => [metric === 'onlineRevenue' ? currency(Number(value)) : compact(Number(value)), String(name)]}
              contentStyle={{ borderRadius: 16, border: '1px solid #E5E7EB', boxShadow: '0 10px 20px rgb(15 23 42 / 0.08)' }}
            />
            <Legend />
            {brands.map(brand => (
              <Line
                key={brand.brand}
                type="monotone"
                dataKey={brand.brand}
                stroke={BRAND_COLORS[brand.brand]}
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 5 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

function AllBrandsView({ data }: { data: SpartacoBrandHealthData }) {
  return (
    <div className="space-y-8">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {data.brands.map(brand => (
          <Link
            key={brand.brand}
            href={`/dashboard/spartaco/brand-health/${brand.brand.toLowerCase()}`}
            className="group rounded-3xl border border-gray-100 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em]" style={{ color: BRAND_COLORS[brand.brand] }}>{brand.brand}</p>
                <p className="mt-3 text-3xl font-black text-brand-dark">{formatValue(brand.currentPeriod.engagedSessions, 'count')}</p>
                <p className="text-sm font-semibold text-gray-500">engaged sessions, latest 12 completed months</p>
                <p className="mt-2 text-xs font-black text-indigo-600">{comparisonCopy(brand.currentPeriod.engagedSessions, brand.previousPeriod.engagedSessions)}</p>
              </div>
              <ChevronRight className="h-5 w-5 text-gray-300 transition group-hover:translate-x-0.5 group-hover:text-indigo-500" />
            </div>
            <div className="mt-5 grid grid-cols-2 gap-2 border-t border-gray-100 pt-4 text-xs">
              <div>
                <p className="font-bold uppercase tracking-wider text-gray-400">Engagement rate</p>
                <p className="mt-1 font-black text-gray-700">{formatValue(brand.currentPeriod.engagementRate, 'percent')}</p>
              </div>
              <div>
                <p className="font-bold uppercase tracking-wider text-gray-400">Cost / tracked conversion</p>
                <p className="mt-1 font-black text-gray-700">{formatValue(brand.currentPeriod.cpl, 'currency')}</p>
              </div>
            </div>
          </Link>
        ))}
      </section>

      <AllBrandTrend brands={data.brands} />

      <section className="overflow-hidden rounded-[2rem] border border-gray-100 bg-white shadow-sm">
        <div className="border-b border-gray-100 p-6">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-600">Executive comparison</p>
          <h2 className="mt-2 text-xl font-black text-brand-dark">Latest 12 completed months versus the previous 12 months</h2>
          <p className="mt-2 text-sm text-gray-500">Website values use native GA4 reports queried at each exact window. Paid-media rates and efficiency metrics use full-window summed numerators and denominators. Incomplete windows are unavailable rather than zero.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-gray-50 text-[11px] font-black uppercase tracking-wider text-gray-400">
              <tr>
                <th className="px-6 py-4">Brand</th>
                <th className="px-4 py-4 text-right">Engaged sessions</th>
                <th className="px-4 py-4 text-right">Engagement rate</th>
                <th className="px-4 py-4 text-right">Tracked paid conversions</th>
                <th className="px-4 py-4 text-right">Cost / tracked conversion</th>
                <th className="px-4 py-4 text-right">Blended paid ROAS</th>
                <th className="px-6 py-4 text-right">GA4 online revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.brands.map(brand => (
                <tr key={brand.brand} className="hover:bg-gray-50/70">
                  <td className="px-6 py-4 font-black text-brand-dark">{brand.brand}</td>
                  <td className="px-4 py-4 text-right font-bold">{formatValue(brand.currentPeriod.engagedSessions, 'count')}<span className="mt-1 block text-[10px] text-gray-400">Previous {formatValue(brand.previousPeriod.engagedSessions, 'count')}</span></td>
                  <td className="px-4 py-4 text-right font-bold">{formatValue(brand.currentPeriod.engagementRate, 'percent')}<span className="mt-1 block text-[10px] text-gray-400">Previous {formatValue(brand.previousPeriod.engagementRate, 'percent')}</span></td>
                  <td className="px-4 py-4 text-right font-bold">{formatValue(brand.currentPeriod.leads, 'count')}<span className="mt-1 block text-[10px] text-gray-400">Previous {formatValue(brand.previousPeriod.leads, 'count')}</span></td>
                  <td className="px-4 py-4 text-right font-bold">{formatValue(brand.currentPeriod.cpl, 'currency')}<span className="mt-1 block text-[10px] text-gray-400">Previous {formatValue(brand.previousPeriod.cpl, 'currency')}</span></td>
                  <td className="px-4 py-4 text-right font-bold">{formatValue(brand.currentPeriod.roas, 'roas')}<span className="mt-1 block text-[10px] text-gray-400">Previous {formatValue(brand.previousPeriod.roas, 'roas')}</span></td>
                  <td className="px-6 py-4 text-right font-bold">{formatValue(brand.currentPeriod.onlineRevenue, 'currency')}<span className="mt-1 block text-[10px] text-gray-400">Previous {formatValue(brand.previousPeriod.onlineRevenue, 'currency')}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function ChannelMatrix({ brand }: { brand: BrandHealthSummary }) {
  return (
    <section className="overflow-hidden rounded-[2rem] border border-gray-100 bg-white shadow-sm">
      <div className="border-b border-gray-100 p-6">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-indigo-500">Channel health</p>
        <h2 className="mt-2 text-xl font-black text-brand-dark">{brand.latestMonthLabel} versus the available-month baseline</h2>
        <p className="mt-2 text-sm text-gray-500">Each channel uses the metric that best reflects its job. Rates use summed valid numerators and denominators; missing source months are excluded.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[840px] text-left text-sm">
          <thead className="bg-gray-50 text-[11px] font-black uppercase tracking-wider text-gray-400">
            <tr>
              <th className="px-6 py-4">Channel</th>
              <th className="px-4 py-4">Primary KPI</th>
              <th className="px-4 py-4 text-right">Actual</th>
              <th className="px-4 py-4 text-right">Brand baseline</th>
              <th className="px-4 py-4 text-right">Benchmark read</th>
              <th className="px-6 py-4">Supporting context</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {brand.channels.map(row => {
              const favorable = row.delta !== null && row.delta >= 0;
              return (
                <tr key={row.channel} className="align-top hover:bg-gray-50/70">
                  <td className="px-6 py-5 font-black text-brand-dark">{row.channel}</td>
                  <td className="px-4 py-5 font-bold text-gray-600">{row.primaryMetric}</td>
                  <td className="px-4 py-5 text-right font-black text-brand-dark">{row.actualUnavailable ? 'Unavailable' : formatValue(row.actual, row.format)}</td>
                  <td className="px-4 py-5 text-right font-bold text-gray-600">{formatValue(row.benchmark, row.format)}</td>
                  <td className={`px-4 py-5 text-right font-black ${favorable ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {row.delta === null ? 'Directional only' : `${row.delta >= 0 ? '+' : ''}${(row.delta * 100).toFixed(0)}%`}
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex flex-wrap gap-2">
                      {row.supporting.map(item => (
                        <span key={item.label} className="rounded-full bg-gray-50 px-3 py-1.5 text-xs font-bold text-gray-600 ring-1 ring-gray-100">
                          {item.label}: {item.unavailable ? 'Unavailable' : formatValue(item.value, item.format)}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ProductContribution({ brand, start, end }: { brand: BrandHealthSummary; start: string; end: string }) {
  const rangeQuery = `start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`;
  return (
    <section className="overflow-hidden rounded-[2rem] border border-gray-100 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-gray-100 p-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-600">Product contribution</p>
          <h2 className="mt-2 text-xl font-black text-brand-dark">How products contribute to {brand.brand} health</h2>
          <p className="mt-2 text-sm text-gray-500">Trailing 24 completed months. Product metrics are directional contribution context from page/product-grained GA4 rows and are not summed into the property-level brand scorecards.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/dashboard/spartaco/products?${rangeQuery}&brand=${encodeURIComponent(brand.brand)}`} className="rounded-full bg-brand-dark px-4 py-2 text-xs font-black uppercase tracking-wider text-white">Product Performance</Link>
          <Link href="/dashboard/spartaco/wrapups" className="rounded-full border border-gray-200 px-4 py-2 text-xs font-black uppercase tracking-wider text-gray-600">Campaign Wrap-Ups</Link>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-gray-50 text-[11px] font-black uppercase tracking-wider text-gray-400">
            <tr>
              <th className="px-6 py-4">Product</th>
              <th className="px-4 py-4 text-right">Engaged sessions</th>
              <th className="px-4 py-4 text-right">Engagement rate</th>
              <th className="px-4 py-4 text-right">Attributed paid conversions</th>
              <th className="px-4 py-4 text-right">Cost / tracked conversion</th>
              <th className="px-6 py-4 text-right">GA4 online revenue</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {brand.products.slice(0, 20).map(row => (
              <tr key={row.product} className="hover:bg-gray-50/70">
                <td className="px-6 py-4">
                  <Link
                    href={`/dashboard/spartaco/products?${rangeQuery}&brand=${encodeURIComponent(brand.brand)}&product=${encodeURIComponent(row.product)}`}
                    className="font-black text-brand-dark hover:text-indigo-600"
                  >
                    {row.product}
                  </Link>
                </td>
                <td className="px-4 py-4 text-right font-bold">{compact(row.engagedSessions)}</td>
                <td className="px-4 py-4 text-right font-bold">{formatValue(row.engagementRate, 'percent')}</td>
                <td className="px-4 py-4 text-right font-bold">{row.leads === null ? 'No direct campaign' : compact(row.leads)}</td>
                <td className="px-4 py-4 text-right font-bold">{row.leads === null ? '—' : formatValue(row.cpl, 'currency')}</td>
                <td className="px-6 py-4 text-right font-bold">{currency(row.onlineRevenue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function coverageMonthLabel(month: string | null): string {
  if (!month) return 'No reported months';
  return new Date(`${month}-01T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function SourceCoverageAudit({ brand }: { brand: BrandHealthSummary }) {
  return (
    <section className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.2em] text-indigo-500">24-month source-row audit</p>
      <h2 className="mt-2 text-xl font-black text-brand-dark">Reported-month coverage behind the benchmarks</h2>
      <p className="mt-2 text-sm text-gray-500">A month counts only when that source returned a row. This audits source-row coverage, not whether every field populated. Missing months are excluded from averages and are never converted to zero performance.</p>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {brand.sourceCoverage.map(source => (
          <div key={source.source} className="rounded-2xl bg-gray-50 p-4 ring-1 ring-gray-100">
            <p className="text-[11px] font-black uppercase tracking-wider text-gray-400">{source.label}</p>
            <p className="mt-2 text-2xl font-black text-brand-dark">{source.monthsAvailable}/{source.monthsExpected}</p>
            <p className="mt-1 text-xs font-semibold text-gray-500">
              {source.firstMonth ? `${coverageMonthLabel(source.firstMonth)} to ${coverageMonthLabel(source.lastMonth)}` : 'No reported months'}
            </p>
            {source.missingMonths.length === 0 ? (
              <p className="mt-3 text-[11px] font-bold text-emerald-600">Complete source-row coverage</p>
            ) : (
              <details className="mt-3 text-[11px] text-gray-500">
                <summary className="cursor-pointer font-bold">View {source.missingMonths.length} missing {source.missingMonths.length === 1 ? 'month' : 'months'}</summary>
                <p className="mt-2 leading-relaxed">{source.missingMonths.map(coverageMonthLabel).join(', ')}</p>
              </details>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function BrandView({ brand, start, end }: { brand: BrandHealthSummary; start: string; end: string }) {
  return (
    <div className="space-y-8">
      {brand.missingLatestSources.length > 0 && (
        <section className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-950">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div>
            <p className="font-black">Latest-month source coverage is incomplete</p>
            <p className="mt-1 text-amber-800">{brand.missingLatestSources.join(', ')} did not return rows for {brand.latestMonthLabel}. Missing source metrics are shown as unavailable rather than zero and are excluded from benchmarks.</p>
          </div>
        </section>
      )}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Engaged sessions" value={brand.currentPeriod.engagedSessions} previous={brand.previousPeriod.engagedSessions} currentCoverage={brand.periodCoverage.currentWebsite} previousCoverage={brand.periodCoverage.previousWebsite} format="count" />
        <MetricCard label="Engagement rate" value={brand.currentPeriod.engagementRate} previous={brand.previousPeriod.engagementRate} currentCoverage={brand.periodCoverage.currentWebsite} previousCoverage={brand.periodCoverage.previousWebsite} format="percent" />
        <MetricCard label="Tracked paid conversions" value={brand.currentPeriod.leads} previous={brand.previousPeriod.leads} currentCoverage={brand.periodCoverage.currentPaidMedia} previousCoverage={brand.periodCoverage.previousPaidMedia} format="count" />
        <MetricCard label="Cost / tracked conversion" value={brand.currentPeriod.cpl} previous={brand.previousPeriod.cpl} currentCoverage={brand.periodCoverage.currentPaidMedia} previousCoverage={brand.periodCoverage.previousPaidMedia} format="currency" lowerIsBetter />
        <MetricCard label="GA4 online revenue" value={brand.currentPeriod.onlineRevenue} previous={brand.previousPeriod.onlineRevenue} currentCoverage={brand.periodCoverage.currentWebsite} previousCoverage={brand.periodCoverage.previousWebsite} format="currency" />
      </section>

      <section className="rounded-3xl border border-indigo-100 bg-indigo-50 p-5 text-sm text-indigo-950">
        <p className="font-black">All Data scope</p>
        <p className="mt-1 leading-relaxed text-indigo-800">Paid conversions and blended paid ROAS include lead generation, eCommerce, and general brand campaigns. GA4 online revenue is website revenue and will not equal ad-platform attributed revenue.</p>
      </section>

      <SourceCoverageAudit brand={brand} />

      <section className="rounded-3xl border border-amber-100 bg-amber-50 p-5">
        <div className="flex gap-3">
          <CircleGauge className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div>
            <p className="font-black text-amber-900">Goal comparison is ready for Bob’s approved monthly targets</p>
            <p className="mt-1 text-sm leading-relaxed text-amber-800">The digital history is already available. This page does not invent goals. Once the approved brand/month targets are supplied, they can be added as a small goals table and overlaid here without changing existing dashboards.</p>
          </div>
        </div>
      </section>

      <ProductTrendChart
        data={brand.monthly}
        missingSourcesByBucket={Object.fromEntries(
          brand.monthly.map(point => [
            point.bucket,
            ['ads', 'ga4', 'email', 'gsc', 'social'].filter(
              source => !(brand.monthlySourceAvailability[point.bucket] ?? []).includes(source),
            ),
          ]),
        )}
        metricLabelOverrides={{
          ad_conversions: 'Tracked Paid Conversions',
          ad_cpl: 'Cost / Tracked Conversion',
          ad_roas: 'Blended Paid ROAS',
        }}
        grain="month"
        dateRange={`${brand.monthly[0]?.label ?? ''} – ${brand.monthly[brand.monthly.length - 1]?.label ?? ''}`}
        defaultActiveMetrics={['ga4_engaged_sessions', 'ad_conversions', 'email_click_rate']}
      />

      <ChannelMatrix brand={brand} />
      <ProductContribution brand={brand} start={start} end={end} />
    </div>
  );
}

export default function SpartacoBrandHealthClient({
  data,
  selectedBrand,
}: {
  data: SpartacoBrandHealthData;
  selectedBrand: SpartacoHealthBrand | null;
}) {
  const brand = selectedBrand ? data.brands.find(item => item.brand === selectedBrand) ?? null : null;
  const exportedBrands = brand ? [brand] : data.brands;
  const exportData = {
    filters: { start: data.start, end: data.end, brand: selectedBrand ?? 'all' },
    periodMetadata: {
      currentPeriodLabel: data.currentPeriodLabel,
      previousPeriodLabel: data.previousPeriodLabel,
    },
    periodSummaries: exportedBrands.flatMap(item => [
      { brand: item.brand, period: 'current', ...item.currentPeriod },
      { brand: item.brand, period: 'previous', ...item.previousPeriod },
    ]),
    monthly: exportedBrands.flatMap(item => item.monthly.map(row => ({ brand: item.brand, ...row }))),
    channels: exportedBrands.flatMap(item => item.channels.map(row => ({ brand: item.brand, ...row }))),
    products: exportedBrands.flatMap(item => item.products.map(row => ({ brand: item.brand, ...row }))),
    sourceCoverage: exportedBrands.flatMap(item => item.sourceCoverage.map(row => ({ brand: item.brand, ...row }))),
    unassignedEmail: data.unassignedEmail,
  };

  return (
    <div className="space-y-8 pb-20">
      <header className="overflow-hidden rounded-[2rem] bg-gradient-to-br from-brand-dark via-slate-900 to-indigo-950 p-8 text-white shadow-xl">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-4xl">
            <div className="flex items-center gap-2 text-indigo-200">
              <HeartPulse className="h-5 w-5" />
              <p className="text-xs font-black uppercase tracking-[0.24em]">Spartaco Brand Health</p>
            </div>
            <h1 className="mt-4 text-3xl font-black tracking-tight md:text-4xl">{brand ? `${brand.brand} Health` : 'All Brands Health'}</h1>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-300 md:text-base">
              An All Data monthly view across paid media, website engagement, email, search, social, and the products creating that performance, including general brand activity.
            </p>
            <div className="mt-5 flex flex-wrap gap-3 text-xs font-bold text-slate-300">
              <span className="rounded-full bg-white/10 px-3 py-2 ring-1 ring-white/10">24 completed months</span>
              <span className="rounded-full bg-white/10 px-3 py-2 ring-1 ring-white/10">{data.start} to {data.end}</span>
              <span className="rounded-full bg-white/10 px-3 py-2 ring-1 ring-white/10">Current: {data.currentPeriodLabel}</span>
              <span className="rounded-full bg-white/10 px-3 py-2 ring-1 ring-white/10">Previous: {data.previousPeriodLabel}</span>
            </div>
          </div>
          <div className="space-y-3">
            <DashboardCsvDownloadButton
              data={exportData}
              title={`Spartaco ${brand ? `${brand.brand} ` : ''}Brand Health`}
              className="w-full border-white/20 bg-white text-brand-dark hover:bg-white/90"
            />
            <div className="grid grid-cols-3 gap-3 text-center text-xs">
              <div className="rounded-2xl bg-white/10 p-3 ring-1 ring-white/10"><TrendingUp className="mx-auto h-5 w-5 text-emerald-300" /><p className="mt-2 font-black">Monthly trend</p></div>
              <div className="rounded-2xl bg-white/10 p-3 ring-1 ring-white/10"><BarChart3 className="mx-auto h-5 w-5 text-indigo-300" /><p className="mt-2 font-black">12-over-12 comparison</p></div>
              <div className="rounded-2xl bg-white/10 p-3 ring-1 ring-white/10"><Layers3 className="mx-auto h-5 w-5 text-amber-300" /><p className="mt-2 font-black">Product contribution</p></div>
            </div>
          </div>
        </div>
      </header>

      <BrandTabs selectedBrand={selectedBrand} />
      {data.unassignedEmail.sends > 0 && (
        <section className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-950">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div>
            <p className="font-black">Unassigned email activity is reported separately</p>
            <p className="mt-1 text-amber-800">
              {compact(data.unassignedEmail.sends)} sends with a {formatValue(data.unassignedEmail.openRate, 'percent')} open rate and {formatValue(data.unassignedEmail.clickRate, 'percent')} click rate cannot be assigned confidently to Jameson, Huskie, Ronin, or Tiiger. They are preserved here but excluded from brand comparisons.
            </p>
          </div>
        </section>
      )}
      {brand ? <BrandView brand={brand} start={data.start} end={data.end} /> : <AllBrandsView data={data} />}
    </div>
  );
}
