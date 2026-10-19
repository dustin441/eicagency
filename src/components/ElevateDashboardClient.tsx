'use client';

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AlertTriangle, CheckCircle2, DollarSign, Eye, FileCheck2, MousePointer2, Percent, Radio } from 'lucide-react';
import FilterBar from '@/components/FilterBar';
import type { ElevateDashboardData } from '@/services/elevate-analytics-core';

const money = (value: number) => value.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
const whole = (value: number) => Math.round(value).toLocaleString('en-US');
const percent = (value: number) => `${value.toFixed(2)}%`;

function Metric({ label, value, detail, icon: Icon }: { label: string; value: string; detail: string; icon: typeof DollarSign }) {
  return <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm"><div className="mb-4 flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-forest/10 text-brand-forest"><Icon className="h-5 w-5" /></div><p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{label}</p><p className="mt-1 text-2xl font-bold tabular-nums text-brand-dark">{value}</p><p className="mt-1 text-xs text-gray-400">{detail}</p></div>;
}

export default function ElevateDashboardClient({ data }: { data: ElevateDashboardData }) {
  const metricsUnavailable = Boolean(data.sourceError || data.selectionUnavailable);
  return <div className="space-y-6 pb-10">
    <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
      <div><div className="mb-2 inline-flex items-center gap-2 rounded-full bg-brand-orange/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-brand-orange"><Radio className="h-3.5 w-3.5" /> Short-term event campaign</div><h1 className="text-3xl font-bold tracking-tight text-brand-dark">Elevate Campaign Performance</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-gray-500">A focused view of delivery, form-fill tracking, and creative performance. Lead quality and registrations are supplied separately by the client and are intentionally not inferred here.</p></div>
      <FilterBar showChannel showCompare={false} channelOptions={[{ value: 'all', label: 'All Channels' }, { value: 'Google Search', label: 'Google Search' }, { value: 'Meta', label: 'Meta' }, { value: 'LinkedIn', label: 'LinkedIn' }, { value: 'GroundTruth', label: 'GroundTruth' }]} />
    </header>

    {data.sourceError && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><strong>Source error:</strong> {data.sourceError}</div>}

    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      <Metric label="Spend" value={metricsUnavailable ? 'Unavailable' : money(data.totalSpend)} detail={`Latest connected source: ${data.sourceLatestDate ?? 'No rows'}`} icon={DollarSign} />
      <Metric label="Impressions" value={metricsUnavailable ? 'Unavailable' : whole(data.totalImpressions)} detail="Connected channels in selection" icon={Eye} />
      <Metric label="Clicks" value={metricsUnavailable ? 'Unavailable' : whole(data.totalClicks)} detail="Provider-reported clicks" icon={MousePointer2} />
      <Metric label="CTR" value={metricsUnavailable ? 'Unavailable' : percent(data.ctr)} detail="Clicks ÷ impressions" icon={Percent} />
      <Metric label="Form fills" value={data.formFills === null ? 'Unavailable' : whole(data.formFills)} detail={data.formFillCoverage === 'unavailable' ? 'No verified form-fill event in connected data' : `${data.formFillCoverage} source coverage`} icon={FileCheck2} />
    </section>

    <section className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
      <div><h2 className="text-lg font-bold text-brand-dark">Channel coverage</h2><p className="mt-1 text-xs text-gray-400">Unavailable metrics are shown as unavailable—not as zero.</p></div>
      <div className="mt-5 grid gap-4 lg:grid-cols-2 xl:grid-cols-4">{data.channels.map(channel => <div key={channel.platform} className="rounded-2xl border border-gray-100 p-4"><div className="flex items-start justify-between gap-3"><p className="font-bold text-brand-dark">{channel.platform}</p><span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${channel.status === 'connected' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{channel.status === 'connected' ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}{channel.status}</span></div>{channel.status === 'connected' ? <div className="mt-4 grid grid-cols-2 gap-3 text-sm"><div><p className="text-[10px] uppercase text-gray-400">Spend</p><p className="font-bold">{money(channel.spend ?? 0)}</p></div><div><p className="text-[10px] uppercase text-gray-400">CTR</p><p className="font-bold">{percent(channel.ctr ?? 0)}</p></div><div><p className="text-[10px] uppercase text-gray-400">Clicks</p><p className="font-bold">{whole(channel.clicks ?? 0)}</p></div><div><p className="text-[10px] uppercase text-gray-400">Form fills</p><p className="font-bold">{channel.formFills === null ? 'Unavailable' : whole(channel.formFills)}</p></div></div> : <p className="mt-4 text-xs leading-5 text-amber-800">{channel.limitation}</p>}</div>)}</div>
    </section>

    <section className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm"><div className="mb-5"><h2 className="text-lg font-bold text-brand-dark">Spend trend</h2><p className="mt-1 text-xs text-gray-400">Daily completed-date performance for connected sources</p></div>{data.daily.length ? <div className="h-72"><ResponsiveContainer width="100%" height="100%"><AreaChart data={data.daily}><defs><linearGradient id="elevateSpend" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#0B4A31" stopOpacity={0.32} /><stop offset="95%" stopColor="#0B4A31" stopOpacity={0.03} /></linearGradient></defs><CartesianGrid strokeDasharray="3 3" stroke="#eef0f2" /><XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9ca3af' }} tickFormatter={value => String(value).slice(5)} /><YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} tickFormatter={value => `$${value}`} /><Tooltip formatter={value => money(Number(value ?? 0))} /><Area type="monotone" dataKey="spend" stroke="#0B4A31" fill="url(#elevateSpend)" strokeWidth={2.5} /></AreaChart></ResponsiveContainer></div> : <div className="flex h-64 items-center justify-center rounded-2xl bg-gray-50 text-sm text-gray-400">No connected delivery in this selection.</div>}</section>

    <section className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm"><div><h2 className="text-lg font-bold text-brand-dark">Performance by creative</h2><p className="mt-1 text-xs text-gray-400">Aggregated across the selected period and sorted by spend.</p></div><div className="mt-5 overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm"><thead><tr className="border-b border-gray-100 text-[10px] uppercase tracking-wider text-gray-400"><th className="pb-3">Creative</th><th className="pb-3">Channel</th><th className="pb-3 text-right">Spend</th><th className="pb-3 text-right">Impressions</th><th className="pb-3 text-right">Clicks</th><th className="pb-3 text-right">CTR</th><th className="pb-3 text-right">Form fills</th></tr></thead><tbody>{data.creatives.map(creative => <tr key={`${creative.platform}-${creative.creativeId}`} className="border-b border-gray-50"><td className="py-4"><p className="font-semibold text-brand-dark">{creative.creativeName}</p><p className="mt-0.5 text-xs text-gray-400">{creative.campaignName}</p>{creative.previewUrl && <a className="mt-1 inline-block text-xs font-semibold text-brand-forest hover:underline" href={creative.previewUrl} target="_blank" rel="noreferrer">Open preview</a>}</td><td className="py-4">{creative.platform}</td><td className="py-4 text-right tabular-nums">{money(creative.spend)}</td><td className="py-4 text-right tabular-nums">{whole(creative.impressions)}</td><td className="py-4 text-right tabular-nums">{whole(creative.clicks)}</td><td className="py-4 text-right tabular-nums">{percent(creative.ctr)}</td><td className="py-4 text-right tabular-nums">{creative.formFills === null ? 'Unavailable' : whole(creative.formFills)}</td></tr>)}</tbody></table>{!data.creatives.length && <p className="py-10 text-center text-sm text-gray-400">No creative delivery in this selection.</p>}</div></section>
  </div>;
}
