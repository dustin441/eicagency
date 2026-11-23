import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as fit from './duroline-buyer-fit.ts';

const evidence = (fields: Array<{ field: string; value: string }>) => ({ industryEvidenceAvailable: true, industryFields: fields });
test('submission values across fields deduplicate leads and expose overlapping source counts', () => {
  const lead = { stage: 'Interested - Small', ...evidence([
    { field: 'firstName', value: 'Example HVAC' }, { field: 'email', value: 'examplehvac@example.invalid' },
    { field: 'companyName', value: 'Example Cooling' }, { field: 'message', value: 'Need refrigeration products' },
  ]) };
  const classified = fit.classifyIndustrySubmission(lead);
  assert.equal(classified.hits.length, 4);
  assert.deepEqual(classified.terms, ['HVAC', 'cooling', 'refrigeration']);
  const summary = fit.summarizeBuyerFit([lead]);
  assert.equal(summary.signal, 1);
  assert.deepEqual(summary.sourceSignals, { Company: 1, Name: 1, Email: 1, 'Form answer': 1 });
  assert.equal(summary.fullEvidenceRead, 1);
  assert.equal(summary.stageQuality, 1);
});
test('email compounds and aliases match conservatively without provider or substring false positives', () => {
  for (const value of ['johnhvac@gmail.com', 'john@smithheatingandcooling.com', 'john@examplerefrigeration.com', 'john@smithairconditioning.com']) {
    assert.ok(fit.classifyIndustrySubmission(evidence([{ field: 'email', value }])).hits.length, value);
  }
  for (const value of ['john@gmail.com', 'scott@yahoo.com', 'mac@chair.invalid', 'cheating@example.invalid', 'coolingwood@example.invalid']) {
    assert.equal(fit.classifyIndustrySubmission(evidence([{ field: 'email', value }])).hits.length, 0, value);
  }
});
test('only allowlisted values, not labels or internal fields, count', () => {
  const result = fit.classifyIndustrySubmission(evidence([
    { field: 'What HVAC products do you need?', value: 'nothing' },
    { field: 'regionalDirector', value: 'HVAC' }, { field: 'tags', value: 'heating' },
    { field: 'message', value: 'none' }, { field: 'firstName', value: 'Scott' },
  ]));
  assert.equal(result.hits.length, 0);
});
test('blank, unavailable, legacy and empty evidence retain honest coverage', () => {
  assert.equal(fit.classifyIndustrySubmission(evidence([{ field: 'companyName', value: ' N/A ' }])).label, 'Submission fields blank');
  assert.equal(fit.classifyIndustrySubmission({}).label, 'Evidence unavailable');
  const legacy = fit.summarizeBuyerFit([{ stage: 'New', companyName: 'Example HVAC', companyEvidenceAvailable: true }]);
  assert.equal(legacy.signal, 1);
  assert.equal(legacy.legacyCompanyOnly, 1);
  assert.equal(legacy.fullEvidenceRead, 0);
  assert.equal(fit.summarizeBuyerFit([]).signalPercentage, null);
});
