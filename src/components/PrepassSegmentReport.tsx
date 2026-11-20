import Link from 'next/link';
import { cn, fmtNumber } from '@/lib/utils';
import { classifyAbmCampaignType } from '@/services/prepass-platform-normalization';
import PrepassCampaignTable, { type CampaignTableRow } from '@/components/PrepassCampaignTable';
import PrepassSegmentTrend from '@/components/PrepassSegmentTrend';
import type { SegmentCampaignRow, SegmentChannelRow, SegmentExtras, SegmentName, SegmentReportData } from '@/services/prepass-segment-report';

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
const metaWon = (r: { meta_e_won?: number; meta_c_won?: number }, view: SegmentView) => (view === 'cohort' ? r.meta_c_won : r.meta_e_won) ?? 0;
const matchedWon = (r: { call_e_won?: number; call_c_won?: number; meta_e_won?: number; meta_c_won?: number }, view: SegmentView) => callWon(r, view) + metaWon(r, view);

const pick = (r: { c_mql: number; c_sql: number; c_won: number; e_mql: number; e_sql: number; e_won: number }, view: SegmentView) =>
  view === 'cohort' ? { mql: r.c_mql, sql: r.c_sql, won: r.c_won } : { mql: r.e_mql, sql: r.e_sql, won: r.e_won };

