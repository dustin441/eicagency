'use client';

import { useState } from 'react';
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ArrowUpRight, CalendarDays, Clock3, Info, Radio } from 'lucide-react';
import FilterBar from '@/components/FilterBar';
import { MetaAdPreviews } from '@/components/AdPreviews';
import type { KangDashboardData } from '@/services/kang-analytics';
import type { KangMetrics, KangPerformance } from '@/services/kang-metrics';

const columns: { key: keyof KangMetrics; label: string; format: 'money' | 'number' | 'percent'; detail: string }[] = [
  { key: 'cost', label: 'Spend', format: 'money', detail: 'Meta media spend' },
  { key: 'impressions', label: 'Impressions', format: 'number', detail: 'Times ads were shown' },
  { key: 'link_clicks', label: 'Link clicks', format: 'number', detail: 'Link clicks, not all clicks' },
  { key: 'linkCtr', label: 'Link CTR', format: 'percent', detail: 'Link clicks / impressions' },
  { key: 'linkCpc', label: 'CPC (link)', format: 'money', detail: 'Spend / link clicks' },
  { key: 'landing_page_views', label: 'Landing page views', format: 'number', detail: 'Meta-reported page loads' },
  { key: 'costPerLpv', label: 'Cost per LPV', format: 'money', detail: 'Spend / landing page views' },
];
function format(value: number | null, kind: 'money' | 'number' | 'percent') {
  if (value === null) return 'N/A';
  if (kind === 'percent') return `${value.toFixed(2)}%`;
  return value.toLocaleString('en-US', kind === 'money' ? { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 } : { maximumFractionDigits: 0 });
}

function PerformanceTable({ title, rows }: { title: string; rows: KangPerformance[] }) {
  const [page, setPage] = useState(0);
  const pageSize = 15;
  const currentPage = Math.min(page, Math.max(0, Math.ceil(rows.length / pageSize) - 1));
  const visible = rows.slice(currentPage * pageSize, (currentPage + 1) * pageSize);
  return <section className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm">
    <div className="border-b border-gray-100 px-6 py-5 sm:px-8"><h2 className="text-lg font-bold text-brand-dark">{title}</h2><p className="mt-1 text-xs text-gray-500">Selected period totals · Sorted by spend · {rows.length} {rows.length === 1 ? 'item' : 'items'}</p></div>
    <div className="overflow-x-auto"><table className="w-full min-w-[1050px] text-sm">
      <caption className="sr-only">{title}. Link-based traffic metrics for the selected date range.</caption>
      <thead><tr className="bg-gray-50 text-[10px] uppercase tracking-wider text-gray-500"><th scope="col" className="px-6 py-4 text-left">Name</th>{columns.map(col => <th scope="col" key={col.key} className="whitespace-nowrap px-4 py-4 text-right">{col.label}</th>)}</tr></thead>
      <tbody className="divide-y divide-gray-100">{visible.map(row => <tr key={row.id} className="hover:bg-gray-50/70"><th scope="row" className="max-w-80 px-6 py-4 text-left font-semibold text-brand-dark"><span className="block break-words">{row.name}</span>{row.parent && <span className="mt-1 block break-words text-xs font-normal text-gray-500">{row.parent}</span>}</th>{columns.map(col => <td key={col.key} className="whitespace-nowrap px-4 py-4 text-right tabular-nums text-gray-600">{format(row[col.key], col.format)}</td>)}</tr>)}</tbody>
    </table></div>
    {!rows.length && <p className="px-6 py-10 text-center text-sm text-gray-500">No source rows available for this selection.</p>}
    {rows.length > pageSize && <div className="flex items-center justify-between border-t border-gray-100 px-6 py-4 text-xs text-gray-500"><span>Page {currentPage + 1} of {Math.ceil(rows.length / pageSize)}</span><div className="flex gap-2"><button className="rounded-lg border px-3 py-2 disabled:opacity-40" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Previous</button><button className="rounded-lg border px-3 py-2 disabled:opacity-40" disabled={(currentPage + 1) * pageSize >= rows.length} onClick={() => setPage(currentPage + 1)}>Next</button></div></div>}
  </section>;
}

