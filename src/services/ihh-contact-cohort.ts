/** Pure, isolated IHH reporting. No source access or acquisition inference.
 * The future adapter must supply canonical quiz-entry timestamps, contact identity,
 * existing acquisition classifications, and audited coverage for the exact scope.
 */
export const IHH_COHORT_STAGES = ['quizLead', 'appointmentScheduled', 'closerScheduled', 'closedWon'] as const;
export type IhhCohortStage = typeof IHH_COHORT_STAGES[number];
export type IhhAcquisition = 'paid' | 'organic' | 'unknown';
export type IhhAcquisitionFilter = IhhAcquisition | 'all';
/** Copied established immutable attribution, NEVER recomputed from clicks/UTMs.
 * Missing snapshots and unresolved multiple-opportunity attribution are ineligible.
 */
export interface IhhAttributionSnapshot {
  normalizedSource: string;
  normalizedChannel: string;
  schemaVersion: string;
  snapshotAt: string;
  conflict: boolean;
}
export type IhhCoverage = { status: 'complete' | 'partial' | 'none' | 'unknown'; evidence: string };
export interface IhhCohortInput {
  /** Explicit timezone-bearing instants. Cohort is [start, end); observation is <= cutoff. */
  cohortStart: string;
  cohortEndExclusive: string;
  observationCutoff: string;
  acquisitionFilter: IhhAcquisitionFilter;
  classificationEvidence: string;
  contacts: readonly { contactId: string; quizEntryAt: string; acquisition: IhhAcquisition; attributionSnapshot?: IhhAttributionSnapshot }[];
  events: readonly { contactId: string; stage: Exclude<IhhCohortStage, 'quizLead'>; occurredAt: string }[];
  /** Missing coverage defaults unknown. Completeness is never inferred from an epoch. */
  coverage: Partial<Record<IhhCohortStage, IhhCoverage>>;
}
export interface IhhCohortStageResult {
  stage: IhhCohortStage;
  count: number | null;
  observedCount: number;
  /** Internal evidence only; UI must not render person identifiers. Strictly nested. */
  contactIds: string[];
  conversionFromPrevious: number | null;
  coverage: IhhCoverage;
  sequenceCoverageComplete: boolean;
  /** Observed stage contacts without a supported chronological chain; not invented events. */
  unsequencedObservedContacts: number;
}
export interface IhhContactCohort {
  cohortStart: string;
  cohortEndExclusive: string;
  observationCutoff: string;
  acquisitionFilter: IhhAcquisitionFilter;
  classificationEvidence: string;
  optimizationKpi: 'appointmentScheduled';
  stages: IhhCohortStageResult[];
}
function instant(value: string): number {
  if (!/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value) || !Number.isFinite(Date.parse(value))) {
    throw new Error('Expected a valid timezone-bearing timestamp');
  }
  return Date.parse(value);
}
export function buildIhhContactCohort(input: IhhCohortInput): IhhContactCohort {
  const start = instant(input.cohortStart), end = instant(input.cohortEndExclusive), cutoff = instant(input.observationCutoff);
  if (start >= end || cutoff < end) throw new Error('Invalid cohort window or observation cutoff');
  if (!input.classificationEvidence.trim()) throw new Error('Upstream classifier evidence is required');
  if (input.acquisitionFilter !== 'paid') throw new Error('Meta-paid release requires paid scope');
  const contacts = new Map<string, { entry: number; acquisition: IhhAcquisition; snapshotKey: string; eligible: boolean }>();
  for (const contact of input.contacts) {
    if (!contact.contactId.trim() || !['paid', 'organic', 'unknown'].includes(contact.acquisition)) throw new Error('Invalid canonical contact');
    const entry = instant(contact.quizEntryAt), previous = contacts.get(contact.contactId);
    const snapshot = contact.attributionSnapshot;
    const snapshotKey = JSON.stringify(snapshot ? [snapshot.normalizedSource, snapshot.normalizedChannel, snapshot.schemaVersion, snapshot.snapshotAt, snapshot.conflict] : null);
    const eligible = contact.acquisition === 'paid' && !!snapshot && snapshot.conflict === false
      && ['meta', 'facebook', 'instagram'].includes(snapshot.normalizedSource)
      && snapshot.normalizedChannel === 'paid_social'
      && typeof snapshot.schemaVersion === 'string' && !!snapshot.schemaVersion.trim()
      && Number.isFinite(instant(snapshot.snapshotAt));
    if (previous && (previous.entry !== entry || previous.acquisition !== contact.acquisition || previous.snapshotKey !== snapshotKey)) throw new Error('Conflicting canonical contact records');
    contacts.set(contact.contactId, { entry, acquisition: contact.acquisition, snapshotKey, eligible });
  }
  let chain = new Map<string, number>();
  for (const [id, contact] of contacts) {
    if (contact.entry >= start && contact.entry < end && contact.eligible) chain.set(id, contact.entry);
  }
  const cohortIds = new Set(chain.keys());
  const indexed = new Map<IhhCohortStage, Map<string, number[]>>();
  for (const event of input.events) {
    if (!IHH_COHORT_STAGES.slice(1).includes(event.stage) || !event.contactId.trim()) throw new Error('Invalid stage event');
    const at = instant(event.occurredAt);
    if (!cohortIds.has(event.contactId) || at > cutoff) continue;
    const stageEvents = indexed.get(event.stage) ?? new Map<string, number[]>();
    const times = stageEvents.get(event.contactId) ?? [];
    times.push(at); stageEvents.set(event.contactId, times); indexed.set(event.stage, stageEvents);
  }
  let complete = true;
  const stages: IhhCohortStageResult[] = [];
  for (const stage of IHH_COHORT_STAGES) {
    let unsequencedObservedContacts = 0;
    if (stage !== 'quizLead') {
      const next = new Map<string, number>();
      for (const [id, times] of indexed.get(stage) ?? []) {
        const prior = chain.get(id);
        // Equal timestamps are allowed: source precision may collapse ordered transitions.
        const valid = prior === undefined ? [] : times.filter(at => at >= prior);
        if (valid.length) next.set(id, valid.reduce((a, b) => Math.min(a, b)));
        else unsequencedObservedContacts++;
      }
      chain = next;
    }
    const coverage = input.coverage[stage] ?? { status: 'unknown' as const, evidence: 'Coverage not supplied' };
    if (!['complete', 'partial', 'none', 'unknown'].includes(coverage.status)) throw new Error('Invalid coverage status');
    if (coverage.status === 'complete' && !coverage.evidence.trim()) throw new Error('Complete coverage requires audited evidence');
    complete = complete && coverage.status === 'complete';
    const count = complete ? chain.size : null;
    const previousCount = stages.at(-1)?.count;
    stages.push({ stage, count, observedCount: chain.size, contactIds: [...chain.keys()].sort(), coverage,
      sequenceCoverageComplete: complete, unsequencedObservedContacts,
      conversionFromPrevious: count !== null && previousCount != null && previousCount > 0 ? count / previousCount : null });
  }
  return { cohortStart: input.cohortStart, cohortEndExclusive: input.cohortEndExclusive,
    observationCutoff: input.observationCutoff, acquisitionFilter: input.acquisitionFilter,
    classificationEvidence: input.classificationEvidence, optimizationKpi: 'appointmentScheduled', stages };
}
export type IhhCohortCardState =
  | { status: 'blocked' }
  | { status: 'error' }
  | { status: 'ready'; cohort: IhhContactCohort };
