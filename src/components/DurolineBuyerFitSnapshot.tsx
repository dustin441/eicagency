import type { DurolineLead } from '@/lib/duroline-pipeline-types';
import { classifyIndustrySubmission, summarizeBuyerFit, cohortPercentage, DEMAND_CATEGORY_LABELS, INDUSTRY_FIELD_LABELS, type IndustryField, type DemandCategory } from '@/lib/duroline-buyer-fit';

const count = (value: number) => new Intl.NumberFormat('en-US').format(value);
const percent = (value: number | null) => value === null ? 'Not available' : `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(value)}%`;

/** Private authenticated dashboard. Complete date cohort, before owner/search filters. */
export default function DurolineBuyerFitSnapshot({ leads }: { leads: DurolineLead[] }) {
  const fit = summarizeBuyerFit(leads);
  const rows = leads.map(lead => ({ lead, evidence: classifyIndustrySubmission(lead) }));
  return <section id="demand-snapshot" aria-labelledby="buyer-fit-title" data-buyer-fit="cohort" className="scroll-mt-6 overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-sm">
    <div className="border-b border-emerald-100 bg-gradient-to-r from-emerald-50 via-white to-white p-5 sm:p-6">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-forest">Demand assessment · all leads</p>
      <h2 id="buyer-fit-title" className="mt-2 text-2xl font-bold tracking-tight">Who are these leads?</h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">An inclusive view of submitted business and trade clues, not verified product fit, qualification or purchases. Unknown is not bad fit. No automatic exclusions for names, placeholders, missing identity or buyer size.</p>
      <p className="mt-3 text-xs font-semibold text-brand-forest">Same {count(fit.total)} HighLevel opportunities as Leads · unaffected by owner, category or search filters</p>
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div data-buyer-fit-metric="Relevant or adjacent trade signals" className="rounded-xl border border-emerald-200 bg-white p-5">
          <p className="text-xs font-semibold text-brand-forest">Relevant or adjacent trade signals</p>
          <p className="mt-3 text-4xl font-bold text-brand-forest">{percent(fit.potentialTradePercentage)}</p>
          <p className="mt-2 text-sm text-slate-600">{fit.evidenceRead ? `${count(fit.potentialTrade)} of ${count(fit.total)} cohort leads: direct + adjacent.` : 'Evidence unavailable for this cohort.'}</p>
          <p className="mt-2 text-xs leading-5 text-slate-500">Potential trade audience, not qualified leads. Denominator: all cohort opportunities. Each lead counts once across fields. Partial or legacy coverage is an observed share, not an estimate for unread fields.</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-semibold text-slate-600">Current stage Quality</p>
          <p className="mt-3 text-3xl font-bold">{count(fit.stageQuality)} / {count(fit.total)}</p>
          <p className="mt-2 text-sm font-semibold text-brand-forest">{percent(fit.qualityPercentage)}{fit.qualityPercentage !== null && ' of cohort'}</p>
          <p className="mt-2 text-xs leading-5 text-slate-500">Interested - Small, Interested, Finding Distributor and Sent To Sales. Existing current-stage definition, not historical conversion or inferred trade qualification.</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-semibold text-slate-600">Interested - Small · within Quality</p>
          <p className="mt-3 text-3xl font-bold">{count(fit.small)} / {count(fit.total)}</p>
          <p className="mt-2 text-sm font-semibold text-brand-forest">{percent(fit.smallPercentage)}{fit.smallPercentage !== null && ' of cohort'}</p>
          <p className="mt-2 text-xs leading-5 text-slate-500">Included in Quality, not excluded for size. No verified annual-volume or first-order threshold can be inferred from this stage.</p>
        </div>
      </div>
    </div>
    <div className="p-5 sm:p-6">
      <h3 className="text-sm font-bold">All-lead category summary</h3>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{(Object.keys(DEMAND_CATEGORY_LABELS) as DemandCategory[]).map(category => <div key={category} data-demand-category={category} className="rounded-xl bg-slate-50 p-4">
        <p className="text-xs font-semibold text-slate-700">{DEMAND_CATEGORY_LABELS[category]}</p>
        <p className="mt-2 text-lg font-bold">{count(fit.categories[category])} <span className="text-xs font-normal text-slate-500">/ {count(fit.total)} · {percent(cohortPercentage(fit.categories[category], fit.total))}</span></p>
        <p className="mt-2 text-xs leading-5 text-slate-500">{[...new Set(rows.filter(row => row.evidence.category === category).map(row => row.evidence.company).filter(Boolean))].slice(0, 3).join(' · ')}</p>
      </div>)}</div>
      <p className="mt-3 text-xs leading-5 text-slate-600">Exclusive partition: direct takes precedence over adjacent, then possible, then unknown. HVAC/R, heating, cooling, AC, mechanical, duct, mini-split and VRF are direct clues. Electrical, plumbing, construction and other adjacent trades still need product-use verification. Air or service alone is possible only and excluded from the headline. Generic people names are not trades.</p>
      <h3 className="mt-5 text-sm font-bold">Submission evidence coverage</h3>
      <p className="mt-2 text-xs leading-5 text-slate-600">Broader submitted fields read: <strong>{count(fit.fullEvidenceRead)} of {count(fit.total)} · {percent(fit.fullReadPercentage)}</strong>. Legacy company-only: <strong>{count(fit.legacyCompanyOnly)}</strong>, broader form-field evidence unavailable. Evidence unavailable: <strong>{count(fit.unavailable)}</strong>. Successful blank reads are distinct from unavailable evidence. Company missing or placeholder: <strong>{count(fit.companyMissing)}</strong> among successful company reads. Incomplete identity is a followup need, not disqualification.</p>
      <details className="mt-5 border-t border-slate-100 pt-4"><summary className="cursor-pointer text-sm font-semibold text-brand-forest">Inspect exact submission evidence · all {count(rows.length)} leads</summary>
        <p className="mt-3 text-xs leading-5 text-slate-500">Full date cohort, unaffected by owner or search. Only allowlisted submitted values, never prompts, tags or rep names. Full paginated lead detail below also includes all submitted values, stages and verified MMC matches.</p>
        <div className="mt-3 max-h-96 overflow-auto rounded-xl border border-slate-200"><table className="w-full min-w-[650px] text-left text-xs"><thead className="sticky top-0 bg-slate-50 text-slate-500"><tr>{['Lead / category', 'Field / exact submitted value', 'Matching terms', 'Current HL stage'].map(label => <th key={label} className="px-4 py-3 font-semibold">{label}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-100">{rows.map(({ lead, evidence }) => <tr key={lead.id}>
            <td className="px-4 py-3">{lead.name || 'Unnamed lead'}<span className="block">{DEMAND_CATEGORY_LABELS[evidence.category]}</span>{evidence.legacy && <span className="block text-slate-500">Legacy company-only</span>}</td>
            <td className="px-4 py-3">{evidence.demandHits.length ? evidence.demandHits.map((hit, index) => <div key={index} className="mb-2"><span className="block font-semibold">{INDUSTRY_FIELD_LABELS[hit.field as IndustryField]}</span><span className="whitespace-pre-wrap break-all">{hit.value}</span></div>) : !evidence.reviewedBusinessEvidence && 'No matched trade evidence; inspect submitted values in lead detail.'}{evidence.reviewedBusinessEvidence && <div className="mt-2"><a href={evidence.reviewedBusinessEvidence.sourceUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-brand-forest underline">Reviewed official business website ↗</a><p className="mt-1 max-w-sm text-slate-600">{evidence.reviewedBusinessEvidence.description}</p><p className="mt-1 text-slate-500">Exact submitted email-domain match. Individual role and purchase need remain unverified.</p></div>}</td>
            <td className="px-4 py-3 text-brand-forest">{[...new Set(evidence.demandHits.flatMap(hit => hit.terms))].join(', ') || 'None observed'}</td>
            <td className="px-4 py-3">{lead.stage || 'Not provided'}</td>
          </tr>)}</tbody>
        </table>{!rows.length && <p className="p-4 text-xs text-slate-500">Evidence unavailable. No classification can be made.</p>}</div>
      </details>
      <details className="mt-5 text-xs text-slate-500"><summary className="cursor-pointer font-semibold">Legacy narrow measure · HVAC-related submission signal</summary><p className="mt-2">{count(fit.signal)} leads with the original narrow signal. Kept for comparison, not the inclusive demand headline. Overlapping counts by field: {Object.entries(fit.sourceSignals).map(([source, value]) => `${source}: ${count(value)}`).join(' · ')}. A lead can appear in multiple sources but counts once in the narrow measure.</p></details>
    </div>
  </section>;
}
