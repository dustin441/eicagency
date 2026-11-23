import type { DurolineLead } from '@/lib/duroline-pipeline-types';
import { classifyCompanyName, summarizeBuyerFit, type CompanyEvidence } from '@/lib/duroline-buyer-fit';

const count = (value: number) => new Intl.NumberFormat('en-US').format(value);
const percent = (value: number | null) => value === null ? 'Not available' : `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(value)}%`;

/** Receives the complete date cohort, before owner or lead-table search is applied. */
export default function DurolineBuyerFitSnapshot({ leads }: { leads: Array<DurolineLead & CompanyEvidence> }) {
  const fit = summarizeBuyerFit(leads);
  const signalRows = leads.flatMap(lead => {
    const evidence = classifyCompanyName(lead);
    return evidence.label === 'HVAC-related name signal' ? [{ lead, evidence }] : [];
  });
  const groups = [
    { label: 'HVAC-related name signal', value: fit.signal, detail: 'Explicit industry term in the company name', color: 'bg-emerald-500' },
    { label: 'No recognizable name signal', value: fit.noSignal, detail: 'A name was read, but no supported term matched', color: 'bg-slate-400' },
    { label: 'Company missing', value: fit.companyMissing, detail: 'Company evidence read; blank or placeholder', color: 'bg-amber-400' },
    { label: 'Evidence unavailable', value: fit.unavailable, detail: 'Company evidence was not successfully read', color: 'bg-slate-200' },
  ];
  return <section aria-labelledby="buyer-fit-title" data-buyer-fit="cohort" className="overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-sm">
    <div className="border-b border-emerald-100 bg-gradient-to-r from-emerald-50 via-white to-white p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-forest">Buyer-fit snapshot</p>
          <h2 id="buyer-fit-title" className="mt-2 text-2xl font-bold tracking-tight">Who are these leads?</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Company-name clues and current quality stages are separate lenses, not a verified industry classification or sales qualification.</p>
        </div>
        <span className="rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-xs font-semibold text-brand-forest">Same {count(fit.total)} HighLevel opportunities as Leads</span>
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div data-buyer-fit-metric="HVAC-related name signal" className="rounded-xl border border-emerald-200 bg-white p-5">
          <p className="text-xs font-semibold text-brand-forest">HVAC-related name signal</p>
          <p className="mt-3 text-4xl font-bold tracking-tight text-brand-forest">{percent(fit.signalPercentage)}</p>
          <p className="mt-2 text-sm text-slate-600">{fit.evidenceRead ? `${count(fit.signal)} of ${count(fit.total)} cohort leads have a recognizable signal.` : 'Company evidence is unavailable for this cohort.'}</p>
          <p className="mt-2 text-xs leading-5 text-slate-500">{fit.evidenceRead > 0 && fit.unavailable > 0 ? 'Observed share with partial evidence coverage, not an estimate for unread records.' : 'Denominator: all cohort leads, including missing company names.'}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-semibold text-slate-600">Current stage Quality</p>
          <p className="mt-3 text-3xl font-bold tracking-tight">{count(fit.stageQuality)} <span className="text-base font-medium text-slate-500">/ {count(fit.total)}</span></p>
          <p className="mt-2 text-sm font-semibold text-brand-forest">{percent(fit.qualityPercentage)}{fit.qualityPercentage !== null && ' of cohort'}</p>
          <p className="mt-2 text-xs leading-5 text-slate-500">Includes Interested - Small, Interested, Finding Distributor and Sent To Sales. Current-stage share, not historical conversion.</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-semibold text-slate-600">Interested - Small · within Quality</p>
          <p className="mt-3 text-3xl font-bold tracking-tight">{count(fit.small)} <span className="text-base font-medium text-slate-500">/ {count(fit.total)}</span></p>
          <p className="mt-2 text-sm font-semibold text-brand-forest">{percent(fit.smallPercentage)}{fit.smallPercentage !== null && ' of cohort'}</p>
          <p className="mt-2 text-xs leading-5 text-slate-500">Small remains qualified under the current definition. Quality does not mean Large; no verified large-buyer threshold is available.</p>
        </div>
      </div>
    </div>
    <div className="p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2"><h3 className="text-sm font-bold">Company evidence coverage</h3>
        <p className="text-xs text-slate-500">Read coverage: <strong className="text-slate-700">{count(fit.evidenceRead)} of {count(fit.total)} · {percent(fit.readPercentage)}</strong> · {count(fit.companyPresent)} usable names</p>
      </div>
      <div aria-hidden="true" className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-slate-100">{groups.map(group => <div key={group.label} className={group.color} style={{ width: `${fit.total ? group.value / fit.total * 100 : 0}%` }} />)}</div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{groups.map(group => <div key={group.label}>
        <p className="flex items-center gap-2 text-xs font-semibold text-slate-700"><span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${group.color}`} />{group.label}</p>
        <p className="mt-2 text-lg font-bold">{count(group.value)} <span className="text-xs font-normal text-slate-500">/ {count(fit.total)} cohort leads</span></p>
        <p className="mt-1 text-xs leading-5 text-slate-500">{group.detail}</p>
      </div>)}</div>
      <p className="mt-5 text-xs leading-5 text-slate-600">Signal overlap: <strong>{count(fit.signalAndQuality)}</strong> with current Quality; <strong>{count(fit.signalNotQuality)}</strong> outside current Quality. These counts describe observed name signals only. A non-match is not proven unrelated or a bad lead. No inference is made from addresses, Duroline tags, or ambiguous terms such as Mechanical, Electrical, Construction, Air, Pros or AC alone.</p>
      <div className="mt-5 rounded-xl border border-orange-100 bg-orange-50/60 p-4"><p className="text-sm font-semibold text-slate-900">Are relevant smaller buyers missing a purchase path?</p><p className="mt-1 text-xs leading-5 text-slate-600">A question to investigate, not a proven finding. Company names and current stages cannot establish buyer size, demand, purchase intent or the reason a lead has not progressed.</p></div>
      <details className="mt-5 border-t border-slate-100 pt-4"><summary className="cursor-pointer text-sm font-semibold text-brand-forest">Inspect name-signal evidence · {count(signalRows.length)} leads</summary>
        <p className="mt-3 text-xs leading-5 text-slate-500">Full date cohort, unaffected by owner or search. Only explicit HVAC, heating, cooling, refrigeration or air-conditioning terms count. Search company names, signal labels and terms in Lead detail below; no CRM matching logic is changed.</p>
        <div className="mt-3 max-h-96 overflow-auto rounded-xl border border-slate-200"><table className="w-full min-w-[560px] text-left text-xs"><thead className="sticky top-0 bg-slate-50 text-slate-500"><tr>{['Lead', 'Company name', 'Matching terms', 'Current HL stage'].map(label => <th key={label} className="px-4 py-3 font-semibold">{label}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-100">{signalRows.map(({ lead, evidence }) => <tr key={lead.id}><td className="px-4 py-3 text-slate-600">{lead.name || 'Unnamed lead'}</td><td className="px-4 py-3 font-semibold text-slate-800">{evidence.company}</td><td className="px-4 py-3 text-brand-forest">{evidence.terms.join(', ')}</td><td className="px-4 py-3 text-slate-600">{lead.stage || 'Not provided'}</td></tr>)}</tbody>
        </table>{!signalRows.length && <p className="p-4 text-xs text-slate-500">{fit.evidenceRead ? 'No recognizable company-name signals in the available evidence.' : 'Evidence unavailable. No company-name classification can be made.'}</p>}</div>
      </details>
    </div>
  </section>;
}
