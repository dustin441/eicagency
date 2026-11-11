'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, Clock3, ExternalLink, Search, ShieldAlert } from 'lucide-react';
import type { DurolineDeal, DurolineLead, DurolinePipelineSnapshot } from '@/lib/duroline-pipeline-types';
import DurolineMmcSourceSummary from '@/components/DurolineMmcSourceSummary';

const QUALITY_STAGES = ['Interested - Small', 'Interested', 'Finding Distributor', 'Sent To Sales'];
const number = (value: number) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value);
const timestamp = (value: string) => new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC',
}).format(new Date(value)) + ' UTC';
const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value)
  && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
const salesLabel = (deal: DurolineDeal) => deal.salesState === 'legacy_qualified'
  ? 'Legacy Qualified · integration stage, not activity'
  : deal.salesState === 'awaiting_contact' ? 'Awaiting contact · Lead Generated' : deal.stage;

export function selectDurolineCohort(snapshot: DurolinePipelineSnapshot, start: string, end: string) {
  const invalid = Boolean((start && !validDate(start)) || (end && !validDate(end)) || (start && end && start > end));
  const filtered = Boolean((start || end) && !invalid);
  const leads = filtered ? snapshot.leads.filter(lead => {
    if (!lead.createdAt) return false;
    const date = new Date(lead.createdAt).toISOString().slice(0, 10);
    return (!start || date >= start) && (!end || date <= end);
  }) : snapshot.leads;
  const dealMap = new Map(snapshot.deals.map(deal => [deal.id, deal]));
  const matches = (lead: DurolineLead) => lead.matchStatus === 'matched'
    ? [...new Set(lead.mmcDealIds)].flatMap(id => {
      const deal = dealMap.get(id);
      return deal?.matchStatus === 'matched' ? [deal] : [];
    }) : [];
  const ids = new Set(leads.flatMap(lead => matches(lead).map(deal => deal.id)));
  return { leads, matches, deals: snapshot.deals.filter(deal => ids.has(deal.id)), filtered, invalid };
}

function Metric({ label, value, detail, highlight = false, headline }: {
  label: string; value: number; detail: string; highlight?: boolean; headline?: string;
}) {
  return <div data-headline-metric={headline} className={`rounded-2xl border p-5 ${highlight ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-white'}`}>
    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
    <p className={`mt-3 text-3xl font-bold tracking-tight ${highlight ? 'text-brand-forest' : 'text-slate-900'}`}>{number(value)}</p>
    <p className="mt-2 text-xs leading-relaxed text-slate-500">{detail}</p>
  </div>;
}

function DealTable({ deals }: { deals: DurolineDeal[] }) {
  return <div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left text-sm">
    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr>
      {['MMC deal', 'Current sales stage', 'Owner', 'Days in MMC stage', 'Recorded amount'].map(title => <th key={title} className="px-5 py-3 font-semibold">{title}</th>)}
    </tr></thead><tbody className="divide-y divide-slate-100">{deals.map(deal => <tr key={deal.id}>
      <td className="px-5 py-4 font-medium text-slate-900">{deal.name || 'Unnamed deal'}<span className="mt-1 block text-xs font-normal text-slate-500">#{deal.id}</span></td>
      <td className="px-5 py-4 text-slate-600">{salesLabel(deal)}</td>
      <td className="px-5 py-4 text-slate-600">{deal.owner || 'Unassigned'}</td>
      <td className="px-5 py-4 text-slate-600">{deal.daysInStage === null ? 'Not provided' : number(deal.daysInStage)}</td>
      <td className="px-5 py-4 text-slate-600">{deal.amount === null ? 'Missing' : number(deal.amount)}</td>
    </tr>)}</tbody>
  </table>{!deals.length && <p className="p-6 text-sm text-slate-500">No deals in this category.</p>}</div>;
}

