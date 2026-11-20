import Link from 'next/link';
import { cn, fmtNumber } from '@/lib/utils';
import type { SegmentCampaignRow, SegmentChannelRow, SegmentName, SegmentReportData } from '@/services/prepass-segment-report';

export type SegmentView = 'cohort' | 'events';

const money = (n: number | null | undefined) => (n == null ? '—' : `$${Math.round(n).toLocaleString('en-US')}`);
const per = (spend: number | null | undefined, n: number) => (spend != null && spend > 0 && n > 0 ? money(spend / n) : '—');

const CHANNEL_LABEL: Record<string, string> = {
  online_enrollment: 'Online enrollment',
  organic_inbound: 'Organic and inbound',
  event: 'Events',
  sales_outbound: 'Sales outbound',
  referral_partner: 'Referral and partner',
  paid_social: 'Paid social',
  paid_search: 'Paid search',
  paid_other: 'Other paid',
  unattributed: 'Unattributed',
  other: 'Other',
};

function Th({ children, left = false }: { children: React.ReactNode; left?: boolean }) {
  return <th className={cn('whitespace-nowrap px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500', left ? 'text-left' : 'text-right')}>{children}</th>;
}
function Td({ children, left = false, strong = false, warn = false }: { children: React.ReactNode; left?: boolean; strong?: boolean; warn?: boolean }) {
  return <td className={cn('px-3 py-2 text-sm tabular-nums', left ? 'text-left' : 'text-right', strong ? 'font-semibold text-gray-950' : 'text-gray-700', warn && 'bg-amber-50 text-amber-900')}>{children}</td>;
}
function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6">
      <h2 className="text-lg font-semibold text-gray-950">{title}</h2>
      {subtitle && <p className="mt-1 max-w-3xl text-sm leading-6 text-gray-500">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

const callWon = (r: { call_e_won?: number; call_c_won?: number }, view: SegmentView) => (view === 'cohort' ? r.call_c_won : r.call_e_won) ?? 0;

const pick = (r: { c_mql: number; c_sql: number; c_won: number; e_mql: number; e_sql: number; e_won: number }, view: SegmentView) =>
  view === 'cohort' ? { mql: r.c_mql, sql: r.c_sql, won: r.c_won } : { mql: r.e_mql, sql: r.e_sql, won: r.e_won };

function dataThrough(d: string | null) {
  return d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'unknown';
}

/** Marketo people vs what Meta reports as leads, for campaigns in this segment. Flags campaigns where Marketo has well under what the platform claims. */
export function ReconBlock({ data }: { data: SegmentReportData }) {
  const own = data.campaigns.filter((c) => c.campaign_segment === data.segment);
  const meta = own.filter((c) => (c.lead_actions ?? 0) > 0);
  const platformLeads = meta.reduce((a, c) => a + (c.lead_actions ?? 0), 0);
  const marketoLeads = meta.reduce((a, c) => a + c.leads, 0);
  const contactActions = own.reduce((a, c) => a + (c.contact_actions ?? 0), 0);
  const flagged = meta.filter((c) => (c.lead_actions ?? 0) >= 20 && c.leads / (c.lead_actions ?? 1) < 0.6);
  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
          <div className="text-2xl font-semibold text-gray-950">{platformLeads > 0 ? `${Math.round((100 * marketoLeads) / platformLeads)}%` : '—'}</div>
          <div className="mt-1 text-xs leading-5 text-gray-500">of the {fmtNumber(platformLeads)} lead-form leads Meta reports for these campaigns appear as {fmtNumber(marketoLeads)} people in Marketo</div>
        </div>
        <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
          <div className="text-2xl font-semibold text-gray-950">{fmtNumber(contactActions)}</div>
          <div className="mt-1 text-xs leading-5 text-gray-500">website conversions Meta calls leads or contacts. They are page events, not form fills, so they will not match Marketo people</div>
        </div>
        <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
          <div className="text-2xl font-semibold text-gray-950">{flagged.length}</div>
          <div className="mt-1 text-xs leading-5 text-gray-500">campaigns where Marketo has under 60% of what the platform reports (shaded in the table)</div>
        </div>
      </div>
      {data.unmapped_spend.length > 0 && (
        <p className="mt-3 max-w-3xl text-xs leading-5 text-amber-900">
          Spend not yet assigned to a segment: {data.unmapped_spend.map((u) => `${u.campaign} (${money(u.spend)})`).join(', ')}. Add them to the campaign map so they count here.
        </p>
      )}
    </div>
  );
}

