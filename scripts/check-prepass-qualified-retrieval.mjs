import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { load } from './check-prepass-qualified-campaigns.mjs';
const source = readFileSync(new URL('../src/services/analytics.ts', import.meta.url), 'utf8');
assert.ok(source.includes('async function fetchAbmQualifiedCohort('), 'Server retrieval must exist');
const fn = source.slice(source.indexOf('async function fetchAbmQualifiedCohort('), source.indexOf('// ─── fetchFocusData'));
const cjsModule = { exports: {} };
vm.runInNewContext(ts.transpileModule(fn + '\nexports.fetch = fetchAbmQualifiedCohort;', { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText, { exports: cjsModule.exports, Date, Set, ...load('../src/services/prepass-campaign-performance.ts') });
const calls = [];
const submission = { id_marketo: '1', marketo_guid: 'a', activity_date: '2026-09-01T00:00:00Z', fleet_size: '101-500', utm_campaign: 'Test' };
function client(mode) {
  return { from(table) {
    const filters = []; const q = {};
    for (const name of ['select', 'eq', 'in', 'gte', 'lt', 'order']) q[name] = (...args) => { filters.push([name, ...args]); return q; };
    q.range = async (from, to) => {
      calls.push({ table, filters, from, to });
      if (mode === 'multipage' && table === 'prepass_abm_form_submissions') {
        const rows = Array.from({ length: 501 }, (_, i) => ({ ...submission, id_marketo: String(i), marketo_guid: String(i) }));
        return { data: rows.slice(from, to + 1), count: rows.length, error: null };
      }
      if (mode === 'error' && table === 'Google SQL') return { data: null, count: null, error: { message: 'failure' } };
      if (mode === 'cap') return { data: Array.from({length: 500}, () => submission), count: 1000000, error: null };
      if (mode === 'partial') return { data: [submission], count: 2, error: null };
      if (mode === 'null') return { data: null, count: null, error: null };
      if (table === 'prepass_abm_form_submissions') return { data: [submission], count: 1, error: null };
      return { data: table.endsWith('MQL') ? [{ id_marketo: '1' }] : [], count: table.endsWith('MQL') ? 1 : 0, error: null };
    };
    return q;
  } };
}
const data = await cjsModule.exports.fetch(client(), '2026-09-01', '2026-09-13');
assert.equal(data.submissions.length, 1);
assert.equal(new Set(data.mqls).size, 1, 'Union both stage channels');
assert.equal(calls.length, 7);
const filters = calls[0].filters;
assert.ok(filters.some(f => f[0] === 'eq' && f[1] === 'form_id' && f[2] === '1034'));
assert.ok(filters.some(f => f[0] === 'lt' && f[2] === '2026-09-14T00:00:00.000Z'));
assert.ok(filters.some(f => f[0] === 'in' && f[1] === 'landing_page' && f[2].length === 4));
for (const c of calls.slice(1)) {
  assert.ok(c.filters.some(f => f[0] === 'order' && f[1] === 'uuid'));
  assert.ok(!c.filters.some(f => ['gte', 'lt'].includes(f[0])), 'Lifetime stage membership, never stage date filtering');
}
for (const mode of ['error', 'partial', 'null', 'cap']) await assert.rejects(() => cjsModule.exports.fetch(client(mode), '2026-09-01', '2026-09-13'), /complete|limit/i);
assert.ok(calls.length < 220, 'Global bounded requests');
calls.length = 0;
const paged = await cjsModule.exports.fetch(client('multipage'), '2026-09-01', '2026-09-13');
assert.equal(paged.submissions.length, 501, 'Fetch beyond first page');
assert.equal(calls.filter(c => c.table === 'prepass_abm_form_submissions').length, 2);
for (const call of calls.filter(c => c.table !== 'prepass_abm_form_submissions')) {
  assert.ok(call.filters.find(f => f[0] === 'in')[2].length <= 100, 'Bounded membership batches');
}
console.log('PASS: read-only scoped queries, exclusive UTC end, stable ordering, lifetime stage union, partial/error/null/limit fail closed');