export type IhhCohortSourceGate = { status: 'blocked' } | { status: 'approved'; classifierEvidence: string };
/** Default gate is blocked. No adapter exists here. Never rejects the enclosing page. */
export async function loadIhhCohortCard(
  gate: IhhCohortSourceGate = { status: 'blocked' },
  source?: () => Promise<IhhCohortInput>,
): Promise<IhhCohortCardState> {
  if (gate.status !== 'approved' || !gate.classifierEvidence.trim() || !source) return { status: 'blocked' };
  try {
    const input = await source();
    if (input.classificationEvidence !== gate.classifierEvidence) throw new Error('Source classifier evidence does not match approval');
    return { status: 'ready', cohort: buildIhhContactCohort(input) };
  } catch {
    // No source errors or PII are exposed to the UI. Other dashboard reads remain independent.
    return { status: 'error' };
  }
}

/** Explicit allowlist at the server/client boundary; no IDs or free-form evidence. */
export type IhhPublicCohort = Omit<IhhContactCohort, 'classificationEvidence' | 'stages'> & {
  stages: (Omit<IhhCohortStageResult, 'contactIds' | 'coverage'> & { coverage: { status: IhhCoverage['status'] } })[];
};
export type IhhCohortPublicState = { status: 'blocked' } | { status: 'error' } | { status: 'stale'; observationCutoff: string } | { status: 'ready'; cohort: IhhPublicCohort };
export function sanitizeIhhCohort(cohort: IhhContactCohort): IhhPublicCohort {
  return { cohortStart: cohort.cohortStart, cohortEndExclusive: cohort.cohortEndExclusive,
    observationCutoff: cohort.observationCutoff, acquisitionFilter: cohort.acquisitionFilter,
    optimizationKpi: cohort.optimizationKpi, stages: cohort.stages.map(s => ({
      stage: s.stage, count: s.count, observedCount: s.observedCount,
      conversionFromPrevious: s.conversionFromPrevious, coverage: { status: s.coverage.status },
      sequenceCoverageComplete: s.sequenceCoverageComplete, unsequencedObservedContacts: s.unsequencedObservedContacts,
    })) };
}