export function SegmentTab({ data, view, basePath, search }: { data: SegmentReportData; view: SegmentView; basePath: string; search: Record<string, string | undefined> }) {
  const t = pick(data.totals, view);
  const spend = data.segment_spend;
  const link = (v: SegmentView) => {
    const q = new URLSearchParams();
    Object.entries(search).forEach(([k, val]) => { if (val && k !== 'view') q.set(k, val); });
    q.set('view', v);
    return `${basePath}?${q.toString()}`;
  };
  const rows = data.campaigns.filter((c) => c.leads + c.e_mql + c.e_sql + c.e_won > 0 || (c.spend ?? 0) > 100);
  const isAbm = data.segment === 'ABM';
  const channels = data.channels.filter((c) => c.leads + c.e_mql + c.e_won > 0);

  const wonViaCalls = callWon(data.totals, view);
  const cards: [string, string, string?][] = [
    ['Leads', fmtNumber(data.totals.leads)],
    ['MQL', fmtNumber(t.mql)],
    ['SQL', fmtNumber(t.sql)],
    ['Closed won', fmtNumber(t.won), wonViaCalls > 0 ? `${fmtNumber(wonViaCalls)} matched through phone calls` : undefined],
  ];
  const callsPartial = data.window.start < data.calls_valid_from;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex rounded-xl border border-gray-200 p-1 text-sm font-semibold">
            <Link href={link('events')} className={cn('rounded-lg px-3 py-1.5', view === 'events' ? 'bg-brand-forest text-white' : 'text-gray-600 hover:bg-gray-50')}>Stages in the period</Link>
            <Link href={link('cohort')} className={cn('rounded-lg px-3 py-1.5', view === 'cohort' ? 'bg-brand-forest text-white' : 'text-gray-600 hover:bg-gray-50')}>People who signed up in the period</Link>
          </div>
          <p className="text-xs text-gray-500">Marketo data through {dataThrough(data.data_through)}</p>
        </div>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-gray-600">
          {view === 'events'
            ? 'Each stage is counted on the day it happened, whenever the person signed up. A win in this period counts even if they became a lead earlier. This is how the original dashboard counts.'
            : 'Only people who signed up in this period, followed to wherever they got to since. Recent sign-ups have not had time to convert, so their wins are still growing. This is the fairest way to compare campaigns.'}
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {cards.map(([label, value, note]) => (
          <article key={label} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
            <p className="mt-2 text-3xl font-bold text-gray-950">{value}</p>
            {note && <p className="mt-1 text-xs text-gray-500">{note}</p>}
          </article>
        ))}
        <article className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Ad spend</p>
          <p className="mt-2 text-3xl font-bold text-gray-950">{money(spend)}</p>
          <p className="mt-1 text-xs text-gray-500">{per(spend, t.won)} per closed won</p>
        </article>
      </section>

      {callsPartial && (
        <p className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
          Caller phone numbers are only recorded from {dataThrough(data.calls_valid_from)}, so wins matched through calls are missing for the part of this period before then. Closed won and cost per win read high for earlier dates.
        </p>
      )}

      {isAbm && (
        <p className="rounded-2xl border border-gray-100 bg-white p-4 text-sm leading-6 text-gray-700 shadow-sm">
          <span className="font-semibold text-gray-950">{fmtNumber(data.totals.fleet100_leads)} of these leads have a fleet of 100 or more vehicles</span>, whichever campaign or channel brought them in. Fleet size is self-declared on the form and verified only when the deal closes.
        </p>
      )}

      <Card title="Where the results come from, by campaign" subtitle="Spend and platform leads are only shown against a campaign's own segment, so nothing is counted twice. Shaded cells are campaigns where Marketo has under 60% of the leads Meta reports.">
        <div className="overflow-x-auto rounded-xl border border-gray-100">
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50">
              <tr><Th left>Campaign</Th><Th>Spend</Th><Th>Leads</Th><Th>MQL</Th><Th>SQL</Th><Th>Won</Th><Th>Of which calls</Th><Th>Cost per MQL</Th><Th>Cost per won</Th><Th>Platform leads</Th><Th>Marketo has</Th></tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((c: SegmentCampaignRow) => {
                const m = pick(c, view);
                const own = c.campaign_segment === data.segment;
                const pl = own ? c.lead_actions : null;
                const ratio = pl && pl > 0 ? c.leads / pl : null;
                const warn = ratio != null && pl != null && pl >= 20 && ratio < 0.6;
                return (
                  <tr key={c.label}>
                    <Td left strong>
                      {c.label}
                      {!own && c.campaign_segment && <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-gray-600">from a {c.campaign_segment} campaign</span>}
                    </Td>
                    <Td>{own ? money(c.spend) : '—'}</Td><Td>{fmtNumber(c.leads)}</Td><Td>{fmtNumber(m.mql)}</Td><Td>{fmtNumber(m.sql)}</Td><Td>{fmtNumber(m.won)}</Td><Td>{callWon(c, view) > 0 ? fmtNumber(callWon(c, view)) : '—'}</Td>
                    <Td>{own ? per(c.spend, m.mql) : '—'}</Td><Td>{own ? per(c.spend, m.won) : '—'}</Td>
                    <Td>{pl && pl > 0 ? fmtNumber(pl) : (c.contact_actions ?? 0) > 0 ? `${fmtNumber(c.contact_actions ?? 0)} page events` : '—'}</Td>
                    <Td warn={warn}>{ratio != null ? `${Math.round(ratio * 100)}%` : '—'}</Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Platform against Marketo" subtitle="Does what the ad platforms report line up with the people who actually reached Marketo?">
        <ReconBlock data={data} />
      </Card>

      {channels.length > 0 && (
        <Card title={isAbm ? 'Where larger fleets come from' : 'Which sources these people came through'} subtitle="Every source, paid or not, so channels worth amplifying are visible.">
          <div className="overflow-x-auto rounded-xl border border-gray-100">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50"><tr><Th left>Source</Th><Th>Leads</Th><Th>MQL</Th><Th>SQL</Th><Th>Won</Th></tr></thead>
              <tbody className="divide-y divide-gray-100">
                {channels.map((c: SegmentChannelRow) => {
                  const m = pick(c, view);
                  return <tr key={c.channel}><Td left strong>{CHANNEL_LABEL[c.channel] ?? c.channel}</Td><Td>{fmtNumber(c.leads)}</Td><Td>{fmtNumber(m.mql)}</Td><Td>{fmtNumber(m.sql)}</Td><Td>{fmtNumber(m.won)}</Td></tr>;
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <details className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6">
        <summary className="cursor-pointer text-lg font-semibold text-gray-950">How this is counted</summary>
        <div className="mt-3 space-y-2 text-sm leading-6 text-gray-600">
          <p>Each person is counted once, in one segment. A fleet of 100 or more vehicles is ABM, whichever campaign brought them in. Everyone else takes the segment of their campaign: SMB, ABM or FD360. Campaigns are matched to their segment by campaign ID first, then by name or UTM text, using a map that was filled in automatically from the campaign names and can be corrected.</p>
          <p>Wins come from Marketo closed-won dates. A person with no campaign tag whose phone number matches a tracked Google ad call is credited to the campaign of their first call, as long as they had not won yet or won within 60 days after that call. People with a campaign tag always keep it, so nobody is credited twice. The &quot;of which calls&quot; column shows how many wins were credited this way.</p>
          <p>Meta &quot;leads&quot; on website campaigns are page events, not form fills, which is why they are shown separately from lead-form leads.</p>
          <p>This tab is comparison only and does not change any existing PrePass report.</p>
        </div>
      </details>
    </div>
  );
}

const SEG_ORDER: SegmentName[] = ['SMB', 'ABM', 'FD360'];

export function SegmentOverview({ reports, base }: { reports: Partial<Record<SegmentName, SegmentReportData | null>>; base: string }) {
  const any = SEG_ORDER.map((s) => reports[s]).find(Boolean);
  if (!any) return null;
  return (
    <div className="space-y-6">
      <Card title="Three segments, one count" subtitle="Every person sits in exactly one segment, so the rows add up. Closed won is shown both ways: stages in the period, and people who signed up in the period.">
        <div className="overflow-x-auto rounded-xl border border-gray-100">
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50">
              <tr><Th left>Segment</Th><Th>Spend</Th><Th>Leads</Th><Th>MQL</Th><Th>SQL</Th><Th>Won (stages in period)</Th><Th>Won (signed up in period)</Th><Th>Cost per won</Th></tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {SEG_ORDER.map((s) => {
                const r = reports[s];
                if (!r) return <tr key={s}><Td left strong>{s}</Td><Td>—</Td><Td>—</Td><Td>—</Td><Td>—</Td><Td>—</Td><Td>—</Td><Td>—</Td></tr>;
                return (
                  <tr key={s}>
                    <Td left strong><Link className="underline decoration-gray-300 underline-offset-2 hover:text-brand-forest" href={`${base}/${s.toLowerCase()}`}>{s}</Link></Td>
                    <Td>{money(r.segment_spend)}</Td><Td>{fmtNumber(r.totals.leads)}</Td><Td>{fmtNumber(r.totals.e_mql)}</Td><Td>{fmtNumber(r.totals.e_sql)}</Td>
                    <Td>{fmtNumber(r.totals.e_won)}</Td><Td>{fmtNumber(r.totals.c_won)}</Td><Td>{per(r.segment_spend, r.totals.e_won)}</Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-gray-500">Marketo data through {dataThrough(any.data_through)}. Wins include those matched through Google ad phone calls (caller numbers are recorded from Aug 2026).</p>
      </Card>
    </div>
  );
}

export function SegmentReconciliation({ reports }: { reports: Partial<Record<SegmentName, SegmentReportData | null>> }) {
  return (
    <div className="space-y-6">
      {SEG_ORDER.map((s) => {
        const r = reports[s];
        return (
          <Card key={s} title={`${s}: platform against Marketo`}>
            {r ? <ReconBlock data={r} /> : <p className="text-sm text-gray-500">Not available right now.</p>}
          </Card>
        );
      })}
    </div>
  );
}
