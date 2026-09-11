import type { IhhCohortPublicState, IhhCohortStage } from '../services/ihh-contact-cohort';

const labels: Record<IhhCohortStage, string> = {
  quizLead: 'Quiz lead', appointmentScheduled: 'Appointment scheduled',
  closerScheduled: 'Closer scheduled', closedWon: 'Closed won',
};

/** Presentation accepts only the sanitized public aggregate contract. */
export function IhhContactCohortPanel({ state = { status: 'blocked' } }: { state?: IhhCohortPublicState }) {
  return (
    <section aria-label="IHH contact cohort funnel" className="rounded-xl border border-slate-200 bg-white p-5 text-slate-900">
      <h2 className="text-lg font-semibold">IHH Meta-paid CRM contact-cohort funnel</h2>
      <p className="mt-1 text-sm text-slate-600">Primary optimization KPI: Appointment scheduled. Original acknowledged quiz-lead subset with verified Meta-paid snapshots; not a complete quiz census or platform-attributed conversions.</p>
      {state.status !== 'ready' ? (
        <p role="status" className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          {state.status === 'stale'
            ? `Collection is stale — last verified observation: ${state.observationCutoff}. A scan within six hours is required; counts are withheld.`
            : state.status === 'blocked'
            ? 'Unavailable — no published forward cohort overlaps the selected dates. Dates before verified collection are not backfilled.'
            : 'This funnel is unavailable because its source could not be validated or loaded. Other dashboard cards are unaffected.'}
        </p>
      ) : (
        <>
          <p className="mt-3 text-sm text-amber-900">Forward-only observed cohort. The exact UTC interval below is clipped to verified collection coverage and the latest scan, not full selected calendar days. Complete coverage means the verified source scan, not the native conversion universe.</p>
          <dl className="mt-4 grid gap-2 text-xs text-slate-600 sm:grid-cols-2">
            <div><dt className="font-semibold">Quiz-entry cohort (start inclusive, end exclusive)</dt><dd className="break-words">{state.cohort.cohortStart} → {state.cohort.cohortEndExclusive}</dd></div>
            <div><dt className="font-semibold">Observed through (inclusive)</dt><dd>{state.cohort.observationCutoff}</dd></div>
            <div><dt className="font-semibold">Acquisition scope</dt><dd>Verified Meta-paid only (Facebook / Instagram).</dd></div>
          </dl>
          <ol aria-label="Chronological nested contact stages" className="mt-5 space-y-3">
            {state.cohort.stages.map((stage, index) => {
              const entryCount = state.cohort.stages[0].count;
              const width = stage.count !== null && entryCount !== null && entryCount > 0 ? stage.count / entryCount * 100 : 0;
              return (
                <li key={stage.stage} className="rounded-lg border border-slate-200 p-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="font-medium">{index + 1}. {labels[stage.stage]}{stage.stage === 'appointmentScheduled' ? ' · Optimization KPI' : ''}</h3>
                    <strong>{stage.count === null ? 'Unavailable' : stage.count.toLocaleString('en-US')}</strong>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">{index === 0 ? 'Unique contacts entering the selected cohort' : `${stage.conversionFromPrevious === null ? 'Unavailable' : `${(stage.conversionFromPrevious * 100).toFixed(1)}%`} of previous stage`}</p>
                  {stage.count !== null && <div aria-hidden="true" className="mt-2 h-2 overflow-hidden rounded bg-slate-100"><div className="h-full bg-indigo-500" style={{ width: `${width}%` }} /></div>}
                  <p className="mt-2 text-xs text-slate-600">Source coverage: {stage.coverage.status}.{!stage.sequenceCoverageComplete && ' Full preceding-stage coverage is not established; counts and rates are unavailable.'}</p>
                </li>
              );
            })}
          </ol>
          <details className="mt-4 text-xs text-slate-600">
            <summary className="cursor-pointer font-medium">Observed evidence and sequence diagnostics (not complete outcome totals)</summary>
            <p className="mt-2">Each stage requires the same contact and an event at or after the previous stage, through the observation cutoff. Equal timestamps are accepted at source precision. Missing intermediate stages are never inferred. Incomplete history can hide actual progression.</p>
            <ul className="mt-2 space-y-1">{state.cohort.stages.map(stage => <li key={stage.stage}>{labels[stage.stage]}: {stage.observedCount} observed nested contacts; {stage.unsequencedObservedContacts} observed contacts lacking chronological sequence evidence.</li>)}</ul>
          </details>
        </>
      )}
    </section>
  );
}
