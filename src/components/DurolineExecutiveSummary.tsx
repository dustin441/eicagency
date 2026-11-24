import type { DurolineDeal, DurolineLead } from '@/lib/duroline-pipeline-types';
import { summarizeDurolineProgression } from '@/lib/duroline-executive';

export default function DurolineExecutiveSummary({ leads, deals }: { leads: DurolineLead[]; deals: DurolineDeal[] }) {
  const s = summarizeDurolineProgression(leads, deals);
  const unavailable = s.total > 0 && s.assessed === 0;
  const n = (value: number) => value.toLocaleString('en-US');
  return <section data-executive-summary aria-labelledby="executive-summary-title" className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5 sm:p-6">
    <p className="text-xs font-bold uppercase tracking-wide text-brand-forest">Leadership decision · demand to revenue</p>
    <h2 id="executive-summary-title" className="mt-2 text-2xl font-bold">Relevant demand needs a clear path to purchase.</h2>
    <p className="mt-3 max-w-5xl text-sm leading-6 text-slate-700">{s.total === 0 ? 'No opportunities fall in this selected cohort.' : unavailable ? 'Trade evidence is unavailable for this selected cohort.' : s.tradeTotal > 0 ? 'Marketing is bringing in an identifiable trade audience.' : 'No core or adjacent trade evidence is established in the assessed evidence.'} The next business decision is how to serve that audience profitably: protect sales capacity for larger annual demand while giving smaller and trial buyers a practical way to purchase. Do not confuse a small first order with a small account.</p>
    <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {[
        ['Trade-signal audience', s.tradeTotal, 'Core HVAC/R, mechanical and adjacent trades in the selected lead-created cohort.'],
        ['With recorded Quality stage', s.tradeQuality, 'Trade-signal leads currently in defined HighLevel Quality stages, not all trade leads.'],
        ['Outside current Quality stages', s.tradeOutsideQuality, 'Trade-signal leads for disposition review. This does not prove they were never contacted.'],
        ['Recorded small interest', s.tradeSmall, 'Trade-signal leads in Interested - Small. A priority review pool, not an annual-volume classification.'],
      ].map(([label, count, detail]) => <article key={String(label)} data-executive-metric={label} className="rounded-xl border border-emerald-100 bg-white p-4"><h3 className="text-xs font-semibold text-slate-600">{label}</h3><p className="mt-2 text-3xl font-bold text-brand-forest">{unavailable ? 'Not available' : n(Number(count))}</p><p className="mt-2 text-xs leading-5 text-slate-500">{detail}</p></article>)}
    </div>
    <p data-executive-coverage className="mt-3 text-xs leading-5 text-slate-600">{s.total === 0 ? 'Empty cohort: no opportunities in the selected range.' : `Trade evidence assessed for ${n(s.assessed)} of ${n(s.total)} opportunities; ${n(s.unavailable)} unread or unavailable. ${n(s.legacy)} have legacy company-only evidence. Counts are observed in assessed evidence, not estimates for unread leads.`}</p>
    <p className="mt-3 text-xs leading-5 text-slate-600">Current-state intersections, not sequential conversion steps. {unavailable ? 'Trade-specific MMC and won intersections cannot be assessed without trade evidence.' : <>Of the trade-signal audience, {n(s.tradeMatched)} have an unambiguous matched MMC deal and {n(s.tradeWon)} have a matched deal currently marked won.</>} Missing matches do not prove no followup or no sale. Online and distributor purchases are not reconciled here.</p>
    <div className="mt-5 grid gap-4 lg:grid-cols-2">
      <div><h3 className="text-sm font-bold">The commercial opportunity</h3><p className="mt-2 text-sm leading-6 text-slate-700">Recover first orders, build repeat purchasing and generate sales evidence that can support distributor adoption. The case is to monetize demand already being generated, not to ask territory representatives to work every small transaction.</p></div>
      <div><h3 className="text-sm font-bold">The decision for sales leadership</h3><p className="mt-2 text-sm leading-6 text-slate-700">Approve a measured routing pilot: annual demand, application and readiness determine the route. Name a purchase-path owner, agree sales credit and incentives, and close the loop with verified orders and margin.</p></div>
    </div>
    <p className="mt-4 text-xs leading-5 text-slate-600"><strong>Evidence standard:</strong> trade relevance supports the market-fit case; confirmed application, buying needs and timing establish sales qualification. This view does not claim every trade lead is ready to buy or calculate unverified lost revenue.</p>
    <div className="mt-4 flex flex-wrap gap-4 text-sm font-semibold text-brand-forest"><a className="underline underline-offset-4" href="#buyer-fit-title">Inspect audience evidence ↓</a><a className="underline underline-offset-4" href="#purchase-paths">Review routing decision ↓</a><a className="underline underline-offset-4" href="https://docs.google.com/document/d/1A5UwNWl3V-Fj_Y3xLqK7zT_SAawgsjaC955uEd1XZp0/edit" target="_blank" rel="noopener noreferrer">Executive recommendation ↗</a></div>
  </section>;
}
