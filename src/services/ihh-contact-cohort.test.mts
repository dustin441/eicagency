// SYNTHETIC fixtures only. These do not assert native IHH attribution or source completeness.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildIhhContactCohort, IHH_COHORT_STAGES, loadIhhCohortCard, type IhhCohortInput } from './ihh-contact-cohort.ts';
const t = (day: number) => `2026-09-${String(day).padStart(2, '0')}T00:00:00Z`;
const snapshot = { normalizedSource: 'facebook', normalizedChannel: 'paid_social', schemaVersion: 'historical-v2-preserved', snapshotAt: t(2), conflict: false };
type MutableFixture = Omit<IhhCohortInput, 'contacts' | 'events'> & {
  contacts: IhhCohortInput['contacts'][number][];
  events: IhhCohortInput['events'][number][];
};
function fixture(): MutableFixture {
  return {
    cohortStart: t(1), cohortEndExclusive: t(3), observationCutoff: t(10), acquisitionFilter: 'paid',
    classificationEvidence: 'SYNTHETIC upstream classification, not approved production semantics',
    contacts: [
      { contactId: 'a', quizEntryAt: t(1), acquisition: 'paid', attributionSnapshot: { ...snapshot } },
      { contactId: 'b', quizEntryAt: t(2), acquisition: 'paid', attributionSnapshot: { ...snapshot } },
      { contactId: 'c', quizEntryAt: t(2), acquisition: 'paid', attributionSnapshot: { ...snapshot } },
    ],
    events: [
      { contactId: 'a', stage: 'appointmentScheduled', occurredAt: t(3) },
      { contactId: 'a', stage: 'closerScheduled', occurredAt: t(4) },
      { contactId: 'a', stage: 'closedWon', occurredAt: t(5) },
      { contactId: 'b', stage: 'appointmentScheduled', occurredAt: t(4) },
    ],
    coverage: Object.fromEntries(IHH_COHORT_STAGES.map(stage => [stage, { status: 'complete', evidence: 'SYNTHETIC complete fixture' }])) as IhhCohortInput['coverage'],
  };
}
test('four nested contact sets, entry cohort not independent event window, prior-stage percentages', () => {
  const result = buildIhhContactCohort(fixture());
  assert.deepEqual(result.stages.map(s => s.count), [3, 2, 1, 1]);
  assert.deepEqual(result.stages.map(s => s.conversionFromPrevious), [null, 2 / 3, 1 / 2, 1]);
  assert.deepEqual(result.stages.map(s => s.contactIds), [['a', 'b', 'c'], ['a', 'b'], ['a'], ['a']]);
  assert.equal(result.optimizationKpi, 'appointmentScheduled');
});
test('repeated contacts/events are idempotent and input order independent', () => {
  const input = fixture();
  const expected = buildIhhContactCohort(input);
  input.contacts = [...input.contacts, input.contacts[0]].reverse();
  input.events = [...input.events, ...input.events].reverse();
  assert.deepEqual(buildIhhContactCohort(input), expected);
});
test('requires chronological evidence, does not invent missing intermediate events', () => {
  const input = fixture();
  input.events.push({ contactId: 'b', stage: 'closerScheduled', occurredAt: t(3) }, { contactId: 'c', stage: 'closedWon', occurredAt: t(6) });
  const result = buildIhhContactCohort(input);
  assert.deepEqual(result.stages.map(s => s.count), [3, 2, 1, 1]);
  assert.deepEqual(result.stages.map(s => s.unsequencedObservedContacts), [0, 0, 1, 1]);
  input.events.push({ contactId: 'b', stage: 'closerScheduled', occurredAt: t(5) });
  assert.equal(buildIhhContactCohort(input).stages[2].count, 2);
});
test('missing, partial and unknown coverage propagate unavailable counts/rates; observations stay diagnostic', () => {
  for (const status of ['none', 'partial', 'unknown'] as const) {
    const input = fixture(); input.coverage.closerScheduled = { status, evidence: 'SYNTHETIC gap' };
    const result = buildIhhContactCohort(input);
    assert.deepEqual(result.stages.map(s => s.count), [3, 2, null, null]);
    assert.equal(result.stages[2].observedCount, 1);
    assert.equal(result.stages[3].conversionFromPrevious, null);
  }
});
test('unprovided coverage never inferred complete from calendar or event presence', () => {
  const input = fixture(); delete input.coverage.quizLead;
  assert.deepEqual(buildIhhContactCohort(input).stages.map(s => s.count), [null, null, null, null]);
});
test('zero denominators yield null rates, actual complete zero stays zero', () => {
  const input = fixture(); input.contacts = []; input.events = [];
  const result = buildIhhContactCohort(input);
  assert.deepEqual(result.stages.map(s => s.count), [0, 0, 0, 0]);
  assert.deepEqual(result.stages.map(s => s.conversionFromPrevious), [null, null, null, null]);
});
test('release rejects non-paid scopes even at the runtime boundary', () => {
  for (const acquisitionFilter of ['organic', 'unknown', 'all'] as const) {
    assert.throws(() => buildIhhContactCohort({ ...fixture(), acquisitionFilter }), /Meta-paid/);
  }
});
test('cohort end is exclusive, cutoff inclusive, outside-cohort events cannot contribute', () => {
  const input = fixture();
  input.contacts.push({ contactId: 'outside', quizEntryAt: t(3), acquisition: 'paid', attributionSnapshot: { ...snapshot } });
  input.events.push({ contactId: 'outside', stage: 'appointmentScheduled', occurredAt: t(4) }, { contactId: 'b', stage: 'closerScheduled', occurredAt: t(10) }, { contactId: 'b', stage: 'closedWon', occurredAt: t(11) });
  assert.deepEqual(buildIhhContactCohort(input).stages.map(s => s.count), [3, 2, 2, 1]);
});
test('bad dates, conflicting contact records, missing classifier evidence fail closed', () => {
  assert.throws(() => buildIhhContactCohort({ ...fixture(), cohortStart: '2026-09-01' }));
  assert.throws(() => buildIhhContactCohort({ ...fixture(), classificationEvidence: '' }));
  assert.throws(() => buildIhhContactCohort({ ...fixture(), observationCutoff: t(1) }));
  const input = fixture(); input.contacts.push({ ...input.contacts[0], acquisition: 'organic' });
  assert.throws(() => buildIhhContactCohort(input), /Conflicting/);
});
test('Meta source gate excludes other paid providers, aliases, missing evidence and conflicts without mutating attribution', () => {
  const cases = [undefined,
    ...['google', 'tiktok', 'linkedin', 'unknown', 'direct', 'fb_page', 'facebook.evil', 'Facebook', ''].map(normalizedSource => ({ ...snapshot, normalizedSource })),
    ...['paid_search', 'organic_social', 'direct', 'unknown'].map(normalizedChannel => ({ ...snapshot, normalizedChannel })),
    { ...snapshot, conflict: true }, { ...snapshot, schemaVersion: '' },
  ];
  for (const attributionSnapshot of cases) {
    const input = fixture(); input.contacts[0] = { ...input.contacts[0], attributionSnapshot };
    const before = JSON.stringify(input);
    assert.deepEqual(buildIhhContactCohort(input).stages.map(s => s.count), [2, 1, 0, 0]);
    assert.equal(JSON.stringify(input), before);
  }
  for (const acquisition of ['organic', 'unknown'] as const) {
    const input = fixture(); input.contacts[0].acquisition = acquisition;
    assert.equal(buildIhhContactCohort(input).stages[0].count, 2);
  }
  for (const normalizedSource of ['meta', 'facebook', 'instagram']) {
    const input = fixture(); input.contacts[0].attributionSnapshot = { ...snapshot, normalizedSource };
    assert.deepEqual(buildIhhContactCohort(input).stages.map(s => s.count), [3, 2, 1, 1]);
  }
});
test('conflicting immutable source snapshots reject rather than selecting one; missing explicit conflict clearance excludes', () => {
  const input = fixture();
  input.contacts.push({ ...input.contacts[0], attributionSnapshot: { ...snapshot, normalizedSource: 'google' } });
  assert.throws(() => buildIhhContactCohort(input), /Conflicting/);
  const missing = fixture();
  delete (missing.contacts[0].attributionSnapshot as Partial<typeof snapshot>).conflict;
  assert.equal(buildIhhContactCohort(missing).stages[0].count, 2);
});
test('equal-time chains and timezone-equivalent boundaries retain exact integer counts', () => {
  const input = fixture();
  input.events = IHH_COHORT_STAGES.slice(1).map(stage => ({ contactId: 'a', stage: stage as 'appointmentScheduled' | 'closerScheduled' | 'closedWon', occurredAt: '2026-08-31T17:00:00-07:00' }));
  assert.deepEqual(buildIhhContactCohort(input).stages.map(s => s.count), [3, 1, 1, 1]);
});
test('card loader blocks by default without calling source; source failures are local', async () => {
  let called = false;
  assert.equal((await loadIhhCohortCard({ status: 'blocked' }, async () => { called = true; return fixture(); })).status, 'blocked');
  assert.equal(called, false);
  const gate = { status: 'approved' as const, classifierEvidence: fixture().classificationEvidence };
  assert.equal((await loadIhhCohortCard({ ...gate, classifierEvidence: 'unmatched evidence' }, async () => fixture())).status, 'error');
  assert.equal((await loadIhhCohortCard(gate, async () => { throw new Error('private source details'); })).status, 'error');
  assert.equal((await loadIhhCohortCard(gate, async () => fixture())).status, 'ready');
});
