import { test } from 'node:test';
import assert from 'node:assert/strict';
import { percentage, recommendations, parseFilters } from './prepass-marketo-database-math.ts';

test('zero denominators are unavailable, not zero conversion', () => {
  assert.equal(percentage(0, 0), null);
  assert.equal(percentage(2, 8), 25);
});

test('cohort dates reject impossible and reversed ranges', () => {
  assert.throws(() => parseFilters({ start: '2026-02-30' }));
  assert.throws(() => parseFilters({ start: '2026-11-02', end: '2026-11-01' }));
  assert.deepEqual(parseFilters({}), { start: null, end: null, source: null, segment: null, sourceField: 'leadSource' });
  assert.equal(parseFilters({ sourceField: 'originalutmsource' }).sourceField, 'originalutmsource');
  assert.throws(() => parseFilters({ sourceField: 'email' }));
});

test('diagnostics cite measured missingness, never predict uplift', () => {
  const messages = recommendations({ people: 10, unknownSource: 3, missingLeadDate: 2, invalidTransitions: 1 });
  assert.ok(messages.some(x => x.includes('3 of 10')));
  assert.ok(messages.some(x => x.includes('2 of 10')));
  assert.ok(messages.some(x => x.includes('1')));
  assert.equal(recommendations({ people: 0, unknownSource: 0, missingLeadDate: 0, invalidTransitions: 0 }).length, 1);
  const opportunities = recommendations({ people: 20, unknownSource: 0, missingLeadDate: 0, invalidTransitions: 0, mql: 12, mqlSql: 5, sql: 5, sqlWon: 2 });
  assert.ok(opportunities.some(x => x.includes('7 of 12 MQLs')));
  assert.ok(opportunities.some(x => x.includes('3 of 5 SQLs')));
});
