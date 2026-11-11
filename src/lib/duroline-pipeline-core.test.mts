import assert from 'node:assert/strict';
import test from 'node:test';
import { buildDurolineSnapshot, salesStateForStage } from './duroline-pipeline-core.ts';

const lead = (id: string, contactId: string, stage = 'Interested') => ({ id, contactId, name: id, stage, status: 'open', createdAt: '2026-10-01T00:00:00Z', updatedAt: null });
const deal = (id: number, opportunityId: string | null, contactId: string | null, stage = 'Qualified') => ({ id, name: String(id), stage, stageId: 1, stageType: 'default', hiddenStage: stage === 'Qualified', owner: null, amount: null, createdAt: null, updatedAt: null, daysInStage: null, lastActivityAt: null, highlevelOpportunityId: opportunityId, highlevelContactId: contactId });
const build = (leads: ReturnType<typeof lead>[], deals: ReturnType<typeof deal>[]) => buildDurolineSnapshot({ leads, deals, stageDefinitions: [], capturedAt: '2026-11-11T00:00:00Z', entryStage: 'Qualified' });

test('legacy Qualified and Lead Generated never imply sales contact', () => {
  assert.equal(salesStateForStage('Qualified', 'default'), 'legacy_qualified');
  assert.equal(salesStateForStage('Lead Generated', 'default'), 'awaiting_contact');
  assert.equal(salesStateForStage('Contacted', 'default'), 'contacted');
  assert.equal(salesStateForStage('Negotiating', 'default'), 'negotiating');
  assert.equal(salesStateForStage('Closed Won', 'won'), 'won');
  assert.equal(salesStateForStage('Closed Lost', 'lost'), 'lost');
});
test('quality is current stage membership, not historical or replied', () => {
  const s = build([lead('a', 'ca'), lead('b', 'cb', 'Replied'), lead('c', 'cc', 'Interested - Small'), lead('d', 'cd', 'Sent To Sales')], []);
  assert.deepEqual(s.leads.map(x => x.quality), [true, false, true, true]);
});
test('exact opportunity IDs match, missing IDs remain unmatched, amount null is preserved', () => {
  const s = build([lead('a', 'ca')], [deal(1, 'a', 'ca'), deal(2, null, null)]);
  assert.equal(s.leads[0].matchStatus, 'matched');
  assert.deepEqual(s.leads[0].mmcDealIds, [1]);
  assert.equal(s.deals[1].matchStatus, 'unmatched');
  assert.equal(s.deals[0].amount, null);
});
test('unique contact ID fallback is allowed but multiple opportunities are ambiguous', () => {
  assert.equal(build([lead('a', 'ca')], [deal(1, null, 'ca')]).deals[0].matchStatus, 'matched');
  const s = build([lead('a', 'ca'), lead('b', 'ca')], [deal(1, null, 'ca')]);
  assert.equal(s.deals[0].matchStatus, 'ambiguous');
  assert.equal(s.leads[0].matchStatus, 'ambiguous');
  assert.equal(s.leads[1].matchStatus, 'ambiguous');
});
test('explicit missing opportunity ID must not silently fall back to another opportunity on contact', () => {
  const s = build([lead('a', 'ca')], [deal(1, 'deleted-opportunity', 'ca')]);
  assert.equal(s.deals[0].matchStatus, 'unmatched');
});
test('conflicting exact opportunity and contact IDs fail closed', () => {
  const s = build([lead('a', 'ca'), lead('b', 'cb')], [deal(1, 'a', 'cb')]);
  assert.equal(s.deals[0].matchStatus, 'ambiguous');
  assert.equal(s.leads[0].matchStatus, 'ambiguous');
});
test('one opportunity with multiple deals is ambiguous instead of multiplied sales credit', () => {
  const s = build([lead('a', 'ca')], [deal(1, 'a', 'ca'), deal(2, 'a', 'ca')]);
  assert.equal(s.leads[0].matchStatus, 'ambiguous');
  assert.ok(s.deals.every(x => x.matchStatus === 'ambiguous'));
});
test('duplicate source IDs throw rather than silently discard records', () => {
  assert.throws(() => build([lead('a', 'ca'), lead('a', 'ca')], []), /duplicate/i);
  assert.throws(() => build([], [deal(1, null, null), deal(1, null, null)]), /duplicate/i);
});
