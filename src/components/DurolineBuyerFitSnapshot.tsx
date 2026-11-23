import type { DurolineLead } from '@/lib/duroline-pipeline-types';
import { classifyIndustrySubmission, summarizeBuyerFit, INDUSTRY_FIELD_LABELS, type IndustryField } from '@/lib/duroline-buyer-fit';

const count = (value: number) => new Intl.NumberFormat('en-US').format(value);
const percent = (value: number | null) => value === null ? 'Not available' : `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(value)}%`;

/** Private authenticated dashboard. Complete date cohort, before owner/search filters. */
export default function DurolineBuyerFitSnapshot({ leads }: { leads: DurolineLead[] }) {
  const fit = summarizeBuyerFit(leads);
  const rows = leads.flatMap(lead => {
    const evidence = classifyIndustrySubmission(lead);
    return evidence.hits.length ? [{ lead, evidence }] : [];
  });
  const groups = [
    { label: 'HVAC-related submission signal', value: fit.signal, detail: 'At least one supported term in a submitted value' },
    { label: 'No recognizable submission signal', value: fit.noSignal, detail: 'Values read, but no supported term matched' },
    { label: 'Submission fields blank', value: fit.fieldsBlank, detail: 'Available values are blank or placeholders' },
    { label: 'Evidence unavailable', value: fit.unavailable, detail: 'Neither broader submitted fields nor legacy company evidence was read' },
  ];
  return <section aria-labelledby="buyer-fit-title" data-buyer-fit="cohort" className="overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-sm">
    <div className="border-b border-emerald-100 bg-gradient-to-r from-emerald-50 via-white to-white p-5 sm:p-6">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-forest">Buyer-fit snapshot</p>
      <h2 id="buyer-fit-title" className="mt-2 text-2xl font-bold tracking-tight">Who are these leads?</h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Submitted first/last names, email, both company fields and approved form answers provide clues, not verified industry classification or sales qualification.</p>
      <p className="mt-3 text-xs font-semibold text-brand-forest">Same {count(fit.total)} HighLevel opportunities as Leads</p>
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div data-buyer-fit-metric="HVAC-related submission signal" className="rounded-xl border border-emerald-200 bg-white p-5">
          <p className="text-xs font-semibold text-brand-forest">HVAC-related submission signal</p>
          <p className="mt-3 text-4xl font-bold text-brand-forest">{percent(fit.signalPercentage)}</p>
          <p className="mt-2 text-sm text-slate-600">{fit.evidenceRead ? `${count(fit.signal)} of ${count(fit.total)} cohort leads have a recognizable signal.` : 'Evidence unavailable for this cohort.'}</p>
          <p className="mt-2 text-xs leading-5 text-slate-500">Denominator: all cohort leads. Each lead counts once across fields. Partial or legacy coverage is an observed share, not an estimate for unread fields.</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-semibold text-slate-600">Current stage Quality</p>
          <p className="mt-3 text-3xl font-bold">{count(fit.stageQuality)} / {count(fit.total)}</p>
          <p className="mt-2 text-sm font-semibold text-brand-forest">{percent(fit.qualityPercentage)}{fit.qualityPercentage !== null && ' of cohort'}</p>
          <p className="mt-2 text-xs leading-5 text-slate-500">Includes Interested - Small, Interested, Finding Distributor and Sent To Sales. Current-stage share, not historical conversion.</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-semibold text-slate-600">Interested - Small · within Quality</p>
          <p className="mt-3 text-3xl font-bold">{count(fit.small)} / {count(fit.total)}</p>
          <p className="mt-2 text-sm font-semibold text-brand-forest">{percent(fit.smallPercentage)}{fit.smallPercentage !== null && ' of cohort'}</p>
          <p className="mt-2 text-xs leading-5 text-slate-500">Small remains qualified. Quality does not mean Large; no verified large-buyer threshold is available.</p>
        </div>
      </div>
    </div>
    <div className="p-5 sm:p-6">
      <h3 className="text-sm font-bold">Submission evidence coverage</h3>
      <p className="mt-2 text-xs leading-5 text-slate-600">Broader submitted fields read: <strong>{count(fit.fullEvidenceRead)} of {count(fit.total)} · {percent(fit.fullReadPercentage)}</strong>. Legacy company-only: <strong>{count(fit.legacyCompanyOnly)}</strong>, broader form-field evidence unavailable. Evidence unavailable: <strong>{count(fit.unavailable)}</strong>. Successful blank reads are distinct from unavailable evidence.</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{groups.map(group => <div key={group.label}>
        <p className="text-xs font-semibold text-slate-700">{group.label}</p>
        <p className="mt-2 text-lg font-bold">{count(group.value)} <span className="text-xs font-normal text-slate-500">/ {count(fit.total)} cohort leads</span></p>
        <p className="mt-1 text-xs leading-5 text-slate-500">{group.detail}</p>
      </div>)}</div>
      <h3 className="mt-5 text-sm font-bold">Leads with signal by submitted field</h3>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">{Object.entries(fit.sourceSignals).map(([source, value]) => <p key={source} className="rounded-lg bg-slate-50 p-3 text-xs">{source}: <strong>{count(value)}</strong></p>)}</div>
      <p className="mt-2 text-xs text-slate-500">Overlapping counts: a lead may appear in multiple field groups, but counts only once in the headline signal.</p>
      <p className="mt-5 text-xs leading-5 text-slate-600">Signal overlap: <strong>{count(fit.signalAndQuality)}</strong> with current Quality; <strong>{count(fit.signalNotQuality)}</strong> outside current Quality. No signal does not mean unqualified or proven unrelated. No inference is made from demographics, addresses, tags, employees or ambiguous terms such as Mechanical, Air or AC alone.</p>
      <div className="mt-5 rounded-xl border border-orange-100 bg-orange-50/60 p-4"><p className="text-sm font-semibold">Are relevant smaller buyers missing a purchase path?</p><p className="mt-1 text-xs leading-5 text-slate-600">A question to investigate, not a proven finding. Submission signals and current stages cannot establish buyer size, demand, purchase intent or why a lead has not progressed.</p></div>
      <details className="mt-5 border-t border-slate-100 pt-4"><summary className="cursor-pointer text-sm font-semibold text-brand-forest">Inspect submission-signal evidence · {count(rows.length)} leads</summary>
        <p className="mt-3 text-xs leading-5 text-slate-500">Full date cohort, unaffected by owner or search. Values only, never question labels. Supported terms: HVAC, heating, cooling, refrigeration and air-conditioning. Email compounds are included conservatively. Lead detail search includes submitted values and matching terms. CRM matching is unchanged.</p>
        <div className="mt-3 max-h-96 overflow-auto rounded-xl border border-slate-200"><table className="w-full min-w-[560px] text-left text-xs"><thead className="sticky top-0 bg-slate-50 text-slate-500"><tr>{['Lead', 'Field / exact submitted value', 'Matching terms', 'Current HL stage'].map(label => <th key={label} className="px-4 py-3 font-semibold">{label}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-100">{rows.flatMap(({ lead, evidence }) => evidence.hits.map((hit, index) => <tr key={`${lead.id}:${index}`}><td className="px-4 py-3">{lead.name || 'Unnamed lead'}{evidence.legacy && <span className="block text-slate-500">Legacy company-only</span>}</td><td className="px-4 py-3"><span className="block font-semibold">{INDUSTRY_FIELD_LABELS[hit.field as IndustryField]}</span><span className="whitespace-pre-wrap break-all">{hit.value}</span></td><td className="px-4 py-3 text-brand-forest">{hit.terms.join(', ')}</td><td className="px-4 py-3">{lead.stage || 'Not provided'}</td></tr>))}</tbody>
        </table>{!rows.length && <p className="p-4 text-xs text-slate-500">{fit.evidenceRead ? 'No recognizable submission signals in available evidence.' : 'Evidence unavailable. No classification can be made.'}</p>}</div>
      </details>
    </div>
  </section>;
}