export default function KangDashboardClient({ data }: { data: KangDashboardData }) {
  const { params, summary } = data;
  // Insert null gaps, not synthetic zero-delivery days. Do not connect missing dates.
  const dailyByDate = new Map(data.daily.map(point => [point.date, point]));
  const chart = [];
  const cursor = new Date(`${params.start}T00:00:00Z`);
  const end = new Date(`${params.end}T00:00:00Z`);
  for (; cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    const date = cursor.toISOString().slice(0, 10);
    chart.push(dailyByDate.get(date) ?? { date, cost: null, link_clicks: null, landing_page_views: null });
  }
  const missingDays = chart.length - data.daily.length;
  const updated = data.updatedAt ? new Date(data.updatedAt).toLocaleString('en-US', { timeZone: 'America/Los_Angeles', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }) : 'Unavailable';
  return <div className="space-y-6 pb-10">
    <header className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between"><div><span className="inline-flex items-center gap-2 rounded-full bg-brand-forest/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-brand-forest"><Radio className="h-3.5 w-3.5" /> Meta traffic report</span><h1 className="mt-3 text-3xl font-bold tracking-tight text-brand-dark">Kang Foods</h1><p className="mt-2 text-sm text-gray-500">A clear view of paid traffic to Buffalo Wild Wings.</p></div><FilterBar showChannel={false} showCompare={false} /></header>

    <div className="flex flex-wrap gap-x-6 gap-y-2 rounded-2xl border border-gray-100 bg-white px-5 py-4 text-xs text-gray-500"><span className="inline-flex items-center gap-2"><CalendarDays className="h-4 w-4 text-brand-forest" /><strong className="font-semibold text-gray-700">{params.start} to {params.end}</strong> inclusive · America/Los_Angeles</span><span className="inline-flex items-center gap-2"><Clock3 className="h-4 w-4" />Newest selected source update: {updated}</span></div>

    {data.status !== 'ready' && <div role="status" className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900"><h2 className="font-bold">{data.status === 'unavailable' ? 'Reporting source unavailable' : 'No source rows in this date range'}</h2><p className="mt-1">{data.status === 'unavailable' ? 'The reporting table, connection, or a data page could not be read. No partial totals are displayed. Ask your agency team to check the reporting sync.' : 'This is missing source coverage, not confirmation of zero spend or delivery. Try another range or check the reporting sync.'}</p></div>}

    <section aria-label="Meta traffic headline metrics" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{columns.map((col, index) => <div key={col.key} className={`rounded-3xl border p-5 shadow-sm ${index === 0 ? 'border-brand-forest/15 bg-brand-forest/5' : 'border-gray-100 bg-white'}`}><p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">{col.label}</p><p className="mt-3 text-3xl font-bold tabular-nums tracking-tight text-brand-dark">{format(summary[col.key], col.format)}</p><p className="mt-2 text-xs text-gray-500">{col.detail}</p></div>)}</section>

    <section className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm sm:p-8"><div className="mb-6 flex items-start justify-between gap-3"><div><h2 className="text-lg font-bold text-brand-dark">Daily traffic & spend</h2><p className="mt-1 text-xs text-gray-500">Daily source rows · USD spend on left axis · Traffic counts on right</p></div><ArrowUpRight className="h-5 w-5 text-brand-forest" /></div>{data.daily.length ? <div className="h-80"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={chart} margin={{ left: 0, right: 0, top: 5, bottom: 5 }}><CartesianGrid strokeDasharray="3 3" stroke="#f1f3f5" vertical={false} /><XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={date => String(date).slice(5)} /><YAxis yAxisId="spend" tick={{ fontSize: 11 }} tickFormatter={value => `$${value}`} /><YAxis yAxisId="traffic" orientation="right" tick={{ fontSize: 11 }} /><Tooltip labelFormatter={label => `Date: ${label}`} formatter={(value, name) => [value == null ? 'N/A' : format(Number(value), name === 'Spend' ? 'money' : 'number'), name]} /><Legend wrapperStyle={{ fontSize: 12, paddingTop: 14 }} /><Bar yAxisId="spend" dataKey="cost" name="Spend" fill="#0B4A31" radius={[4, 4, 0, 0]} maxBarSize={42} /><Line yAxisId="traffic" dataKey="link_clicks" name="Link clicks" stroke="#EB541E" strokeWidth={2.5} connectNulls={false} /><Line yAxisId="traffic" dataKey="landing_page_views" name="Landing page views" stroke="#2563eb" strokeWidth={2} connectNulls={false} /></ComposedChart></ResponsiveContainer></div> : <div className="flex h-64 items-center justify-center rounded-2xl bg-gray-50 text-sm text-gray-500">Daily chart is unavailable without source rows.</div>}
      <p className="mt-4 text-xs leading-5 text-gray-500">{data.daily.length} of {chart.length} selected dates have source rows.{missingDays > 0 ? ` ${missingDays} dates have no rows and are left blank, not counted as zero-delivery days.` : ''} Coverage reflects row presence, not proof that every ad has synced.</p>
    </section>

    <nav aria-label="Report sections" className="flex flex-wrap gap-3 text-sm font-semibold text-brand-forest"><a href="#kang-performance" className="rounded-full border border-gray-200 bg-white px-4 py-2 hover:bg-gray-50">Performance tables</a><a href="#kang-creatives" className="rounded-full border border-gray-200 bg-white px-4 py-2 hover:bg-gray-50">Creative performance</a></nav>
    <div id="kang-performance" className="scroll-mt-6"><PerformanceTable title="Campaign performance" rows={data.campaigns} /></div>
    <PerformanceTable title="Ad set performance" rows={data.adsets} />
    <PerformanceTable title="Ad performance" rows={data.ads} />

    <section id="kang-creatives" aria-label="Creative performance" className="scroll-mt-6 space-y-4">
      <p className="rounded-2xl border border-gray-100 bg-gray-50 px-5 py-4 text-xs leading-5 text-gray-600">Creative images and copy show the current ad creative, not a historical snapshot. Traffic metrics reflect only {params.start} to {params.end}. Missing previews do not remove ads or change reporting totals.</p>
      {data.creativeMetadataStatus === 'unavailable' && data.status === 'ready' && <p role="status" className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">Creative metadata is temporarily unavailable. Selected-period traffic performance is unchanged.</p>}
      {data.creatives.length ? <MetaAdPreviews creatives={data.creatives} title="Creative performance" description="Selected-period Meta traffic by ad" advertiserName="Kang Foods" metricMode="traffic" showAdIdentity previewLimit={null} /> : <div className="rounded-3xl border border-gray-100 bg-white p-8 text-sm text-gray-500"><h2 className="mb-2 text-lg font-bold text-brand-dark">Creative performance</h2>No ad performance source rows available for this selection.</div>}
    </section>

    <aside className="rounded-3xl border border-gray-100 bg-gray-50 p-6 text-sm text-gray-600"><h2 className="flex items-center gap-2 font-bold text-brand-dark"><Info className="h-4 w-4 text-brand-forest" /> What this report measures</h2><ul className="mt-3 space-y-2 text-xs leading-5"><li>Meta only. Google Ads was paused, verified November 24, 2026. Historical Google delivery is not included here.</li><li>Ads lead to the corporate Buffalo Wild Wings website. Sales, orders, revenue and store visits are not measured in this report. Landing page views are not orders.</li><li>Link CTR = total link clicks / total impressions. CPC (link) = total spend / total link clicks. Cost per LPV = total spend / total landing page views. Rates are weighted across source rows, not averaged.</li><li>N/A means no source coverage, a missing metric, or an undefined rate with a zero denominator. Actual reported zeros stay zero. Reach is not summed or reported.</li><li>Default scope: campaign launch November 19, 2026 through yesterday in America/Los_Angeles. Use the date filter for a different inclusive range. Totals reflect available selected source rows; the update timestamp is not a guarantee of complete ingestion.</li></ul></aside>
  </div>;
}
