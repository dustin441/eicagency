'use client';

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ArrowDownRight, ArrowUpRight, CheckCircle2, Search, ShieldAlert, Target } from 'lucide-react';
import type { SeoDashboardData, SeoMetricSummary } from '@/services/eic-seo';

function fmtNumber(value: number) {
  return value.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function fmtPct(value: number) {
  return `${(value * 100).toFixed(2)}%`;
}

function fmtPosition(value: number) {
  return value ? value.toFixed(1) : 'Unavailable';
}

function fmtDate(value: string) {
  return new Date(`${value}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

function change(current: number, previous: number) {
  if (!previous) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

function Delta({ current, previous, lowerIsBetter = false }: { current: number; previous: number; lowerIsBetter?: boolean }) {
  const value = change(current, previous);
  if (value === null) return <span className="text-[10px] text-gray-400">No prior baseline</span>;
  const favorable = lowerIsBetter ? value < 0 : value > 0;
  const neutral = Math.abs(value) < 0.05;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold ${
      neutral ? 'bg-gray-100 text-gray-500' : favorable ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
    }`}>
      {value >= 0 ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
      {value >= 0 ? '+' : ''}{value.toFixed(1)}%
    </span>
  );
}

function MetricCard({ label, current, previous, format, lowerIsBetter = false, note }: {
  label: string;
  current: number;
  previous: number;
  format: (value: number) => string;
  lowerIsBetter?: boolean;
  note?: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">{label}</p>
      <p className="mt-2 text-2xl font-bold text-gray-900">{format(current)}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Delta current={current} previous={previous} lowerIsBetter={lowerIsBetter} />
        <span className="text-[10px] text-gray-400">Prior {format(previous)}</span>
      </div>
      {note && <p className="mt-2 text-[10px] leading-4 text-gray-400">{note}</p>}
    </div>
  );
}

function SummaryCards({ current, previous }: { current: SeoMetricSummary; previous: SeoMetricSummary }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <MetricCard label="Organic clicks" current={current.clicks} previous={previous.clicks} format={fmtNumber} />
      <MetricCard label="Search impressions" current={current.impressions} previous={previous.impressions} format={fmtNumber} />
      <MetricCard label="Search CTR" current={current.ctr} previous={previous.ctr} format={fmtPct} />
      <MetricCard label="Average position" current={current.position} previous={previous.position} format={fmtPosition} lowerIsBetter note="Position is directional; query mix can change the average." />
    </div>
  );
}

