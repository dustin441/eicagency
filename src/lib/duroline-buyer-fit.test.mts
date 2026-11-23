import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { tsImport } from 'tsx/esm/api';
import type { DurolinePipelineSnapshot, DurolineLead } from './duroline-pipeline-types.ts';

const pipelineModule = await tsImport('../components/DurolineSalesPipelineClient.tsx', import.meta.url);
const Pipeline = pipelineModule.default.default ?? pipelineModule.default;
const { selectDurolineCohort } = pipelineModule;
const lead = (id: string, stage: string, companyName?: string, companyEvidenceAvailable?: boolean) => ({
  id, stage, companyName, companyEvidenceAvailable, name: `Test ${id}`, contactId: null, status: 'open',
  createdAt: '2026-11-20T10:00:00Z', updatedAt: null, quality: false, mmcDealIds: [], matchStatus: 'unmatched',
} as DurolineLead);
const snapshot = (leads: DurolineLead[]): DurolinePipelineSnapshot => ({
  schemaVersion: 1, capturedAt: '2026-11-23T12:00:00Z', ghlLocationId: 'test', ghlPipelineId: 'test',
  mmcOrganizationId: 1, mmcFunnelId: 1, leads, deals: [], qualityStages: [], stageDefinitions: [], warnings: [], entryStage: null,
});
const render = (value: DurolinePipelineSnapshot, start = '', end = '') => renderToStaticMarkup(createElement(Pipeline, {
  snapshot: value, start, end, capturedAt: value.capturedAt, evaluatedAt: value.capturedAt,
}));
test('SSR preserves four headline counts, adds same-cohort quality percentage and evidence before source summary', () => {
  const html = render(snapshot([lead('a', 'Interested - Small', 'Example HVAC', true), lead('b', 'New', 'Example Mechanical', true)]));
  assert.equal((html.match(/data-headline-metric=/g) || []).length, 4);
  for (const [label, value] of [['Leads', 2], ['Quality', 1], ['MMC', 0], ['Closed Won', 0]] as const) {
    const card = html.split(`data-headline-metric="${label}"`)[1].split('</div>')[0];
    assert.match(card, new RegExp(`text-3xl[^>]*>${value}</p>`));
  }
  assert.match(html, /Who are these leads\?/);
  assert.match(html, /50% of cohort/);
  assert.match(html, /Example HVAC/);
  assert.match(html, /HVAC-related submission signal/);
  assert.match(html, /Are relevant smaller buyers missing a purchase path\?/);
  assert.ok(html.indexOf('Who are these leads?') < html.indexOf('id="mmc-source-title"'));
  assert.ok(html.indexOf('Lead created from') < html.indexOf('data-headline-metric'));
  assert.match(html, /start=2026-10-25(?:&amp;|&)end=2026-11-23/);
});
test('SSR old snapshots and empty cohorts show unavailable evidence, never NaN or observed zero HVAC share', () => {
  for (const value of [snapshot([]), snapshot([lead('old', 'Interested')])]) {
    const html = render(value);
    assert.match(html, /Evidence unavailable/);
    assert.match(html, /Not available/);
    assert.doesNotMatch(html, /NaN|Infinity/);
    assert.doesNotMatch(html, /0% of cohort[^<]*HVAC/);
  }
});
test('date cohort drives both headline quality and buyer-fit denominators', () => {
  const old = { ...lead('outside', 'New', 'Example HVAC', true), createdAt: '2026-01-01T00:00:00Z' };
  const value = snapshot([old, lead('inside', 'Interested - Small', 'Example HVAC', true)]);
  const cohort = selectDurolineCohort(value, '2026-11-01', '2026-11-23');
  assert.equal(cohort.leads.length, 1);
  const html = render(value, '2026-11-01', '2026-11-23');
  assert.match(html, /100% of cohort/);
  assert.match(html, /1 of 1/);
});

test('SSR retains MMC source-grain counts and only credits verified cohort ID matches', () => {
  const value = snapshot([{
    ...lead('a', 'Interested', 'Example Cooling', true), matchStatus: 'matched', mmcDealIds: [1, 2],
  }]);
  const deal = (id: number, matchStatus: 'matched' | 'unmatched' | 'ambiguous', salesState: 'won' | 'contacted') => ({
    id, name: `Test deal ${id}`, stage: salesState, stageId: 1, stageType: 'test', hiddenStage: false, owner: 'Test owner',
    amount: null, createdAt: null, updatedAt: null, daysInStage: null, lastActivityAt: null,
    highlevelOpportunityId: null, highlevelContactId: null, matchStatus, salesState,
  });
  value.deals = [deal(1, 'matched', 'won'), deal(2, 'ambiguous', 'won'), deal(3, 'unmatched', 'contacted')];
  const allTime = render(value);
  const scoped = render(value, '2026-11-01', '2026-11-23');
  for (const [html, expectedMmc, expectedWon] of [[allTime, 3, 2], [scoped, 1, 1]] as const) {
    for (const [label, count] of [['MMC', expectedMmc], ['Closed Won', expectedWon]] as const) {
      const card = html.split(`data-headline-metric="${label}"`)[1].split('</div>')[0];
      assert.match(card, new RegExp(`text-3xl[^>]*>${count}</p>`));
    }
    assert.match(html, /Matched MMC owner/);
    assert.match(html, /Test owner/);
  }
});

