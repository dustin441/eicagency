'use client';

import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AlertTriangle, Info } from 'lucide-react';
import { cn, fmtCurrency, fmtNumber } from '@/lib/utils';
import type {
  SalesOverviewChannelRow,
  SalesOverviewData,
  SalesOverviewStageTotals,
} from '@/services/prepass-sales-overview';

type StageKey = 'lead' | 'mql' | 'sql' | 'won';
const STAGES: { key: StageKey; field: 'leads' | 'mqls' | 'sqls' | 'won'; label: string }[] = [
  { key: 'lead', field: 'leads', label: 'Leads' },
  { key: 'mql', field: 'mqls', label: 'MQL' },
  { key: 'sql', field: 'sqls', label: 'SQL' },
  { key: 'won', field: 'won', label: 'Closed won' },
];

const CHANNEL_LABELS: Record<string, string> = {
  paid_social: 'Paid social',
  paid_search: 'Paid search',
  paid_other: 'Paid, other',
  event: 'Events',
  referral_partner: 'Referral and partner',
  sales_outbound: 'Sales outbound',
  online_enrollment: 'Online enrollment',
  organic_inbound: 'Organic and inbound',
  unattributed: 'Unattributed',
  other: 'Other',
};
const channelLabel = (c: string) => CHANNEL_LABELS[c] ?? c;

const GROUPS = [
  { key: 'paid', label: 'Paid ads', channels: ['paid_social', 'paid_search', 'paid_other'], color: '#EB541E' },
  { key: 'event', label: 'Events', channels: ['event'], color: '#0B4A31' },
  { key: 'referral', label: 'Referral and partner', channels: ['referral_partner'], color: '#2F7D5B' },
  { key: 'online', label: 'Online enrollment', channels: ['online_enrollment'], color: '#64748b' },
  { key: 'organic', label: 'Organic and inbound', channels: ['organic_inbound'], color: '#F2A07E' },
  { key: 'outbound', label: 'Sales outbound', channels: ['sales_outbound'], color: '#0f172a' },
  { key: 'unknown', label: 'Unattributed and other', channels: ['unattributed', 'other'], color: '#94a3b8' },
] as const;
const CHANNEL_TO_GROUP: Record<string, string> = Object.fromEntries(
  GROUPS.flatMap((g) => g.channels.map((c) => [c, g.key])),
);

const pct = (v: number | null | undefined) => (v == null || !Number.isFinite(v) ? '—' : `${v.toFixed(1)}%`);
const rate = (num: number, den: number) => (den > 0 ? (100 * num) / den : null);
const days = (v: number | null | undefined) => (v == null ? '—' : v.toFixed(1));
const money = (v: number | null) => (v == null || !Number.isFinite(v) ? '—' : fmtCurrency(v));
const cost = (spend: number, n: number) => (n > 0 ? spend / n : null);
const shortMonth = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' });
const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);

function totalFor(rows: SalesOverviewChannelRow[], channels: readonly string[], field: 'leads' | 'mqls' | 'sqls' | 'won') {
  return rows.filter((r) => channels.includes(r.channel)).reduce((s, r) => s + (r[field] ?? 0), 0);
}

function Th({ children, right = true, northStar = false }: { children: React.ReactNode; right?: boolean; northStar?: boolean }) {
  return (
    <th className={cn('whitespace-nowrap px-3 py-2 text-xs font-semibold uppercase tracking-wide', right ? 'text-right' : 'text-left', northStar ? 'bg-emerald-50 text-emerald-900' : 'text-gray-500')}>
      {children}
      {northStar && <span className="ml-1 rounded bg-emerald-700 px-1 py-0.5 text-[9px] font-bold text-white">North Star</span>}
    </th>
  );
}

function Td({ children, right = true, strong = false, northStar = false, className }: { children: React.ReactNode; right?: boolean; strong?: boolean; northStar?: boolean; className?: string }) {
  return (
    <td className={cn('whitespace-nowrap px-3 py-2 text-sm tabular-nums', right ? 'text-right' : 'text-left', strong && 'font-semibold text-gray-950', northStar && 'bg-emerald-50/60 font-semibold text-emerald-900', !strong && !northStar && 'text-gray-700', className)}>
      {children}
    </td>
  );
}

