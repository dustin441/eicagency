import test from 'node:test';
import assert from 'node:assert/strict';
import { enrichReviewedBusinesses } from './duroline-business-evidence.ts';
import { classifyIndustrySubmission } from './duroline-buyer-fit.ts';
import type { DurolineLead } from './duroline-pipeline-types.ts';
const lead = (email: string) => ({ id: 'fixture', name: 'Example', stage: 'Lead', companyName: 'Neutral business', companyEvidenceAvailable: true, industryEvidenceAvailable: true, industryFields: [{field: 'email', value: email}] }) as DurolineLead;
const records = [{domain: 'example.test',category: 'direct',description: 'Official site offers HVAC installation.',sourceUrl: 'https://example.test/services'}];
test('exact reviewed domain adds trade evidence without altering stages or source objects', () => {
 const original = lead('buyer@example.test');const result = enrichReviewedBusinesses([original], JSON.stringify(records));
 assert.equal(result[0].reviewedBusinessEvidence?.category, 'direct');assert.equal(result[0].stage, 'Lead');assert.equal('reviewedBusinessEvidence' in original, false);
 assert.equal(classifyIndustrySubmission(result[0]).category, 'direct');
});
test('subdomains, suffix spoofs, malformed emails and unavailable source evidence do not match', () => {
 for(const email of ['buyer@notexample.test','buyer@sub.example.test','buyer@example.test.evil.test','buyer@@example.test','buyer@example.test extra']) assert.equal(enrichReviewedBusinesses([lead(email)], JSON.stringify(records))[0].reviewedBusinessEvidence, undefined);
 const unavailable = {...lead('buyer@example.test'), industryEvidenceAvailable: false};assert.equal(enrichReviewedBusinesses([unavailable], JSON.stringify(records))[0].reviewedBusinessEvidence, undefined);
});
test('invalid, conflicted or missing private reviews cannot retain stale classifications', () => {
 const stale = {...lead('buyer@example.test'), reviewedBusinessEvidence: records[0]};
 for(const config of [undefined, 'bad json', '{}', JSON.stringify([...records, ...records]), JSON.stringify([{...records[0],sourceUrl:'javascript:alert(1)'}])]) assert.equal(enrichReviewedBusinesses([stale],config)[0].reviewedBusinessEvidence, undefined);
});
