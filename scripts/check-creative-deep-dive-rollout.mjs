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
const champagneService = fs.readFileSync(new URL('services/champagne-creative-analytics.ts', root), 'utf8');
const spartaco = fs.readFileSync(new URL('components/SpartacoCreativeAnalysisClient.tsx', root), 'utf8');
const prepass = fs.readFileSync(new URL('components/PrepassCreativeAnalysisClient.tsx', root), 'utf8');
const ihhPage = fs.readFileSync(new URL('app/dashboard/ihh/creatives/page.tsx', root), 'utf8');
const ihhService = fs.readFileSync(new URL('services/ihh-analytics.ts', root), 'utf8');

for (const slug of ['kinsey', 'ihh', 'arabella', 'cba', 'bloom', 'durodyne']) {
  const page = fs.readFileSync(new URL(`app/dashboard/${slug}/creatives/page.tsx`, root), 'utf8');
  assert.match(page, /CreativeAnalysisClient/, `${slug} creative dashboard must use the generic rollout path`);
}

for (const [name, source] of [['generic', generic], ['champagne', champagne]]) {
  assert.match(source, /CreativeDeepDiveSections/, `${name} clients must use the shared Creative Deep Dive sections`);
}
assert.doesNotMatch(nsi, /CreativeDeepDiveSections/, 'NSI has no Meta channel and must keep its pre-rollout Google/LinkedIn insight cards');
assert.match(champagneService, /engagements\?: number;/, 'Champagne Display creatives must preserve per-creative engagements');
assert.match(champagne, /engagements: creative\.engagements/, 'Champagne Display leaders must receive engagement counts');
assert.match(champagne, /objective="engagement"/, 'Champagne Display leaders must rank by engagement efficiency');
assert.equal((champagne.match(/objective="volume"/g) ?? []).length, 1, 'Champagne Search must rank by conversion volume');
assert.match(champagne, /\.\.\.pmax\.textAssets\.map/, 'Champagne PMax text assets must be available for exact Priority Test references');
assert.match(champagne, /referenceOnly:\s*true/, 'PMax text references must not be ranked as visual leaders');
assert.doesNotMatch(spartaco, /CreativeDeepDiveSections/, 'Spartaco must remain unchanged');
assert.doesNotMatch(prepass, /CreativeDeepDiveSections/, 'PrePass must remain unchanged');

assert.match(ihhPage, /metricMode="leads"/, 'IHH Creative Deep Dive must use its Meta pixel funnel objective, not ecommerce revenue');
assert.match(ihhPage, /conversion:\s*'Pixel Scheduled'/, 'IHH must label its north-star creative outcome correctly');
assert.match(ihhPage, /cpa:\s*'Cost \/ Pixel Schedule'/, 'IHH must label its north-star cost correctly');
assert.match(ihhService, /existing\.leads \+= Number\(r\.scheduled_appointments \?\? 0\)/, 'IHH creative outcomes must use scheduled appointments');

const component = fs.readFileSync(new URL('components/CreativeDeepDiveSections.tsx', root), 'utf8');
for (const heading of [
  'Creative Director Brief',
  'What is working and what the team should make next',
  'Recommended action',
  'Priority Tests Next',
  'What is working now',
  'Current leaders and repeatable signals',
  'Creative Insights and Supporting Evidence',
  'Variable being isolated',
  'Why this priority',
  'Production details',
  'View full',
  'View full evidence',
  'Visual reference · click to preview',
]) {
  assert.match(component, new RegExp(heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `missing Good Game presentation behavior: ${heading}`);
}
assert.match(component, /concisePresentationCopy/, 'Shared sections must compact long insight copy like Good Game');
assert.match(component, /normalizePresentationCopy/, 'Shared sections must preserve normalized full copy for expansion');
assert.match(component, /data-creative-reference="true"/, 'Priority tests must expose clickable creative previews');
assert.match(component, /if \(!requested\) return null;/, 'Priority tests without an explicit creative reference must not attach an arbitrary creative');
assert.doesNotMatch(component, /withImages\[index %/, 'Priority tests must never cycle through unrelated image creatives as fallback references');
assert.match(component, /group-open:rotate-180/, 'Expandable sections must use the same arrow behavior as Good Game');
assert.match(generic, /platformName:\s*creative\.name/, 'Meta candidates must preserve platform names for preview matching');

console.log('Verified Good Game presentation parity, objective-aware Meta rollout, and Google-only exclusions.');