function Card({ title, subtitle, children, id }: { title: string; subtitle?: string; children: React.ReactNode; id?: string }) {
  return (
    <section id={id} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6">
      <h2 className="text-lg font-semibold text-gray-950">{title}</h2>
      {subtitle && <p className="mt-1 max-w-3xl text-sm leading-6 text-gray-500">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function TableWrap({ children }: { children: React.ReactNode }) {
  return <div className="overflow-x-auto rounded-xl border border-gray-100">{children}</div>;
}

export default function PrepassSalesOverviewClient({ data }: { data: SalesOverviewData }) {
  const [stage, setStage] = useState<StageKey>('lead');
  const [platform, setPlatform] = useState<'all' | 'Meta' | 'Google'>('all');

  const totals: SalesOverviewStageTotals = data.totals ?? {};
  const completeFrom = data.source.complete_from;
  const partialCoverage = !!completeFrom && completeFrom.slice(0, 10) > data.window.start;

  const monthly = useMemo(() => {
    const months = [...new Set(data.monthly.map((r) => r.month))].sort();
    return months.map((m) => {
      const row: Record<string, number | string> = { month: m, label: shortMonth(m) };
      GROUPS.forEach((g) => { row[g.key] = 0; });
      data.monthly.filter((r) => r.month === m && r.stage === stage).forEach((r) => {
        const g = CHANNEL_TO_GROUP[r.channel] ?? 'unknown';
        row[g] = (row[g] as number) + r.n;
      });
      return row;
    });
  }, [data.monthly, stage]);

  const campaigns = useMemo(
    () => data.campaigns.filter((c) => platform === 'all' || c.platform === platform),
    [data.campaigns, platform],
  );
  const campaignTotals = useMemo(() => campaigns.reduce(
    (t, c) => ({ spend: t.spend + c.spend, leads: t.leads + c.leads, mqls: t.mqls + c.mqls, sqls: t.sqls + c.sqls, won: t.won + c.won }),
    { spend: 0, leads: 0, mqls: 0, sqls: 0, won: 0 },
  ), [campaigns]);

  const paidChannels = GROUPS[0].channels;

  return (
    <div className="space-y-6">
      {(partialCoverage || data.source.data_through) && (
        <section className={cn('rounded-2xl border p-4 sm:p-5', partialCoverage ? 'border-amber-200 bg-amber-50' : 'border-gray-100 bg-white')}>
          <div className="flex items-start gap-3">
            {partialCoverage ? <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" /> : <Info className="mt-0.5 h-5 w-5 shrink-0 text-gray-500" />}
            <div className="text-sm leading-6 text-gray-700">
              {partialCoverage && (
                <p className="font-semibold text-amber-950">
                  Early test data. People created since {completeFrom!.slice(0, 10)} are loaded. Counts for earlier months are incomplete, and MQL, SQL and closed-won for older contacts who moved stage recently are understated, most of all closed-won.
                </p>
              )}
              <p className={partialCoverage ? 'mt-1 text-amber-900' : ''}>
                {fmtNumber(data.source.people_loaded)} people in the Marketo mirror, updated through {data.source.data_through ? new Date(data.source.data_through).toLocaleString('en-US') : 'unknown'}. Each stage is counted on the date it happened.
              </p>
            </div>
          </div>
        </section>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {STAGES.map((s) => (
          <article key={s.key} className={cn('rounded-2xl border p-5 shadow-sm', s.key === 'won' ? 'border-emerald-200 bg-emerald-50' : 'border-gray-100 bg-white')}>
            <div className="flex items-center justify-between">
              <p className={cn('text-xs font-semibold uppercase tracking-wide', s.key === 'won' ? 'text-emerald-900' : 'text-gray-500')}>{s.label}</p>
              {s.key === 'won' && <span className="rounded bg-emerald-700 px-1.5 py-0.5 text-[10px] font-bold text-white">North Star</span>}
            </div>
            <p className="mt-2 text-3xl font-bold text-gray-950">{fmtNumber(totals[s.key] ?? 0)}</p>
            <p className="mt-1 text-xs text-gray-500">
              {s.key === 'lead' ? 'People created in the period' : s.key === 'mql' ? 'Marketo MQL date in the period' : s.key === 'sql' ? 'Marketo SQL date in the period' : 'Marketo closed-won date in the period'}
            </p>
          </article>
        ))}
      </section>

      <Card title="Where each stage comes from" subtitle="Share of leads, MQLs, SQLs and closed-won by source group. Paid ads are the first row, with the other sources beside it.">
        <TableWrap>
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50">
              <tr>
                <Th right={false}>Source group</Th>
                {STAGES.map((s) => <Th key={s.key} northStar={s.key === 'won'}>{s.label}</Th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {GROUPS.map((g) => (
                <tr key={g.key}>
                  <Td right={false} strong>
                    <span className="mr-2 inline-block h-2.5 w-2.5 rounded-sm align-middle" style={{ background: g.color }} />
                    {g.label}
                  </Td>
                  {STAGES.map((s) => {
                    const n = totalFor(data.by_channel, g.channels, s.field);
                    const total = totals[s.key] ?? 0;
                    return (
                      <Td key={s.key} northStar={s.key === 'won'}>
                        {fmtNumber(n)} <span className="ml-1 text-xs text-gray-400">{total > 0 ? `${((100 * n) / total).toFixed(0)}%` : ''}</span>
                      </Td>
                    );
                  })}
                </tr>
              ))}
              <tr className="bg-gray-50">
                <Td right={false} strong>All sources</Td>
                {STAGES.map((s) => <Td key={s.key} strong>{fmtNumber(totals[s.key] ?? 0)}</Td>)}
              </tr>
            </tbody>
          </table>
        </TableWrap>
        <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Paid ads by platform type</p>
        <div className="mt-2 grid gap-3 sm:grid-cols-3">
          {paidChannels.map((c) => (
            <div key={c} className="rounded-xl border border-gray-100 p-3">
              <p className="text-sm font-semibold text-gray-950">{channelLabel(c)}</p>
              <p className="mt-1 text-xs text-gray-500">
                {fmtNumber(totalFor(data.by_channel, [c], 'leads'))} leads, {fmtNumber(totalFor(data.by_channel, [c], 'mqls'))} MQL, {fmtNumber(totalFor(data.by_channel, [c], 'sqls'))} SQL, {fmtNumber(totalFor(data.by_channel, [c], 'won'))} won
              </p>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Stages by month" subtitle="Each bar counts a stage in the month it happened, split by source group.">
        <div role="tablist" aria-label="Stage" className="mb-4 flex flex-wrap gap-1">
          {STAGES.map((s) => (
            <button
              key={s.key}
              role="tab"
              aria-selected={stage === s.key}
              onClick={() => setStage(s.key)}
              className={cn('rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors', stage === s.key ? 'bg-brand-forest text-white' : 'bg-gray-50 text-gray-600 hover:bg-gray-100')}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className="h-80 w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthly} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
              <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#6b7280' }} tickLine={false} axisLine={{ stroke: '#e5e7eb' }} />
              <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} tickLine={false} axisLine={false} width={48} tickFormatter={(v: number) => (v >= 1000 ? `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k` : String(v))} />
              <Tooltip formatter={(v) => fmtNumber(Number(v))} cursor={{ fill: 'rgba(15,23,42,0.04)' }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {GROUPS.map((g) => (
                <Bar key={g.key} dataKey={g.key} name={g.label} stackId="a" fill={g.color} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card title="How well each channel converts" subtitle="People created in the period, grouped by how they came in. Rates compare people who reached each stage. Amber means over 100%, which happens when Marketo records an SQL or closed-won without the stage before it. Days are medians.">
        <TableWrap>
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50">
              <tr>
                <Th right={false}>Channel</Th><Th>Leads</Th><Th>MQL</Th><Th>SQL</Th><Th northStar>Won</Th>
                <Th>Lead to MQL</Th><Th>MQL to SQL</Th><Th>SQL to won</Th><Th>Days to MQL</Th><Th>Days MQL to SQL</Th><Th>Days SQL to won</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.cohort.map((r) => {
                const a = rate(r.mqls, r.leads), b = rate(r.sqls, r.mqls), c = rate(r.won, r.sqls);
                const warn = (v: number | null) => (v != null && v > 100 ? 'text-amber-700' : undefined);
                return (
                  <tr key={r.channel}>
                    <Td right={false} strong>{channelLabel(r.channel)}</Td>
                    <Td>{fmtNumber(r.leads)}</Td><Td>{fmtNumber(r.mqls)}</Td><Td>{fmtNumber(r.sqls)}</Td><Td northStar>{fmtNumber(r.won)}</Td>
                    <Td className={warn(a)}>{pct(a)}</Td><Td className={warn(b)}>{pct(b)}</Td><Td className={warn(c)}>{pct(c)}</Td>
                    <Td>{days(r.days_to_mql)}</Td><Td>{days(r.days_mql_to_sql)}</Td><Td>{days(r.days_sql_to_won)}</Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableWrap>
      </Card>

      <Card title="Paid ads: spend against pipeline" subtitle="Ad spend comes from the warehouse tables for each platform. Marketo people are matched to campaigns by campaign ID for Meta and by campaign name for Google, so spend sits next to the MQLs, SQLs and closed-won it produced. Cost per closed won is the North Star. Lower is better.">
        <div className="mb-4 flex flex-wrap gap-2">
          {data.spend.map((s) => {
            const stale = s.last_day ? daysBetween(s.last_day, data.window.end) > 3 : true;
            return (
              <div key={s.platform} className={cn('rounded-xl border px-3 py-2 text-xs', stale ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-gray-100 bg-gray-50 text-gray-600')}>
                <span className="font-semibold text-gray-950">{s.platform}</span> {fmtCurrency(s.spend)}
                {s.last_day ? `, data through ${s.last_day}` : ''}{stale ? ', not current' : ''}, {s.days} days
              </div>
            );
          })}
        </div>
        <div role="tablist" aria-label="Platform" className="mb-3 flex gap-1">
          {(['all', 'Meta', 'Google'] as const).map((p) => (
            <button key={p} role="tab" aria-selected={platform === p} onClick={() => setPlatform(p)}
              className={cn('rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors', platform === p ? 'bg-brand-forest text-white' : 'bg-gray-50 text-gray-600 hover:bg-gray-100')}>
              {p === 'all' ? 'All platforms' : p}
            </button>
          ))}
        </div>
        <TableWrap>
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50">
              <tr>
                <Th right={false}>Campaign</Th><Th>Platform</Th><Th>Spend</Th><Th>Leads</Th><Th>MQL</Th><Th>SQL</Th><Th northStar>Won</Th>
                <Th>Cost / MQL</Th><Th>Cost / SQL</Th><Th northStar>Cost / won</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {campaigns.map((c) => (
                <tr key={`${c.platform}-${c.campaign}`}>
                  <Td right={false} strong className="max-w-[22rem] truncate">{c.campaign}</Td>
                  <Td>{c.platform}</Td><Td>{fmtCurrency(c.spend)}</Td>
                  <Td>{fmtNumber(c.leads)}</Td><Td>{fmtNumber(c.mqls)}</Td><Td>{fmtNumber(c.sqls)}</Td><Td northStar>{fmtNumber(c.won)}</Td>
                  <Td>{money(cost(c.spend, c.mqls))}</Td><Td>{money(cost(c.spend, c.sqls))}</Td><Td northStar>{money(cost(c.spend, c.won))}</Td>
                </tr>
              ))}
              <tr className="bg-gray-50">
                <Td right={false} strong>Total, matched and unmatched spend</Td><Td>{''}</Td>
                <Td strong>{fmtCurrency(campaignTotals.spend)}</Td><Td strong>{fmtNumber(campaignTotals.leads)}</Td><Td strong>{fmtNumber(campaignTotals.mqls)}</Td><Td strong>{fmtNumber(campaignTotals.sqls)}</Td><Td strong>{fmtNumber(campaignTotals.won)}</Td>
                <Td strong>{money(cost(campaignTotals.spend, campaignTotals.mqls))}</Td><Td strong>{money(cost(campaignTotals.spend, campaignTotals.sqls))}</Td><Td strong>{money(cost(campaignTotals.spend, campaignTotals.won))}</Td>
              </tr>
            </tbody>
          </table>
        </TableWrap>
        <ul className="mt-3 space-y-1 text-xs leading-5 text-gray-500">
          <li>Meta: {fmtNumber(data.match.meta_people_matched)} of {fmtNumber(data.match.meta_people_total)} paid-social people matched to a campaign by ID, covering {fmtCurrency(data.match.meta_spend_matched)} of spend.</li>
          <li>Google: {fmtNumber(data.match.google_people_matched)} of {fmtNumber(data.match.google_people_total)} paid-search people matched to a campaign by name, covering {fmtCurrency(data.match.google_spend_matched)} of spend. Unmatched people usually carry a campaign name that differs from the Google campaign name.</li>
          <li>Recent leads have not had time to close, so cost per won falls as the period matures. Campaigns with spend but no matched people show zeros, not missing data.</li>
          <li>LinkedIn and StackAdapt spend is shown above but not matched to people yet. Microsoft Ads, TikTok and GroundTruth are not in the warehouse.</li>
        </ul>
      </Card>

      <Card title="Events" subtitle="People whose Marketo source is an event, booth scan or webinar, by event name.">
        <TableWrap>
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50"><tr><Th right={false}>Event</Th><Th>Leads</Th><Th>MQL</Th><Th>SQL</Th><Th northStar>Won</Th><Th>Lead to SQL</Th></tr></thead>
            <tbody className="divide-y divide-gray-100">
              {data.events.map((e) => (
                <tr key={e.event}>
                  <Td right={false} strong>{e.event}</Td><Td>{fmtNumber(e.leads)}</Td><Td>{fmtNumber(e.mqls)}</Td><Td>{fmtNumber(e.sqls)}</Td><Td northStar>{fmtNumber(e.won)}</Td><Td>{pct(rate(e.sqls, e.leads))}</Td>
                </tr>
              ))}
              {data.events.length === 0 && <tr><Td right={false}>No event leads in this period.</Td><Td>{''}</Td><Td>{''}</Td><Td>{''}</Td><Td>{''}</Td><Td>{''}</Td></tr>}
            </tbody>
          </table>
        </TableWrap>
      </Card>

      <details className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6">
        <summary className="cursor-pointer text-lg font-semibold text-gray-950">Every source, lead source and UTM combination</summary>
        <p className="mt-2 text-sm text-gray-500">The top combinations by leads. Use this to see how Marketo records each source and where the channel grouping needs refining.</p>
        <div className="mt-4">
          <TableWrap>
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50"><tr><Th right={false}>Channel</Th><Th right={false}>Lead source</Th><Th right={false}>UTM medium</Th><Th right={false}>UTM source</Th><Th>Leads</Th><Th>MQL</Th><Th>SQL</Th><Th northStar>Won</Th></tr></thead>
              <tbody className="divide-y divide-gray-100">
                {data.sources.map((s, i) => (
                  <tr key={i}>
                    <Td right={false} strong>{channelLabel(s.channel)}</Td>
                    <Td right={false}>{s.lead_source || '—'}</Td><Td right={false}>{s.utm_medium || '—'}</Td><Td right={false} className="max-w-[18rem] truncate">{s.utm_source || '—'}</Td>
                    <Td>{fmtNumber(s.leads)}</Td><Td>{fmtNumber(s.mqls)}</Td><Td>{fmtNumber(s.sqls)}</Td><Td northStar>{fmtNumber(s.won)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        </div>
      </details>

      <details className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6">
        <summary className="cursor-pointer text-lg font-semibold text-gray-950">What to know about this data</summary>
        <div className="mt-3 space-y-2 text-sm leading-6 text-gray-600">
          <p>Marketo stages are not a strict funnel. Some people have an SQL date without an MQL date, and many closed-won customers have no MQL or SQL date at all, so rates can pass 100% or look very low. Counting each stage on its own date avoids most of that.</p>
          <p>Channels come from one mapping on Marketo lead source, UTM medium and UTM source. Events appear as UTM medium Event, Booth Badge Scan or webinar, with the event name in UTM source. The mapping is one database function and is easy to refine.</p>
          <p>This tab is comparison only. It reads a separate Marketo mirror and does not change any existing PrePass report or the legacy numbers.</p>
        </div>
      </details>
    </div>
  );
}
