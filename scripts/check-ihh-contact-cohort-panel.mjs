// SYNTHETIC isolated server-render checks. No production response or source calls.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { buildIhhContactCohort, sanitizeIhhCohort, IHH_COHORT_STAGES } from '../src/services/ihh-contact-cohort.ts';
const url = new URL('../src/components/IhhContactCohortPanel.tsx', import.meta.url);
const compiled = ts.transpileModule(readFileSync(url, 'utf8'), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017 } }).outputText;
const mod = { exports: {} };
new Function('require', 'module', 'exports', compiled)(createRequire(url), mod, mod.exports);
const { IhhContactCohortPanel } = mod.exports;
const render = state => renderToStaticMarkup(React.createElement(IhhContactCohortPanel, { state }));
assert.match(render(undefined), /No verified collection overlaps the selected dates/);
assert.match(render({ status: 'error' }), /Other dashboard cards are unaffected/);
const input = {
  cohortStart: '2026-09-01T00:00:00Z', cohortEndExclusive: '2026-09-03T00:00:00Z', observationCutoff: '2026-09-10T00:00:00Z',
  acquisitionFilter: 'paid', classificationEvidence: 'PRIVATE_CLASSIFIER <label>',
  contacts: [{ contactId: 'PRIVATE_SYNTHETIC_ID', quizEntryAt: '2026-09-01T00:00:00Z', acquisition: 'paid', attributionSnapshot: { normalizedSource: 'instagram', normalizedChannel: 'paid_social', schemaVersion: 'historical-v2', snapshotAt: '2026-09-02T00:00:00Z', conflict: false } }],
  events: [
    { contactId: 'PRIVATE_SYNTHETIC_ID', stage: 'appointmentScheduled', occurredAt: '2026-09-02T00:00:00Z' },
    { contactId: 'PRIVATE_SYNTHETIC_ID', stage: 'closerScheduled', occurredAt: '2026-09-03T00:00:00Z' },
    { contactId: 'PRIVATE_SYNTHETIC_ID', stage: 'closedWon', occurredAt: '2026-09-03T12:00:00Z' },
  ],
  coverage: Object.fromEntries(IHH_COHORT_STAGES.map(s => [s, { status: 'complete', evidence: 'PRIVATE_COVERAGE' }])),
};
const complete = render({ status: 'ready', cohort: sanitizeIhhCohort(buildIhhContactCohort(input)) });
for (const label of ['Funnel Distribution', 'Quiz leads', 'Appointments scheduled', 'Closer scheduled', 'Closed won', 'Optimization KPI', 'Cohort:', 'Meta paid only']) assert.ok(complete.includes(label), label);
assert.match(complete, /0.0%/);
assert.equal((complete.match(/Median 1 day/g) ?? []).length, 2);
assert.match(complete, /Median 12 hours · 1 contact/);
assert.doesNotMatch(complete, /contacts observed/);
assert.ok(!complete.includes('PRIVATE_SYNTHETIC_ID'));
for (const privateText of ['PRIVATE_CLASSIFIER', 'PRIVATE_COVERAGE', 'Acquisition filter', 'organic', '<select']) assert.ok(!complete.includes(privateText), privateText);
input.coverage.closerScheduled = { status: 'none', evidence: 'SYNTHETIC missing history' };
const missing = render({ status: 'ready', cohort: sanitizeIhhCohort(buildIhhContactCohort(input)) });
assert.equal((missing.match(/>observed<\/span>/g) ?? []).length, 2);
assert.equal((missing.match(/Complete funnel-stage data collection began Sep 11, 2026/g) ?? []).length, 1);
assert.match(missing, /Earlier figures are verified observed minimums/);
console.log('IHH funnel panel SSR checks passed: PrePass-style stages/connectors, median stage timing/sample sizes, one consolidated partial-data notice, Meta-only scope/KPI, zero/missing, no filter UI, no contact IDs or private provenance.');

assert.ok(!JSON.stringify(sanitizeIhhCohort(buildIhhContactCohort(input))).includes('PRIVATE'));