function TrendChart({ data }: { data: SeoDashboardData['trend'] }) {
  return (
    <section className="rounded-[2.5rem] border border-gray-100 bg-white p-5 shadow-sm sm:p-8">
      <h2 className="text-xl font-bold text-[#0f172a]">Visibility trend</h2>
      <p className="mt-1 text-sm text-gray-400">Daily clicks and impressions from Search Console</p>
      <div className="mt-4 flex flex-wrap gap-4 text-xs font-semibold text-gray-500">
        <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-brand-orange" />Clicks</span>
        <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-brand-forest" />Impressions</span>
      </div>
      <p className="mt-3 text-[11px] font-medium text-gray-400 sm:hidden">Swipe horizontally to review each day.</p>
      <div className="mt-4 overflow-x-auto">
        <div className="h-[300px] min-w-[640px] sm:min-w-0">
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={300} initialDimension={{ width: 640, height: 300 }}>
            <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
              <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#9CA3AF', fontSize: 10 }} tickFormatter={fmtDate} interval="preserveStartEnd" />
              <YAxis yAxisId="clicks" hide />
              <YAxis yAxisId="impressions" hide />
              <Tooltip
                labelFormatter={label => fmtDate(String(label))}
                contentStyle={{ borderRadius: 16, border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
              />
              <Line yAxisId="clicks" type="monotone" dataKey="clicks" name="Clicks" stroke="#EB541E" strokeWidth={3} dot={false} activeDot={{ r: 5 }} />
              <Line yAxisId="impressions" type="monotone" dataKey="impressions" name="Impressions" stroke="#0B4A31" strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
}

function categoryClass(category: string) {
  if (category === 'Protect') return 'bg-rose-50 text-rose-700';
  if (category === 'Quick win') return 'bg-orange-50 text-orange-700';
  return 'bg-sky-50 text-sky-700';
}

function FocusKeywords({ data }: { data: SeoDashboardData }) {
  return (
    <section className="overflow-hidden rounded-[2.5rem] border border-gray-100 bg-white shadow-sm">
      <div className="border-b border-gray-100 p-6 sm:p-8">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-orange-50 p-2 text-brand-orange"><Target size={20} /></div>
          <div>
            <h2 className="text-xl font-bold text-[#0f172a]">Focus keywords for the next 28 days</h2>
            <p className="mt-1 text-sm text-gray-400">Nonbrand queries with at least 3 visible impressions and an average position of 1–40</p>
            <p className="mt-2 text-[11px] font-medium text-gray-400 sm:hidden">Swipe the table horizontally to see clicks, impressions, CTR, and position →</p>
          </div>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-[920px] w-full text-sm">
          <thead className="bg-gray-50 text-[10px] uppercase tracking-wider text-gray-500">
            <tr>
              <th className="px-6 py-3 text-left">Priority</th>
              <th className="px-4 py-3 text-left">Query and landing page</th>
              <th className="px-4 py-3 text-right">Clicks</th>
              <th className="px-4 py-3 text-right">Impressions</th>
              <th className="px-4 py-3 text-right">CTR</th>
              <th className="px-4 py-3 text-right">Position</th>
              <th className="px-4 py-3 text-right">Position change</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {data.opportunities.map(row => (
              <tr key={row.query} className="hover:bg-gray-50/70">
                <td className="px-6 py-4"><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${categoryClass(row.category)}`}>{row.category}</span></td>
                <td className="max-w-md px-4 py-4">
                  <p className="font-semibold text-gray-900">{row.query}</p>
                  {row.page && <a className="mt-1 block truncate text-[11px] text-gray-400 hover:text-brand-orange" href={row.page} target="_blank" rel="noreferrer">{row.page.replace('https://eic.agency', '') || '/'}</a>}
                </td>
                <td className="px-4 py-4 text-right font-semibold text-gray-700">{fmtNumber(row.clicks)}</td>
                <td className="px-4 py-4 text-right text-gray-600">{fmtNumber(row.impressions)}</td>
                <td className="px-4 py-4 text-right text-gray-600">{fmtPct(row.ctr)}</td>
                <td className="px-4 py-4 text-right font-semibold text-gray-700">{fmtPosition(row.position)}</td>
                <td className={`px-4 py-4 text-right font-semibold ${row.positionChange === null ? 'text-gray-300' : row.positionChange > 0 ? 'text-emerald-700' : row.positionChange < 0 ? 'text-rose-700' : 'text-gray-500'}`}>
                  {row.positionChange === null ? 'New' : `${row.positionChange > 0 ? '+' : ''}${row.positionChange.toFixed(1)}`}
                </td>
              </tr>
            ))}
            {data.opportunities.length === 0 && <tr><td colSpan={7} className="px-6 py-12 text-center text-gray-400">No queries met the focus threshold in this period.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="border-t border-gray-100 bg-gray-50 px-6 py-4 text-xs leading-5 text-gray-500">
        <strong>How to use this:</strong> protect slipping page-one terms, improve existing pages for quick wins in positions 5–20, and use positions 21–40 to guide supporting content and internal links. These are deterministic opportunities, not guarantees.
      </div>
    </section>
  );
}

function TopPages({ data }: { data: SeoDashboardData }) {
  return (
    <section className="overflow-hidden rounded-[2.5rem] border border-gray-100 bg-white shadow-sm">
      <div className="border-b border-gray-100 p-6 sm:p-8">
        <h2 className="text-xl font-bold text-[#0f172a]">Top organic pages</h2>
        <p className="mt-1 text-sm text-gray-400">Review which pages gained or lost visibility before choosing monthly work</p>
        <p className="mt-2 text-[11px] font-medium text-gray-400 sm:hidden">Swipe the table horizontally to compare page metrics →</p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-[760px] w-full text-sm">
          <thead className="bg-gray-50 text-[10px] uppercase tracking-wider text-gray-500">
            <tr>
              <th className="px-6 py-3 text-left">Page</th><th className="px-4 py-3 text-right">Clicks</th><th className="px-4 py-3 text-right">Prior</th><th className="px-4 py-3 text-right">Impressions</th><th className="px-4 py-3 text-right">Prior</th><th className="px-4 py-3 text-right">Position</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {data.pages.map(row => (
              <tr key={row.page} className="hover:bg-gray-50/70">
                <td className="max-w-lg px-6 py-4"><a href={row.page} target="_blank" rel="noreferrer" className="block truncate font-medium text-gray-800 hover:text-brand-orange">{row.page.replace('https://eic.agency', '') || '/'}</a></td>
                <td className="px-4 py-4 text-right font-semibold text-gray-700">{fmtNumber(row.clicks)}</td>
                <td className="px-4 py-4 text-right text-gray-400">{fmtNumber(row.previousClicks)}</td>
                <td className="px-4 py-4 text-right text-gray-600">{fmtNumber(row.impressions)}</td>
                <td className="px-4 py-4 text-right text-gray-400">{fmtNumber(row.previousImpressions)}</td>
                <td className="px-4 py-4 text-right text-gray-600">{fmtPosition(row.position)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function EicSeoDashboardClient({ data }: { data: SeoDashboardData }) {
  if (!data.available) {
    return (
      <div className="space-y-8">
        <header><h1 className="text-2xl font-bold text-gray-900">SEO Performance</h1><p className="mt-1 text-sm text-gray-500">Monthly organic search decisions for Dustin and Carolina</p></header>
        <section className="rounded-[2.5rem] border border-amber-100 bg-amber-50 p-8"><ShieldAlert className="text-amber-700" /><h2 className="mt-4 text-xl font-bold text-gray-900">Search Console data is unavailable</h2><p className="mt-2 text-sm text-amber-800">{data.error}</p></section>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-orange">EIC Agency organic search</p>
          <h1 className="mt-2 text-3xl font-bold text-gray-900">SEO Performance</h1>
          <p className="mt-1 text-sm text-gray-500">Use the evidence to choose what Carolina should improve next, not just to report traffic.</p>
        </div>
        <form method="get" className="flex flex-wrap items-end gap-2 rounded-2xl border border-gray-100 bg-white p-3 shadow-sm">
          <label className="text-xs font-semibold text-gray-500">28 days ending
            <input name="end" type="date" defaultValue={data.periodEnd} className="mt-1 block rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700" />
          </label>
          <button className="rounded-lg bg-brand-forest px-4 py-2.5 text-sm font-bold text-white hover:bg-[#083a27]" type="submit">Update</button>
        </form>
      </header>

      <section className="rounded-[2.5rem] border border-gray-100 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-brand-forest"><Search size={18} /><span className="text-xs font-bold uppercase tracking-widest">Google Search Console direct</span></div>
            <h2 className="mt-3 text-xl font-bold text-gray-900">{data.periodStart} to {data.periodEnd}</h2>
            <p className="mt-1 text-sm text-gray-400">Compared with {data.comparisonStart} to {data.comparisonEnd}</p>
          </div>
          <div className={`flex items-center gap-3 rounded-2xl px-4 py-3 ${data.sitemap.healthy ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'}`}>
            {data.sitemap.healthy ? <CheckCircle2 size={20} /> : <ShieldAlert size={20} />}
            <div><p className="text-xs font-bold">Sitemap {data.sitemap.healthy ? 'healthy' : 'needs review'}</p><p className="text-[10px] opacity-75">{data.sitemap.submitted} submitted URLs · {data.sitemap.errors} errors · {data.sitemap.warnings} warnings</p></div>
          </div>
        </div>
        <div className="mt-6"><SummaryCards current={data.summary} previous={data.comparisonSummary} /></div>
        <div className="mt-4 rounded-2xl bg-gray-50 p-4">
          <p className="text-xs font-bold text-gray-700">Visible nonbrand query signal</p>
          <p className="mt-1 text-sm text-gray-600">{fmtNumber(data.visibleNonBrand.clicks)} clicks and {fmtNumber(data.visibleNonBrand.impressions)} impressions, compared with {fmtNumber(data.comparisonVisibleNonBrand.clicks)} clicks and {fmtNumber(data.comparisonVisibleNonBrand.impressions)} impressions.</p>
          <p className="mt-1 text-[10px] text-gray-400">Google withholds some low-volume queries, so this segment will not exactly equal property totals.</p>
        </div>
      </section>

      {data.trend.length > 1 && <TrendChart data={data.trend} />}
      <FocusKeywords data={data} />
      <TopPages data={data} />

      <section className="rounded-[2.5rem] border border-sky-100 bg-sky-50/70 p-6 sm:p-8">
        <h2 className="font-bold text-gray-900">Phase 1 scope</h2>
        <p className="mt-2 text-sm leading-6 text-gray-600">This dashboard intentionally uses Search Console directly and does not require Supabase. Add GA4 only after organic traffic is large enough that landing-page engagement and conversion-path behavior can change the monthly decision. Search Console remains the source for ranking, visibility, CTR, and keyword focus.</p>
      </section>
    </div>
  );
}