function Delta({ cur, prev, lowerBetter = false }: { cur: number | null; prev: number | null; lowerBetter?: boolean }) {
  if (cur == null || prev == null || prev === 0) return null;
  const pct = (cur - prev) / prev;
  if (!isFinite(pct) || Math.abs(pct) < 0.005) return <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-bold text-gray-500">0%</span>;
  const good = lowerBetter ? pct < 0 : pct > 0;
  return (
    <span className={cn('ml-2 rounded-full px-2 py-0.5 text-xs font-bold', good ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600')}>
      {pct > 0 ? '+' : '-'}{Math.abs(Math.round(pct * 100))}%
    </span>
  );
}

const ratio = (spend: number | null | undefined, n: number) => (spend != null && spend > 0 && n > 0 ? spend / n : null);
const rate = (n: number, d: number) => (d > 0 ? `${((100 * n) / d).toFixed(1)}%` : '—');
const BAND_ORDER = ['1-5', '6-50', '51-100', '101-500', '500+', 'Not given'];

function dataThrough(d: string | null) {
  return d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'unknown';
}

/** Marketo people vs what Meta reports as leads, for campaigns in this segment. Flags campaigns where Marketo has well under what the platform claims. */
export function ReconBlock({ data }: { data: SegmentReportData }) {
  const own = data.campaigns.filter((c) => c.campaign_segment === data.segment);
  const meta = own.filter((c) => (c.lead_actions ?? 0) > 0);
  const contactActions = own.reduce((a, c) => a + (c.contact_actions ?? 0), 0);
  const flagged = meta.filter((c) => (c.lead_actions ?? 0) >= 20 && c.leads / (c.lead_actions ?? 1) < 0.6);
  const forms = data.meta_forms?.forms ?? 0;
  const found = data.meta_forms?.found ?? 0;
  const tagged = meta.reduce((a, c) => a + c.leads, 0);
  const platformLeads = meta.reduce((a, c) => a + (c.lead_actions ?? 0), 0);
  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
          <div className="text-2xl font-semibold text-gray-950">{forms > 0 ? `${Math.round((100 * found) / forms)}%` : '—'}</div>
          <div className="mt-1 text-xs leading-5 text-gray-500">of {fmtNumber(forms)} Meta lead-form leads are found in Marketo by email. {fmtNumber(forms - found)} never reached Marketo</div>
        </div>
        <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
          <div className="text-2xl font-semibold text-gray-950">{platformLeads > 0 ? `${Math.round((100 * tagged) / platformLeads)}%` : '—'}</div>
          <div className="mt-1 text-xs leading-5 text-gray-500">carry the campaign tag in Marketo ({fmtNumber(tagged)} of {fmtNumber(platformLeads)}). The rest are existing contacts or lost the tag, and are matched through the lead form instead</div>
        </div>
        <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
          <div className="text-2xl font-semibold text-gray-950">{fmtNumber(contactActions)}</div>
          <div className="mt-1 text-xs leading-5 text-gray-500">website conversions Meta calls leads or contacts. They are page events, not form fills, so they will not match Marketo people</div>
        </div>
        <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
          <div className="text-2xl font-semibold text-gray-950">{flagged.length}</div>
          <div className="mt-1 text-xs leading-5 text-gray-500">campaigns where under 60% of platform leads carry the tag (shaded in the table)</div>
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

export function SegmentTab({ data, comp, extras, view, basePath, search }: { data: SegmentReportData; comp?: SegmentReportData | null; extras?: SegmentExtras | null; view: SegmentView; basePath: string; search: Record<string, string | undefined> }) {
  const t = pick(data.totals, view);
  const tp = comp ? pick(comp.totals, view) : null;
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
  const wonViaMeta = metaWon(data.totals, view);
  const cards: { label: string; value: string; note?: string; cur: number; prev: number | null }[] = [
    { label: 'Leads', value: fmtNumber(data.totals.leads), cur: data.totals.leads, prev: comp ? comp.totals.leads : null },
    { label: 'MQL', value: fmtNumber(t.mql), cur: t.mql, prev: tp ? tp.mql : null },
    { label: 'SQL', value: fmtNumber(t.sql), cur: t.sql, prev: tp ? tp.sql : null },
    { label: 'Closed won', value: fmtNumber(t.won), note: wonViaCalls + wonViaMeta > 0 ? `${fmtNumber(wonViaCalls)} matched through phone calls, ${fmtNumber(wonViaMeta)} through Meta lead forms` : undefined, cur: t.won, prev: tp ? tp.won : null },
  ];
  const costCards = [
    { label: 'Cost per lead', cur: ratio(spend, data.totals.leads), prev: comp ? ratio(comp.segment_spend, comp.totals.leads) : null, north: false },
    { label: 'Cost per MQL', cur: ratio(spend, t.mql), prev: comp && tp ? ratio(comp.segment_spend, tp.mql) : null, north: false },
    { label: 'Cost per SQL', cur: ratio(spend, t.sql), prev: comp && tp ? ratio(comp.segment_spend, tp.sql) : null, north: false },
    { label: 'Cost per closed won', cur: ratio(spend, t.won), prev: comp && tp ? ratio(comp.segment_spend, tp.won) : null, north: true },
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
        {cards.map((k) => (
          <article key={k.label} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{k.label}</p>
            <p className="mt-2 flex items-center text-3xl font-bold text-gray-950">{k.value}<Delta cur={k.cur} prev={k.prev} /></p>
            {k.note && <p className="mt-1 text-xs text-gray-500">{k.note}</p>}
          </article>
        ))}
        <article className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Ad spend</p>
          <p className="mt-2 flex items-center text-3xl font-bold text-gray-950">{money(spend)}<Delta cur={spend} prev={comp ? comp.segment_spend : null} lowerBetter /></p>
          <p className="mt-1 text-xs text-gray-500">Badges compare with the comparison period</p>
        </article>
      </section>

      <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-lg font-semibold text-gray-950">Cost efficiency</h2>
        <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {costCards.map((m) => (
            <div key={m.label} className={cn('rounded-2xl p-5', m.north ? 'border-2 border-brand-forest/25 bg-brand-forest/5' : 'bg-gray-50')}>
              <p className={cn('text-xs font-bold uppercase tracking-widest', m.north ? 'text-brand-forest' : 'text-gray-400')}>{m.label}{m.north && <span className="ml-2 rounded-full bg-brand-forest/10 px-1.5 py-0.5 text-[9px]">North Star</span>}</p>
              <p className="mt-2 flex items-center text-2xl font-bold text-gray-950">{m.cur != null ? money(m.cur) : '—'}<Delta cur={m.cur} prev={m.prev} lowerBetter /></p>
            </div>
          ))}
        </div>
      </section>

      {extras && extras.daily.length > 0 && <PrepassSegmentTrend daily={extras.daily} />}

      <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-lg font-semibold text-gray-950">Funnel and timing</h2>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-gray-500">
          {view === 'cohort' ? 'Of the people who signed up in the period, how many reached each stage so far.' : 'Stage counts in the period. These are ratios of events, not an acquisition cohort.'} Days are the middle value for people whose stage happened in the period.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {[
            { label: 'Lead to MQL', r: rate(t.mql, data.totals.leads), days: extras?.timing.lead_to_mql },
            { label: 'MQL to SQL', r: rate(t.sql, t.mql), days: extras?.timing.mql_to_sql },
            { label: 'SQL to closed won', r: rate(t.won, t.sql), days: extras?.timing.sql_to_won },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-gray-100 bg-gray-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{s.label}</p>
              <p className="mt-1 text-2xl font-semibold text-gray-950">{s.r}</p>
              <p className="mt-1 text-xs text-gray-500">{s.days != null ? `${s.days} days typical` : 'timing not available'}</p>
            </div>
          ))}
        </div>
        {extras?.timing.lead_to_won != null && <p className="mt-3 text-xs text-gray-500">Sign-up to closed won: {extras.timing.lead_to_won} days typical.</p>}
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

      <Card title="Where the results come from, by campaign" subtitle="Spend and platform leads are only shown against a campaign's own segment, so nothing is counted twice. Shaded cells are campaigns where under 60% of the leads Meta reports carry that campaign's tag in Marketo. Untagged people are still matched to their campaign through the Meta lead form or a phone call, shown under &quot;Of which matched&quot;.">
        <PrepassCampaignTable rows={rows.map((c: SegmentCampaignRow): CampaignTableRow => {
          const m = pick(c, view);
          const own = c.campaign_segment === data.segment;
          const pl = own ? c.lead_actions : null;
          const ratio = pl && pl > 0 ? c.leads / pl : null;
          const sp = own ? c.spend : null;
          const d = (n: number) => (sp != null && sp > 0 && n > 0 ? sp / n : null);
          return {
            label: c.label, fromSegment: c.campaign_segment, own, spend: sp, leads: c.leads, mql: m.mql, sql: m.sql, won: m.won,
            matched: matchedWon(c, view), costPerLead: d(c.leads), costPerMql: d(m.mql), costPerSql: d(m.sql), costPerWon: d(m.won),
            platformLeads: pl, pageEvents: c.contact_actions ?? 0, taggedPct: ratio, warn: ratio != null && pl != null && pl >= 20 && ratio < 0.6,
          };
        })} />
      </Card>

      {isAbm && (() => {
        const groups = new Map<string, { spend: number; leads: number; mql: number; sql: number; won: number }>();
        rows.forEach((c: SegmentCampaignRow) => {
          if (c.campaign_segment !== data.segment) return;
          const m = pick(c, view);
          const k = classifyAbmCampaignType(c.label);
          const g = groups.get(k) ?? { spend: 0, leads: 0, mql: 0, sql: 0, won: 0 };
          g.spend += c.spend ?? 0; g.leads += c.leads; g.mql += m.mql; g.sql += m.sql; g.won += m.won;
          groups.set(k, g);
        });
        const list = [...groups.entries()].sort((a, b) => b[1].spend - a[1].spend);
        if (list.length === 0) return null;
        return (
          <Card title="By campaign type" subtitle="ABM campaigns grouped by how they target: Performance Max, Say Primer audiences, StackAdapt retargeting, or traditional targeting. Only ABM campaigns are counted here.">
            <div className="overflow-x-auto rounded-xl border border-gray-100">
              <table className="min-w-full divide-y divide-gray-100">
                <thead className="bg-gray-50"><tr><Th left>Type</Th><Th>Spend</Th><Th>Leads</Th><Th>MQL</Th><Th>SQL</Th><Th>Won</Th><Th>Cost per MQL</Th><Th>Cost per won</Th></tr></thead>
                <tbody className="divide-y divide-gray-100">
                  {list.map(([k, g]) => (
                    <tr key={k}><Td left strong>{k}</Td><Td>{money(g.spend)}</Td><Td>{fmtNumber(g.leads)}</Td><Td>{fmtNumber(g.mql)}</Td><Td>{fmtNumber(g.sql)}</Td><Td>{fmtNumber(g.won)}</Td><Td>{per(g.spend, g.mql)}</Td><Td>{per(g.spend, g.won)}</Td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        );
      })()}

      <Card title="Platform against Marketo" subtitle="Does what the ad platforms report line up with the people who actually reached Marketo?">
        <ReconBlock data={data} />
      </Card>

      {extras && extras.fleet.length > 0 && (
        <Card title="Fleet size" subtitle="People who signed up in the period, by the fleet size they entered. Self-declared on the form, and verified only when the deal closes.">
          <div className="overflow-x-auto rounded-xl border border-gray-100">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50"><tr><Th left>Fleet size</Th><Th>Leads</Th><Th>MQL</Th><Th>SQL</Th><Th>Won</Th><Th>Lead to won</Th></tr></thead>
              <tbody className="divide-y divide-gray-100">
                {[...extras.fleet].sort((a, b) => BAND_ORDER.indexOf(a.band) - BAND_ORDER.indexOf(b.band)).map((f) => (
                  <tr key={f.band}><Td left strong>{f.band}</Td><Td>{fmtNumber(f.leads)}</Td><Td>{fmtNumber(f.mql)}</Td><Td>{fmtNumber(f.sql)}</Td><Td>{fmtNumber(f.won)}</Td><Td>{rate(f.won, f.leads)}</Td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {extras && extras.platforms.length > 0 && (
        <Card title="Ad platforms" subtitle="Spend, clicks and impressions for this segment's campaigns, from the ad platforms.">
          <div className="overflow-x-auto rounded-xl border border-gray-100">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50"><tr><Th left>Platform</Th><Th>Spend</Th><Th>Share of spend</Th><Th>Clicks</Th><Th>Cost per click</Th><Th>Impressions</Th><Th>Click rate</Th></tr></thead>
              <tbody className="divide-y divide-gray-100">
                {extras.platforms.map((pf) => {
                  const total = extras.platforms.reduce((a, x) => a + x.spend, 0);
                  return (
                    <tr key={pf.platform}>
                      <Td left strong>{pf.platform}</Td><Td>{money(pf.spend)}</Td><Td>{total > 0 ? `${Math.round((100 * pf.spend) / total)}%` : '—'}</Td>
                      <Td>{fmtNumber(pf.clicks)}</Td><Td>{per(pf.spend, pf.clicks)}</Td><Td>{fmtNumber(pf.impressions)}</Td><Td>{rate(pf.clicks, pf.impressions)}</Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

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
          <p>Wins come from Marketo closed-won dates. A person with a campaign tag keeps it. A person with no tag is credited to the Meta lead form they submitted (matched to their Marketo record by email), and failing that to the Google ad campaign of their first matching phone call (if they had not won yet or won within 60 days after that call). Nobody is credited twice. The &quot;of which matched&quot; column shows how many wins were credited this way.</p>
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
