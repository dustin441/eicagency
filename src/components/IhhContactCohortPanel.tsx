'use client';

import { ChevronDown } from 'lucide-react';
import type { IhhCohortPublicState, IhhCohortStage } from '../services/ihh-contact-cohort';

const labels: Record<IhhCohortStage, string> = {
  quizLead: 'Quiz leads',
  appointmentScheduled: 'Appointments scheduled',
  closerScheduled: 'Closer scheduled',
  closedWon: 'Closed won',
};

const styles: Record<IhhCohortStage, string> = {
  quizLead: 'bg-purple-50 border-purple-200',
  appointmentScheduled: 'bg-brand-forest/10 border-brand-forest/25',
  closerScheduled: 'bg-blue-50 border-blue-200',
  closedWon: 'bg-emerald-50 border-emerald-200',
};

function fmtDate(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', timeZone: 'America/Phoenix', timeZoneName: 'short',
  }).format(new Date(value));
}

/** Presentation accepts only the sanitized public aggregate contract. */
export function IhhContactCohortPanel({ state = { status: 'blocked' } }: { state?: IhhCohortPublicState }) {
  return (
    <section aria-label="IHH contact cohort funnel" className="h-full rounded-[2.5rem] border border-gray-100 bg-white p-6 shadow-sm sm:p-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-xl font-bold text-brand-dark">Funnel Distribution</h2>
          <p className="mt-1 text-sm font-medium text-gray-400">Verified Meta-paid CRM conversion by stage</p>
        </div>
        <span className="rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-blue-700">Meta paid only</span>
      </div>

      {state.status !== 'ready' ? (
        <p role="status" className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">
          {state.status === 'stale'
            ? `Collection is stale — last verified observation: ${state.observationCutoff}. Counts are withheld until collection succeeds.`
            : state.status === 'blocked'
              ? 'No verified collection overlaps the selected dates.'
              : 'The funnel source could not be validated. Other dashboard cards are unaffected.'}
        </p>
      ) : (() => {
        const entryStage = state.cohort.stages[0];
        const entryCount = entryStage?.count ?? entryStage?.observedCount ?? 0;
        return (
          <>
            <div className="space-y-0">
              {state.cohort.stages.map((stage, index) => {
                const displayCount = stage.count ?? stage.observedCount;
                const width = entryCount > 0
                  ? Math.min((displayCount / entryCount) * 100, 100)
                  : 0;
                const isKpi = stage.stage === 'appointmentScheduled';
                return (
                  <div key={stage.stage}>
                    <div className={isKpi ? 'rounded-2xl border border-brand-forest/15 bg-brand-forest/5 p-3 -mx-3' : ''}>
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`text-sm font-bold ${isKpi ? 'text-brand-forest' : 'text-gray-700'}`}>{labels[stage.stage]}</span>
                          {isKpi && <span className="rounded-full bg-brand-forest/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-brand-forest">Optimization KPI</span>}
                        </div>
                        <span className="text-right tabular-nums text-base font-bold text-brand-dark">
                          {displayCount.toLocaleString('en-US')}
                          {stage.count === null && <span className="ml-1 text-[10px] font-semibold uppercase tracking-wide text-amber-700">observed</span>}
                        </span>
                      </div>
                      <div className="h-9 w-full overflow-hidden rounded-xl border border-gray-100 bg-gray-50">
                        <div className={`h-full min-w-0 rounded-xl border-r-2 transition-[width] duration-700 ${styles[stage.stage]}`} style={{ width: `${width}%` }} />
                      </div>
                      {stage.coverage.status !== 'complete' && <p className="mt-1.5 text-xs font-medium text-amber-700">Partial source coverage — observed minimum shown; actual progression may be higher.</p>}
                    </div>
                    {index < state.cohort.stages.length - 1 && (() => {
                      const next = state.cohort.stages[index + 1];
                      const observedRate = stage.observedCount > 0 ? next.observedCount / stage.observedCount : null;
                      const rate = next.conversionFromPrevious ?? observedRate;
                      return (
                      <div className="flex items-center gap-2 py-2 pl-2">
                        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-gray-300" />
                        <span className="rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
                          {rate === null
                            ? '—'
                            : `${(rate * 100).toFixed(1)}%`} {next.sequenceCoverageComplete ? 'converted' : 'observed'}
                        </span>
                      </div>
                      );
                    })()}
                  </div>
                );
              })}
            </div>
            <div className="mt-5 border-t border-gray-100 pt-4 text-xs leading-relaxed text-gray-500">
              <p><strong className="text-gray-700">Cohort:</strong> {fmtDate(state.cohort.cohortStart)} through {fmtDate(state.cohort.cohortEndExclusive)}</p>
              <p className="mt-1">Same-contact chronological progression. Organic, direct, unknown and non-Meta paid sources are excluded.</p>
            </div>
          </>
        );
      })()}
    </section>
  );
}