export default function DurolineSalesPipelineClient({ snapshot, capturedAt, start, end, evaluatedAt }: {
  snapshot: DurolinePipelineSnapshot; capturedAt: string; start: string; end: string; evaluatedAt: string;
}) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [owner, setOwner] = useState('');
  const [checkedAt, setCheckedAt] = useState(() => Date.parse(evaluatedAt));
  useEffect(() => {
    const timer = window.setInterval(() => setCheckedAt(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const cohort = useMemo(() => selectDurolineCohort(snapshot, start, end), [snapshot, start, end]);
  const owners = [...new Set(cohort.deals.map(deal => deal.owner || 'Unassigned'))].sort();
  const leads = cohort.leads.filter(lead => !owner || cohort.matches(lead).some(deal => (deal.owner || 'Unassigned') === owner));
  const leadDealIds = new Set(leads.flatMap(lead => cohort.matches(lead).map(deal => deal.id)));
  const deals = cohort.deals.filter(deal => leadDealIds.has(deal.id) && (!owner || (deal.owner || 'Unassigned') === owner));
  const matched = leads.filter(lead => cohort.matches(lead).length > 0);
  // Headlines retain the complete source / date-cohort grain; owner only filters supporting detail.
  const headlineDeals = cohort.filtered ? cohort.deals : snapshot.deals;
  const headlineQuality = cohort.leads.filter(lead => QUALITY_STAGES.includes(lead.stage));
  const headlineWon = headlineDeals.filter(deal => deal.salesState === 'won');
  const states = (state: DurolineDeal['salesState']) => deals.filter(deal => deal.salesState === state);
  const won = states('won');
  const recordedWon = won.filter(deal => deal.amount !== null);
  const wonAmount = recordedWon.reduce((sum, deal) => sum + (deal.amount ?? 0), 0);
  const visibleLeads = leads.filter(lead => `${lead.name} ${lead.stage} ${lead.status} ${cohort.matches(lead).map(deal => `${deal.owner ?? ''} ${deal.stage}`).join(' ')}`.toLowerCase().includes(search.trim().toLowerCase()));
  const missing = leads.filter(lead => lead.matchStatus === 'unmatched');
  const ambiguous = leads.filter(lead => lead.matchStatus === 'ambiguous');
  const broken = leads.filter(lead => lead.matchStatus === 'matched' && !cohort.matches(lead).length);
  const mmcOnly = snapshot.deals.filter(deal => deal.matchStatus === 'unmatched');
  const ambiguousDeals = snapshot.deals.filter(deal => deal.matchStatus === 'ambiguous');
  const stale = checkedAt - Math.min(Date.parse(capturedAt), Date.parse(snapshot.capturedAt)) > 2 * 60 * 60 * 1000;
  const filtered = cohort.filtered;
  const pageCount = Math.max(1, Math.ceil(visibleLeads.length / 50));
  const currentPage = Math.min(page, pageCount - 1);

  return <main className="mx-auto max-w-[1600px] space-y-7 px-4 py-7 text-slate-900 sm:px-8 sm:py-10">
    <header>
      <Link href="/dashboard/durodyne" className="text-sm font-medium text-slate-500 hover:text-brand-forest">← Duro Dyne performance</Link>
      <div className="mt-5 flex flex-wrap items-start justify-between gap-5">
        <div><p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-orange">Duro Line · Revenue operations</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Sales pipeline</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">A connected view of HighLevel leads and Map My Customers sales followup. See where leads stand today, without implying a historical conversion funnel.</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-500">
          <p className="flex items-center gap-2 font-semibold text-slate-700"><Clock3 size={14} /> Snapshot captured</p>
          <p className="mt-2">{timestamp(snapshot.capturedAt)}</p>
          {capturedAt !== snapshot.capturedAt && <p className="mt-1">Stored {timestamp(capturedAt)}</p>}
          <p className="mt-1">Full current-state snapshot</p>
        </div>
      </div>
    </header>

    <section aria-labelledby="headline-title" className="space-y-4">
      <div><h2 id="headline-title" className="text-lg font-bold">Leads → Quality → MMC → Closed Won</h2>
        <p className="mt-2 text-xs leading-5 text-slate-500">{filtered ? `Lead-created cohort: ${start || 'earliest'} through ${end || 'latest'} (UTC). MMC and Closed Won show only verified matches to this cohort, not the complete MMC source.` : 'All-time source totals · latest saved current state. HighLevel opportunity counts and MMC deal counts have different source grains; this is not a conversion rate or an attributed paid-media funnel.'} Headlines do not change with the matched-owner or table-search filters.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric headline="Leads" label="01 · Leads" value={cohort.leads.length} detail="HighLevel opportunities, all statuses. Includes any internal or test records; not a paid-attributed lead count." />
        <Metric headline="Quality" label="02 · Quality" value={headlineQuality.length} detail="HighLevel opportunities currently in the four quality stages, across all statuses. May include internal records; not ever-qualified or paid-attributed leads." />
        <Metric headline="MMC" label={filtered ? '03 · MMC · verified matches' : '03 · MMC · all source deals'} value={headlineDeals.length} detail={filtered ? 'Distinct MMC deals with verified ID matches to the selected lead-created cohort. Ambiguous and unmatched deals excluded.' : 'Every deal in the source MMC pipeline, including legacy, unmatched and ambiguous records. Not all attributable to HighLevel leads.'} />
        <Metric headline="Closed Won" label={filtered ? '04 · Closed Won · verified matches' : '04 · Closed Won · all source'} value={headlineWon.length} detail={filtered ? 'Verified cohort-matched MMC deals currently marked won; not close-date activity or verified revenue.' : 'All source MMC deals currently marked won, whether matched or not. A stage label, not verified revenue or a paid-media outcome.'} highlight />
      </div>
      <p className="text-xs leading-5 text-slate-600">HighLevel opportunities and MMC deals use different source grains, not a conversion rate. Current stages only, not historical stage movement. Duplicate or conflicting ID matches remain ambiguous and are excluded from verified matches. Read-only reporting: no CRM changes, feedback loop or stage resets.</p>
    </section>

    {stale && <div role="alert" className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><ShieldAlert className="shrink-0" size={20} /><div><strong>Stale data: more than 2 hours old.</strong> Stages, owners and outcomes may have changed since capture. These are saved snapshot values, not live CRM data.</div></div>}
    {!!snapshot.warnings.length && <details className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600"><summary className="cursor-pointer font-semibold text-slate-700">Snapshot notes · {snapshot.warnings.length}</summary><ul className="mt-3 list-disc space-y-2 pl-5 text-xs leading-5">{snapshot.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul></details>}

    <DurolineMmcSourceSummary snapshot={snapshot} />

    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <form action="/dashboard/durodyne/sales-pipeline" method="get" className="flex flex-wrap items-end gap-3">
          <label className="text-xs font-semibold text-slate-600">Lead created from<input name="start" type="date" defaultValue={validDate(start) ? start : ''} className="mt-2 block rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label>
          <label className="text-xs font-semibold text-slate-600">Lead created through<input name="end" type="date" defaultValue={validDate(end) ? end : ''} className="mt-2 block rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label>
          <button type="submit" className="rounded-lg bg-brand-forest px-4 py-2 text-sm font-semibold text-white hover:opacity-90">Apply cohort</button>
          <Link href="/dashboard/durodyne/sales-pipeline" className="px-2 py-2 text-sm font-medium text-slate-500">All time</Link>
        </form>
        <label className="text-xs font-semibold text-slate-600">Matched MMC owner<select value={owner} onChange={event => { setOwner(event.target.value); setPage(0); }} className="mt-2 block w-48 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"><option value="">All owners</option>{owners.map(item => <option key={item}>{item}</option>)}</select></label>
      </div>
      {cohort.invalid && <p role="alert" className="mt-4 text-sm font-semibold text-amber-800">Invalid cohort dates. Showing all time; use valid dates with the start on or before the end.</p>}
      <p className="mt-4 text-xs leading-5 text-slate-500"><strong className="text-slate-700">{filtered ? `Lead-created cohort: ${start || 'earliest'} through ${end || 'latest'} (UTC, inclusive).` : 'All-time leads · latest current state.'}</strong> Dates select HighLevel lead creation, not sales activity or close dates. {filtered && 'Leads without creation dates and MMC-only or ambiguous deals are excluded from cohort metrics.'} {owner && 'Owner selection narrows supporting details, lead detail and lead coverage to confirmed matches for that owner; unmatched leads are excluded. Headlines and the all-time source summary remain unchanged.'}</p>
    </section>

    <details className="rounded-2xl border border-slate-200 bg-white p-5">
      <summary className="cursor-pointer text-sm font-semibold">Supporting details · verified matches, sales stages, amounts & aging</summary>
      <p className="mt-4 text-xs leading-5 text-slate-500">Sales scorecards use confirmed ID matches only, narrowed by the matched-owner filter. Quality stage counts use scoped HighLevel leads. {matched.length} HighLevel leads have verified MMC matches. Days in MMC stage appear in the lead detail table.</p>
      <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-500">
        <span className="font-semibold text-slate-700">Current quality stages</span><ArrowRight size={14} />{QUALITY_STAGES.map(stage => <span key={stage} className="rounded-full bg-slate-100 px-3 py-1">{stage} <strong className="ml-1 text-slate-700">{leads.filter(lead => lead.stage === stage).length}</strong></span>)}
      </div>
      <section aria-labelledby="sales-title" className="mt-5">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2"><h2 id="sales-title" className="text-lg font-bold">Sales followup & outcomes</h2><p className="text-xs text-slate-500">Deal grain · {number(deals.length)} distinct confirmed MMC deals linked to scoped leads</p></div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Contacted" value={states('contacted').length} detail="MMC deals currently in Contacted." />
        <Metric label="Negotiating" value={states('negotiating').length} detail="MMC deals currently in Negotiating." />
        <Metric label="Closed won" value={won.length} detail="MMC deals currently recorded as won." highlight />
        <Metric label="Closed lost" value={states('lost').length} detail="MMC deals currently recorded as lost." />
      </div>
      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5"><p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-brand-forest"><CheckCircle2 size={15} /> Recorded won amount</p><p className="mt-3 text-3xl font-bold text-brand-forest">{recordedWon.length ? number(wonAmount) : 'Not recorded'}</p><p className="mt-2 text-xs leading-5 text-slate-600">{recordedWon.length} won deals with an amount; {won.length - recordedWon.length} missing amounts, excluded from the sum. Currency is not supplied by the snapshot; this is not verified revenue.</p></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Awaiting contact</p><p className="mt-3 text-3xl font-bold">{states('awaiting_contact').length}</p><p className="mt-2 text-xs leading-5 text-slate-500">MMC deals at Lead Generated. No contacted activity is implied.</p></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Legacy Qualified</p><p className="mt-3 text-3xl font-bold">{states('legacy_qualified').length}</p><p className="mt-2 text-xs leading-5 text-slate-500">Existing hidden Qualified stage, auto-created by the integration. This is not evidence of sales activity. Other current stages: {states('other').length} deals.</p></div>
      </div>
      <p className="mt-3 text-xs leading-5 text-slate-500">Duplicate or conflicting ID matches are flagged ambiguous, not credited as multiple verified deals. Lead counts and deal counts have different denominators and are not conversion rates. Current stages cannot reconstruct historical qualification, stage movement or close-date performance.</p>
      </section>
    </details>

    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white" aria-labelledby="leads-title">
      <div className="flex flex-wrap items-center justify-between gap-4 p-5"><div><h2 id="leads-title" className="text-lg font-bold">Lead detail</h2><p className="mt-1 text-xs text-slate-500">{visibleLeads.length} of {leads.length} scoped leads · search affects this table only</p></div>
        <label className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2"><Search size={16} className="text-slate-400" /><span className="sr-only">Search leads, stages or owners</span><input value={search} onChange={event => { setSearch(event.target.value); setPage(0); }} placeholder="Search leads, stages, owners" className="w-56 bg-transparent text-sm outline-none focus:ring-2 focus:ring-emerald-200" /></label>
      </div>
      <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr>{['HighLevel lead', 'HL stage / status', 'Match coverage', 'MMC stage / owner', 'Days in MMC stage'].map(title => <th key={title} className="px-5 py-3 font-semibold">{title}</th>)}</tr></thead>
        <tbody className="divide-y divide-slate-100">{visibleLeads.slice(currentPage * 50, (currentPage + 1) * 50).map(lead => {
          const matchedDeals = cohort.matches(lead).filter(deal => !owner || (deal.owner || 'Unassigned') === owner);
          return <tr key={lead.id} className="hover:bg-slate-50/70">
            <td className="px-5 py-4"><a href={`https://app.eic.agency/v2/location/KU4RlCj1mDVF6eNxwqcZ/opportunities/${encodeURIComponent(lead.id)}?tab=Opportunity+details`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 font-semibold text-brand-forest hover:underline">{lead.name || 'Unnamed lead'}<ExternalLink size={13} aria-label="Open HighLevel in a new tab" /></a><p className="mt-1 text-xs text-slate-500">Created {lead.createdAt ? new Date(lead.createdAt).toISOString().slice(0, 10) : 'not provided'}</p></td>
            <td className="px-5 py-4"><p className="font-medium">{lead.stage || 'Not provided'}</p><p className="mt-1 text-xs text-slate-500">{lead.status || 'Status not provided'}</p></td>
            <td className="px-5 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${matchedDeals.length ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'}`}>{matchedDeals.length ? `${matchedDeals.length} confirmed deal${matchedDeals.length === 1 ? '' : 's'}` : lead.matchStatus === 'ambiguous' ? 'Ambiguous match' : lead.matchStatus === 'matched' ? 'Match unavailable' : 'No MMC match'}</span></td>
            <td className="px-5 py-4 text-slate-600">{matchedDeals.length ? matchedDeals.map(deal => <div key={deal.id} className="py-1"><p>{salesLabel(deal)}</p><p className="mt-1 text-xs text-slate-500">#{deal.id} · {deal.owner || 'Unassigned'}</p></div>) : 'No confirmed sales handoff'}</td>
            <td className="px-5 py-4 text-slate-600">{matchedDeals.length ? matchedDeals.map(deal => <p key={deal.id} className="py-2 text-xs">#{deal.id}: {deal.daysInStage === null ? 'Not provided' : `${number(deal.daysInStage)} days`}</p>) : 'Not available'}</td>
          </tr>;
        })}</tbody></table></div>
      {!visibleLeads.length && <p className="px-5 py-10 text-center text-sm text-slate-500">No leads match this selection.</p>}
      {visibleLeads.length > 0 && <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-3 text-xs text-slate-600">
        <span>Showing {currentPage * 50 + 1} to {Math.min((currentPage + 1) * 50, visibleLeads.length)} of {visibleLeads.length} leads</span>
        <div className="flex items-center gap-3"><button type="button" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)} className="rounded-lg border border-slate-200 px-3 py-2 font-semibold disabled:opacity-40">Previous</button><span>Page {currentPage + 1} of {pageCount}</span><button type="button" disabled={currentPage + 1 >= pageCount} onClick={() => setPage(currentPage + 1)} className="rounded-lg border border-slate-200 px-3 py-2 font-semibold disabled:opacity-40">Next</button></div>
      </div>}
      <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">Days in stage comes from MMC only. HighLevel stage-entry history is not available in this snapshot.</p>
    </section>

    <section className="space-y-4" aria-labelledby="coverage-title">
      <div><h2 id="coverage-title" className="text-lg font-bold">Match coverage & exceptions</h2><p className="mt-1 text-sm text-slate-500">Uncertain matches remain separate. They are not credited to sales handoffs or matched outcome totals.</p></div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Metric label="Leads without MMC match" value={missing.length} detail="Scoped HighLevel leads with no confirmed sales connection." />
        <Metric label="Ambiguous lead matches" value={ambiguous.length} detail="Scoped leads requiring match review, not inferred attribution." />
        <Metric label="Unavailable matched records" value={broken.length} detail="Scoped leads marked matched but with no usable confirmed MMC deal." />
      </div>
      {filtered && <p className="rounded-xl bg-slate-100 p-4 text-xs leading-5 text-slate-600">{snapshot.leads.filter(lead => !lead.createdAt).length} all-time leads have no creation date and cannot be assigned to a date cohort. The exception tables below are global snapshot coverage only, outside the selected cohort.</p>}
      <details className="overflow-hidden rounded-2xl border border-slate-200 bg-white"><summary className="cursor-pointer p-5 text-sm font-semibold">MMC-only deals · {mmcOnly.length} <span className="ml-2 text-xs font-normal text-slate-500">Included in all-time source totals; outside verified matches and date-cohort totals</span></summary><DealTable deals={mmcOnly} /></details>
      <details className="overflow-hidden rounded-2xl border border-slate-200 bg-white"><summary className="cursor-pointer p-5 text-sm font-semibold">Ambiguous MMC deals · {ambiguousDeals.length} <span className="ml-2 text-xs font-normal text-slate-500">Global snapshot, attribution unresolved</span></summary><DealTable deals={ambiguousDeals} /></details>
    </section>
  </main>;
}