test('SSR renders exact escaped field evidence and honest broad versus legacy coverage', () => {
  const expanded = { ...lead('expanded', 'Interested - Small', 'Example Company', true),
    industryEvidenceAvailable: true, industryFields: [
      { field: 'firstName', value: 'Example HVAC' },
      { field: 'email', value: 'examplehvac@example.invalid' },
      { field: 'message', value: '<script>HVAC & cooling</script>' },
    ],
  };
  const html = render(snapshot([expanded, lead('legacy', 'New', 'Example Heating', true)]));
  assert.match(html, /Broader submitted fields read:/);
  assert.match(html, /Legacy company-only/);
  assert.match(html, /broader form-field evidence unavailable/);
  assert.match(html, /examplehvac@example.invalid/);
  assert.match(html, /&lt;script&gt;HVAC &amp; cooling&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script>HVAC/);
  assert.match(html, /Overlapping counts/);
  assert.match(html, /First name/);
  assert.match(html, /Matching terms/);
  assert.equal((html.match(/data-headline-metric=/g) || []).length, 4);
});

const helper = await import('./duroline-buyer-fit.ts').catch(() => null);
test('ambiguous terms, unrelated names and embedded substrings are not positive evidence', () => {
  assert.ok(helper);
  for (const companyName of ['Example Mechanical', 'Example Electrical Construction', 'Air Pros', 'AC Supply', 'Mechanical Pros', 'Chair Company', 'HVACation', 'Coolingwood', 'Duroline']) {
    assert.equal(helper.classifyCompanyName({ companyName, companyEvidenceAvailable: true }).label, 'No recognizable name signal', companyName);
  }
});
test('blank and placeholder companies are missing, but old or failed evidence is unavailable', () => {
  assert.ok(helper);
  for (const companyName of [null, undefined, '', '  ', 'None', 'Self', 'N/A', 'Myself', 'null', 'undefined', 'NA', 'N.A.', 'Not available', 'Not applicable', '-', '--', 'Unknown', 'No company', 'N / A']) {
    assert.equal(helper.classifyCompanyName({ companyName, companyEvidenceAvailable: true }).label, 'Company missing', String(companyName));
  }
  for (const companyEvidenceAvailable of [false, undefined]) {
    assert.equal(helper.classifyCompanyName({ companyName: 'Example HVAC', companyEvidenceAvailable }).label, 'Evidence unavailable');
  }
});
test('summarizes one complete cohort with separate stage and company evidence axes', () => {
  assert.ok(helper);
  assert.equal(typeof helper.summarizeBuyerFit, 'function');
  const leads = [
    { stage: 'Interested - Small', companyName: 'Example HVAC', companyEvidenceAvailable: true },
    { stage: 'New Lead', companyName: 'Example Heating', companyEvidenceAvailable: true },
    { stage: 'Interested', companyName: 'Example Mechanical', companyEvidenceAvailable: true },
    { stage: 'Finding Distributor', companyName: 'None', companyEvidenceAvailable: true },
    { stage: 'Sent To Sales' },
  ];
  const result = helper.summarizeBuyerFit(leads);
  assert.equal(result.total, 5);
  assert.equal(result.signal, 2);
  assert.equal(result.signalPercentage, 40);
  assert.equal(result.stageQuality, 4);
  assert.equal(result.qualityPercentage, 80);
  assert.equal(result.small, 1);
  assert.equal(result.smallPercentage, 20);
  assert.equal(result.signalAndQuality, 1);
  assert.equal(result.signalNotQuality, 1);
  assert.equal(result.evidenceRead, 4);
  assert.equal(result.readPercentage, 80);
  assert.equal(result.companyPresent, 3);
  assert.equal(result.companyMissing, 1);
  assert.equal(result.noSignal, 1);
  assert.equal(result.unavailable, 1);
});
test('zero denominators and unavailable old evidence never report an observed zero percent', () => {
  assert.ok(helper);
  assert.equal(typeof helper.summarizeBuyerFit, 'function');
  const empty = helper.summarizeBuyerFit([]);
  assert.equal(empty.signalPercentage, null);
  assert.equal(empty.qualityPercentage, null);
  assert.equal(empty.smallPercentage, null);
  assert.equal(empty.readPercentage, null);
  const old = helper.summarizeBuyerFit([{ stage: 'Interested', companyName: 'Example HVAC' }]);
  assert.equal(old.signalPercentage, null);
  assert.equal(old.qualityPercentage, 100);
  assert.equal(old.unavailable, 1);
  const observed = helper.summarizeBuyerFit([{ stage: 'New', companyName: null, companyEvidenceAvailable: true }]);
  assert.equal(observed.signalPercentage, 0);
});

test('UTC presets include the evaluated calendar day across month and leap-year boundaries', () => {
  assert.ok(helper);
  assert.equal(typeof helper.durolineCohortPreset, 'function');
  assert.deepEqual(helper.durolineCohortPreset('2026-11-23T23:59:00Z', 30), { start: '2026-10-25', end: '2026-11-23' });
  assert.deepEqual(helper.durolineCohortPreset('2026-11-23T00:01:00Z', 90), { start: '2026-08-26', end: '2026-11-23' });
  assert.deepEqual(helper.durolineCohortPreset('2024-03-01T01:00:00+02:00', 30), { start: '2024-01-31', end: '2024-02-29' });
  assert.equal(helper.durolineCohortPreset('bad date', 30), null);
});

test('recognizes explicit company-name HVAC terms, with auditable matches', () => {
  assert.ok(helper, 'Buyer-fit helper must exist');
  for (const [companyName, term] of [
    ['Example HVAC Services', 'HVAC'], ['Example Heating Ltd', 'heating'],
    ['Example Cooling LLC', 'cooling'], ['Example Refrigeration', 'refrigeration'],
    ['Example Air Conditioning', 'air conditioning'], ['Example Air-Conditioning', 'air conditioning'],
  ]) {
    const result = helper.classifyCompanyName({ companyName, companyEvidenceAvailable: true });
    assert.equal(result.label, 'HVAC-related name signal', companyName);
    assert.deepEqual(result.terms, [term]);
  }
});
