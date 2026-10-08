'use client';

import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Building2, CheckCircle2, Search, Target, Truck, Users } from 'lucide-react';
import FilterBar from '@/components/FilterBar';
import { cn } from '@/lib/utils';
import type { LargeFleetAnalysis } from '@/services/prepass-large-fleet';

type Metric = 'contacts' | 'mqls' | 'sqls' | 'won';

const METRICS: { key: Metric; label: string; color: string }[] = [
  { key: 'contacts', label: 'Contacts', color: '#7C3AED' },
  { key: 'mqls', label: 'MQLs', color: '#EB541E' },
  { key: 'sqls', label: 'SQLs', color: '#2563EB' },
  { key: 'won', label: 'WON', color: '#0B4A31' },
];

function formatDate(value: string): string {
  return new Date(`${value}T12:00:00Z`).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  });
}

export default function LargeFleetSourceAnalysisClient({ data }: { data: LargeFleetAnalysis }) {
  const [metric, setMetric] = useState<Metric>('contacts');
  const [channel, setChannel] = useState('all');
  const [query, setQuery] = useState('');
  const [contactQuery, setContactQuery] = useState('');
  const activeMetric = METRICS.find((item) => item.key === metric) ?? METRICS[0];
  const chartData = useMemo(() => data.channels
    .map((row) => ({ name: row.primaryChannel, value: row[metric], share: row.contactShare }))
    .filter((row) => row.value > 0)
    .sort((a, b) => b.value - a.value), [data.channels, metric]);
  const visibleSources = useMemo(() => data.sources.filter((row) => {
    if (channel !== 'all' && row.primaryChannel !== channel) return false;
    const needle = query.trim().toLowerCase();
    return !needle || `${row.primaryChannel} ${row.primarySource}`.toLowerCase().includes(needle);
  }), [data.sources, channel, query]);
  const visibleContacts = useMemo(() => data.contacts.filter((row) => {
    if (channel !== 'all' && row.primaryChannel !== channel) return false;
    const needle = contactQuery.trim().toLowerCase();
    return !needle || `${row.company ?? ''} ${row.email ?? ''} ${row.primaryChannel} ${row.primarySource} ${row.sourceDetail ?? ''}`.toLowerCase().includes(needle);
  }), [data.contacts, channel, contactQuery]);
  const unidentifiedShare = data.totals.contacts > 0
    ? (100 * data.totals.unidentified / data.totals.contacts).toFixed(1)
    : '0.0';

  const cards = [
    { label: '100+ Fleet Contacts', value: data.totals.contacts, icon: Truck, color: 'text-violet-600' },
    { label: '500+ Fleets', value: data.totals.fleets500Plus, icon: Building2, color: 'text-cyan-700' },
    { label: 'MQLs', value: data.totals.mqls, icon: Users, color: 'text-orange-600' },
    { label: 'SQLs', value: data.totals.sqls, icon: Target, color: 'text-blue-600' },
    { label: 'Closed Won', value: data.totals.won, icon: CheckCircle2, color: 'text-emerald-700' },
  ];

  return (
    <main className="space-y-6 pb-12">
      <header className="rounded-[2.5rem] bg-brand-dark px-7 py-8 text-white shadow-sm md:px-10">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-white/55">PrePass, Marketo source intelligence</p>
        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Large Fleet Source Analysis</h1>
            <p className="mt-2 max-w-3xl text-sm font-medium text-white/65 md:text-base">
              Every Marketo contact reporting at least 100 trucks, classified after ingestion across paid media, events, email, partners, referrals, organic, direct, and unidentified sources.
            </p>
          </div>
          <p className="text-sm font-semibold text-white/70">
            {formatDate(data.start)} to {formatDate(data.end)}
          </p>
        </div>
      </header>

      <FilterBar showChannel={false} />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {cards.map(({ label, value, icon: Icon, color }) => (
          <article key={label} className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">{label}</p>
              <Icon className={cn('h-4 w-4', color)} />
            </div>
            <p className="mt-3 text-3xl font-bold tabular-nums text-brand-dark">{value.toLocaleString()}</p>
          </article>
        ))}
      </section>

      <section className="rounded-[2.5rem] border border-gray-100 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-gray-100 p-7 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-xl font-bold text-brand-dark">Share of large-fleet outcomes by channel</h2>
            <p className="mt-1 text-sm font-medium text-gray-400">
              Primary channels are mutually exclusive, so contact percentages total 100%.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {METRICS.map((item) => (
              <button
                key={item.key}
                type="button"
                aria-pressed={metric === item.key}
                onClick={() => setMetric(item.key)}
                className={cn(
                  'rounded-full border px-4 py-2 text-xs font-bold transition-colors',
                  metric === item.key ? 'border-transparent text-white' : 'border-gray-200 bg-gray-50 text-gray-500',
                )}
                style={metric === item.key ? { backgroundColor: item.color } : undefined}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
        <div className="p-7">
          {chartData.length > 0 ? (
            <div style={{ height: Math.max(340, chartData.length * 52) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical" margin={{ top: 8, right: 30, bottom: 8, left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E5E7EB" />
                  <XAxis type="number" allowDecimals={false} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" width={170} axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280', fontWeight: 600 }} />
                  <Tooltip
                    cursor={{ fill: '#F9FAFB' }}
                    formatter={(value) => [Number(value).toLocaleString(), activeMetric.label]}
                    contentStyle={{ border: 0, borderRadius: 16, boxShadow: '0 10px 25px rgb(15 23 42 / 0.12)' }}
                  />
                  <Bar dataKey="value" fill={activeMetric.color} radius={[0, 10, 10, 0]} maxBarSize={30} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex h-64 items-center justify-center rounded-3xl bg-gray-50 text-sm font-semibold text-gray-400">
              No {activeMetric.label.toLowerCase()} in this period.
            </div>
          )}
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-gray-50 p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Unidentified</p>
              <p className="mt-1 text-xl font-bold text-brand-dark">{unidentifiedShare}%</p>
            </div>
            <div className="rounded-2xl bg-gray-50 p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Paid-influenced contacts</p>
              <p className="mt-1 text-xl font-bold text-brand-dark">{data.totals.paidInfluenced.toLocaleString()}</p>
            </div>
            <div className="rounded-2xl bg-gray-50 p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Identified channels</p>
              <p className="mt-1 text-xl font-bold text-brand-dark">{data.channels.filter((row) => row.primaryChannel !== 'Unidentified').length}</p>
            </div>
          </div>
          <div className="mt-5 overflow-x-auto rounded-2xl border border-gray-100">
            <table className="min-w-full text-left text-xs">
              <thead className="bg-gray-50 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                <tr><th className="px-4 py-3">Channel</th><th className="px-4 py-3 text-right">100-500</th><th className="px-4 py-3 text-right">500+</th><th className="px-4 py-3 text-right">500+ share</th></tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.channels.map((row) => {
                  const lowerBand = Math.max(0, row.contacts - row.fleets500Plus);
                  const upperShare = row.contacts > 0 ? 100 * row.fleets500Plus / row.contacts : 0;
                  return (
                    <tr key={row.primaryChannel}>
                      <td className="px-4 py-3 font-semibold text-brand-dark">{row.primaryChannel}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-gray-600">{lowerBand.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right font-bold tabular-nums text-cyan-700">{row.fleets500Plus.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-gray-500">{upperShare.toFixed(1)}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-[2.5rem] border border-gray-100 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-gray-100 p-7 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-xl font-bold text-brand-dark">Source detail</h2>
            <p className="mt-1 text-sm font-medium text-gray-400">Original Marketo evidence is favored, with current UTMs retained as supporting evidence.</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <select value={channel} onChange={(event) => setChannel(event.target.value)} className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-semibold text-gray-700">
              <option value="all">All channels</option>
              {data.channels.map((row) => <option key={row.primaryChannel} value={row.primaryChannel}>{row.primaryChannel}</option>)}
            </select>
            <label className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
              <Search className="h-4 w-4 text-gray-400" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search source" className="w-44 bg-transparent text-sm font-medium text-gray-700 outline-none" />
            </label>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-gray-50 text-[10px] font-bold uppercase tracking-widest text-gray-400">
              <tr><th className="px-6 py-4">Channel</th><th className="px-6 py-4">Source</th><th className="px-6 py-4 text-right">Contacts</th><th className="px-6 py-4 text-right">Share</th><th className="px-6 py-4 text-right">MQL</th><th className="px-6 py-4 text-right">SQL</th><th className="px-6 py-4 text-right">WON</th></tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {visibleSources.map((row) => (
                <tr key={`${row.primaryChannel}:${row.primarySource}`} className="hover:bg-gray-50/70">
                  <td className="px-6 py-4 font-semibold text-brand-dark">{row.primaryChannel}</td>
                  <td className="max-w-md px-6 py-4 font-medium text-gray-600">{row.primarySource}</td>
                  <td className="px-6 py-4 text-right font-bold tabular-nums text-brand-dark">{row.contacts.toLocaleString()}</td>
                  <td className="px-6 py-4 text-right font-semibold tabular-nums text-gray-500">{row.contactShare.toFixed(1)}%</td>
                  <td className="px-6 py-4 text-right tabular-nums text-gray-600">{row.mqls.toLocaleString()}</td>
                  <td className="px-6 py-4 text-right tabular-nums text-gray-600">{row.sqls.toLocaleString()}</td>
                  <td className="px-6 py-4 text-right font-bold tabular-nums text-emerald-700">{row.won.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {visibleSources.length === 0 && <p className="p-8 text-center text-sm font-semibold text-gray-400">No sources match these filters.</p>}
        </div>
      </section>
      <section className="overflow-hidden rounded-[2.5rem] border border-gray-100 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-gray-100 p-7 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-xl font-bold text-brand-dark">Contact drill-down</h2>
            <p className="mt-1 text-sm font-medium text-gray-400">
              Most recently active contacts in the selected period, up to 1,000 rows. Use the shared channel filter above to narrow the table.
            </p>
          </div>
          <label className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
            <Search className="h-4 w-4 text-gray-400" />
            <input value={contactQuery} onChange={(event) => setContactQuery(event.target.value)} placeholder="Search company, email, or source" className="w-64 bg-transparent text-sm font-medium text-gray-700 outline-none" />
          </label>
        </div>
        <div className="max-h-[42rem] overflow-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="sticky top-0 z-10 bg-gray-50 text-[10px] font-bold uppercase tracking-widest text-gray-400">
              <tr><th className="px-6 py-4">Company / contact</th><th className="px-6 py-4">Fleet</th><th className="px-6 py-4">Stage</th><th className="px-6 py-4">Channel</th><th className="px-6 py-4">Source evidence</th><th className="px-6 py-4">Last activity</th></tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {visibleContacts.map((row) => {
                const stage = row.dateClosedWon ? 'WON' : row.dateSql ? 'SQL' : row.dateMql ? 'MQL' : 'Lead';
                return (
                  <tr key={row.marketoId} className="align-top hover:bg-gray-50/70">
                    <td className="px-6 py-4">
                      <p className="font-semibold text-brand-dark">{row.company || 'Company not provided'}</p>
                      <p className="mt-1 text-xs font-medium text-gray-400">{row.email || `Marketo ${row.marketoId}`}</p>
                    </td>
                    <td className="px-6 py-4 font-semibold text-gray-700">{row.fleetSizeValue?.toLocaleString() || row.fleetSizeBand}</td>
                    <td className="px-6 py-4"><span className="rounded-full bg-gray-100 px-2.5 py-1 text-[10px] font-bold text-gray-600">{stage}</span></td>
                    <td className="px-6 py-4 font-semibold text-brand-dark">{row.primaryChannel}</td>
                    <td className="max-w-md px-6 py-4">
                      <p className="font-medium text-gray-700">{row.primarySource}</p>
                      {row.sourceDetail && <p className="mt-1 text-xs text-gray-400">{row.sourceDetail}</p>}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-xs font-medium text-gray-500">{row.lastActivityAt ? new Date(row.lastActivityAt).toLocaleDateString('en-US', { timeZone: 'UTC' }) : 'Not available'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {visibleContacts.length === 0 && <p className="p-8 text-center text-sm font-semibold text-gray-400">No contacts match these filters.</p>}
        </div>
      </section>
    </main>
  );
}
