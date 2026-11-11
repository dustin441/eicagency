import type { DurolinePipelineSnapshot } from '@/lib/duroline-pipeline-types';

/** Source pipeline is deliberately separate from ID-verified marketing attribution. */
export default function DurolineMmcSourceSummary({ snapshot }: { snapshot: DurolinePipelineSnapshot }) {
  const count = (state: string) => snapshot.deals.filter(x => x.salesState === state).length;
  const won = snapshot.deals.filter(x => x.salesState === 'won');
  const unvaluedWins = won.filter(x => x.amount === null || x.amount <= 0).length;
  const unverified = snapshot.deals.filter(x => x.matchStatus !== 'matched').length;
  const cards = [
    ['Total MMC deals', snapshot.deals.length],
    ['Legacy Qualified', count('legacy_qualified')],
    ['Lead Generated', count('awaiting_contact')],
    ['Contacted', count('contacted')],
    ['Negotiating', count('negotiating')],
    ['Closed Won', count('won')],
    ['Closed Lost', count('lost')],
  ] as const;
  return <section aria-labelledby="mmc-source-title" className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <h2 id="mmc-source-title" className="text-lg font-bold">Complete MMC pipeline · all-time source</h2>
      <span className="text-xs font-medium text-slate-500">DuroLine / Line Sets · all-time current state</span>
    </div>
    <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-500">Every deal in the Duro Line sales pipeline, including legacy records without HighLevel IDs. These source totals are not attributed marketing results and do not change with the lead-created cohort below.</p>
    <details className="mt-4 rounded-xl border border-slate-200 p-4">
      <summary className="cursor-pointer text-sm font-semibold">Supporting source stage counts · all {snapshot.deals.length} MMC deals</summary>
    <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
      {cards.map(([label, value]) => <div key={label} data-source-metric={label} className={`rounded-xl p-3 ${label === 'Closed Won' ? 'bg-emerald-50 text-brand-forest' : 'bg-slate-50 text-slate-900'}`}>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-2 text-2xl font-bold">{value.toLocaleString('en-US')}</p>
      </div>)}
    </div>
    </details>
    <div className="mt-4 space-y-2 text-xs leading-5 text-slate-600">
      <p><strong>Qualified is not sales contact.</strong> The integration defaults to the hidden Qualified stage. Contacted or Negotiating is the recorded sales-progress signal.</p>
      <p><strong>{unverified} deals need attribution review.</strong> Missing or conflicting IDs do not prove the lead was never handed off. They prevent reliable lead-to-sale matching.</p>
      {unvaluedWins > 0 && <p className="font-medium text-amber-800">{unvaluedWins} Closed Won deal{unvaluedWins === 1 ? ' has' : 's have'} no positive amount recorded. This is a source stage label, not verified revenue or a verified marketing-generated sale.</p>}
      {won.length === 0 && <p className="font-medium text-amber-800">0 source Closed Won deals are currently recorded. No won revenue is verified.</p>}
      {!snapshot.deals.some(deal => deal.amount !== null && deal.amount > 0) && <p className="font-medium text-amber-800">No source MMC deal has a positive amount recorded. Amounts do not establish revenue.</p>}
      <p>Source records are retained as-is, including any existing internal or test records. No name-based exclusions or inferred sales credit. No stage resets or CRM mutations.</p>
    </div>
  </section>;
}
