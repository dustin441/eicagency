import assert from 'node:assert/strict';
import fs from 'node:fs';
import { selectCreativeLeaders } from '../src/lib/creative-deep-dive.ts';

const salesLeaders = [
  { id: 'a', name: 'High revenue', spend: 100, impressions: 1000, clicks: 30, conversions: 3, revenue: 500 },
  { id: 'b', name: 'More purchases', spend: 100, impressions: 1000, clicks: 30, conversions: 5, revenue: 300 },
  { id: 'c', name: 'Immature outlier', spend: 1, impressions: 10, clicks: 1, conversions: 1, revenue: 100 },
];
assert.deepEqual(selectCreativeLeaders(salesLeaders, 'sales').map((leader) => leader.id), ['a', 'b']);

const leadLeaders = [
  { id: 'a', name: 'Efficient', spend: 100, impressions: 1000, clicks: 30, conversions: 10 },
  { id: 'b', name: 'Costly', spend: 100, impressions: 1000, clicks: 30, conversions: 2 },
  { id: 'c', name: 'No lead', spend: 20, impressions: 1000, clicks: 30, conversions: 0 },
  { id: 'd', name: 'Immature lead outlier', spend: 1, impressions: 10, clicks: 1, conversions: 1 },
];
assert.deepEqual(selectCreativeLeaders(leadLeaders, 'leads').map((leader) => leader.id), ['a', 'b']);

const trafficLeaders = [
  { id: 'a', name: 'High CTR', spend: 100, impressions: 1000, clicks: 80, conversions: 0 },
  { id: 'b', name: 'More clicks, lower CTR', spend: 100, impressions: 2000, clicks: 100, conversions: 0 },
  { id: 'c', name: 'No clicks', spend: 100, impressions: 3000, clicks: 0, conversions: 0 },
  { id: 'd', name: 'Immature CTR outlier', spend: 1, impressions: 1, clicks: 1, conversions: 0 },
];
assert.deepEqual(selectCreativeLeaders(trafficLeaders, 'traffic').map((leader) => leader.id), ['a', 'b']);

const engagementLeaders = [
  { id: 'a', name: 'Efficient engagement', spend: 100, impressions: 1000, clicks: 30, conversions: 0, engagements: 50 },
  { id: 'b', name: 'Costly engagement', spend: 100, impressions: 1000, clicks: 40, conversions: 0, engagements: 10 },
  { id: 'c', name: 'No engagement', spend: 100, impressions: 1000, clicks: 80, conversions: 0, engagements: 0 },
  { id: 'd', name: 'Immature engagement outlier', spend: 1, impressions: 10, clicks: 1, conversions: 0, engagements: 1 },
];
assert.deepEqual(selectCreativeLeaders(engagementLeaders, 'engagement').map((leader) => leader.id), ['a', 'b']);

const volumeLeaders = [
  { id: 'a', name: 'Efficient but lower volume', spend: 100, impressions: 1000, clicks: 30, conversions: 5 },
  { id: 'b', name: 'Higher volume', spend: 300, impressions: 3000, clicks: 90, conversions: 10 },
  { id: 'c', name: 'Immature outlier', spend: 1, impressions: 10, clicks: 1, conversions: 1 },
];
assert.deepEqual(selectCreativeLeaders(volumeLeaders, 'volume').map((leader) => leader.id), ['b', 'a']);

const root = new URL('../src/', import.meta.url);
const generic = fs.readFileSync(new URL('components/CreativeAnalysisClient.tsx', root), 'utf8');
const nsi = fs.readFileSync(new URL('components/NsiCreativeAnalysisClient.tsx', root), 'utf8');
const champagne = fs.readFileSync(new URL('components/ChampagneCreativeAnalysisClient.tsx', root), 'utf8');
const nsiService = fs.readFileSync(new URL('services/nsi-creative-analytics.ts', root), 'utf8');
const champagneService = fs.readFileSync(new URL('services/champagne-creative-analytics.ts', root), 'utf8');
const spartaco = fs.readFileSync(new URL('components/SpartacoCreativeAnalysisClient.tsx', root), 'utf8');
const prepass = fs.readFileSync(new URL('components/PrepassCreativeAnalysisClient.tsx', root), 'utf8');

for (const slug of ['kinsey', 'ihh', 'arabella', 'cba', 'bloom', 'durodyne']) {
  const page = fs.readFileSync(new URL(`app/dashboard/${slug}/creatives/page.tsx`, root), 'utf8');
  assert.match(page, /CreativeAnalysisClient/, `${slug} creative dashboard must use the generic rollout path`);
}

for (const [name, source] of [['generic', generic], ['nsi', nsi], ['champagne', champagne]]) {
  assert.match(source, /CreativeDeepDiveSections/, `${name} clients must use the shared Creative Deep Dive sections`);
}
for (const [name, service, client] of [
  ['nsi', nsiService, nsi],
  ['champagne', champagneService, champagne],
]) {
  assert.match(service, /engagements\?: number;/, `${name} Display creatives must preserve per-creative engagements`);
  assert.match(client, /engagements: creative\.engagements/, `${name} Display leaders must receive engagement counts`);
  assert.match(client, /objective="engagement"/, `${name} Display leaders must rank by engagement efficiency`);
}
assert.equal((nsi.match(/objective="volume"/g) ?? []).length, 2, 'NSI Search and LinkedIn must rank by outcome volume');
assert.equal((champagne.match(/objective="volume"/g) ?? []).length, 1, 'Champagne Search must rank by conversion volume');
assert.doesNotMatch(spartaco, /CreativeDeepDiveSections/, 'Spartaco must remain unchanged');
assert.doesNotMatch(prepass, /CreativeDeepDiveSections/, 'PrePass must remain unchanged');

const component = fs.readFileSync(new URL('components/CreativeDeepDiveSections.tsx', root), 'utf8');
for (const heading of [
  'Creative Director Brief',
  'What is working and what the team should make next',
  'Recommended action',
  'Priority Tests Next',
  'What is working now',
  'Current leaders and repeatable signals',
  'Creative Insights and Supporting Evidence',
]) {
  assert.match(component, new RegExp(heading), `missing heading: ${heading}`);
}

console.log('Verified objective-aware Creative Deep Dive rollout and Spartaco/PrePass exclusions.');
