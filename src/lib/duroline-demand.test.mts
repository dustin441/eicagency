import assert from 'node:assert/strict';
import { test } from 'node:test';
import { classifyIndustrySubmission, summarizeBuyerFit } from './duroline-buyer-fit.ts';
const submission = (value: string, field = 'companyName') => ({ industryEvidenceAvailable: true, industryFields: [{ field, value }] });
test('direct trade signals include AC mechanical and explicit business compounds', () => {
  for (const value of ['FixtureHVACServices', 'Fixture Heating', 'Fixture Cooling', 'AC Supply', 'A/C Services', 'Air Conditioning', 'FixtureRefrigerationServices', 'Mechanical Pros', 'Duct installer', 'Mini-split installer', 'VRF systems']) {
    assert.equal(classifyIndustrySubmission(submission(value)).category, 'direct', value);
  }
});
test('adjacent trades remain separate from direct and possible air or service clues', () => {
  for (const value of ['Electric', 'Electrical', 'Electricians', 'Plumbing', 'Construction', 'Framing', 'Masonry', 'Maintenance', 'Facilities', 'Fabrication', 'Energy']) assert.equal(classifyIndustrySubmission(submission(value)).category, 'adjacent', value);
  for (const value of ['Air Pros', 'Service Solutions']) assert.equal(classifyIndustrySubmission(submission(value)).category, 'possible', value);
});
test('ordinary people names, arbitrary substrings and internal fields are not trade evidence', () => {
  for (const value of ['Chair Company', 'Mac', 'Scott', 'Coolingwood', 'Cheating', 'ABM']) assert.equal(classifyIndustrySubmission(submission(value)).category, 'unknown', value);
  for (const value of ['Air', 'AC', 'Mechanical', 'Mason', 'Electric']) assert.equal(classifyIndustrySubmission(submission(value, 'firstName')).category, 'unknown', value);
  for (const field of ['tags', 'owner', 'HVAC question']) assert.equal(classifyIndustrySubmission(submission('HVAC', field)).category, 'blank');
});
test('exclusive categories cover all cohort leads with direct precedence and one count across fields', () => {
  const both = { industryEvidenceAvailable: true, industryFields: [{field: 'companyName', value: 'Fixture Mechanical'}, {field: 'message', value: 'Electrical and AC'}] };
  const leads = [both, submission('Plumbing'), submission('Air Pros'), submission('Unspecified business'), submission('N/A'), {}, {companyEvidenceAvailable: true, companyName: 'Mechanical Pros'}].map(lead => ({ ...lead, stage: 'New' }));
  const summary = summarizeBuyerFit(leads);
  assert.deepEqual(summary.categories, { direct: 2, adjacent: 1, possible: 1, unknown: 1, blank: 1, unavailable: 1 });
  assert.equal(summary.potentialTrade, 3);
  assert.equal(summary.potentialTradePercentage, 3 / 7 * 100);
  assert.equal(summary.total, 7);
  assert.equal(summary.legacyCompanyOnly, 1);
  assert.equal(classifyIndustrySubmission(both).demandHits.length, 2);
  assert.equal(summarizeBuyerFit([{stage: 'New'}]).potentialTradePercentage, null);
  assert.equal(summarizeBuyerFit([]).potentialTradePercentage, null);
});
