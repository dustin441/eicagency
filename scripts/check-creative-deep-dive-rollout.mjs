import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  aggregateMetaCreativesByIdentity,
  findCreativeReference,
  isLowResolutionMetaThumbnail,
  metaPreviewKind,
  isTrustedYoutubeEmbedUrl,
  mergeCreativeReferencesById,
  selectCreativeLeaders,
  youtubeEmbedUrlFromThumbnail,
} from '../src/lib/creative-deep-dive.ts';
import { creativeDisplayName } from '../src/lib/creative-presentation.ts';

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

assert.equal(
  youtubeEmbedUrlFromThumbnail('https://img.youtube.com/vi/JMNUXv-iIAY/hqdefault.jpg'),
  'https://www.youtube.com/embed/JMNUXv-iIAY',
  'YouTube PMax thumbnails must resolve to playable embed URLs',
);
assert.equal(youtubeEmbedUrlFromThumbnail('https://example.com/image.jpg'), '', 'non-YouTube images must not become embeds');
assert.equal(
  youtubeEmbedUrlFromThumbnail('https://i.ytimg.com/vi_webp/JMNUXv-iIAY/maxresdefault.webp'),
  'https://www.youtube.com/embed/JMNUXv-iIAY',
  'YouTube WebP thumbnails must resolve to playable embed URLs',
);
assert.equal(isTrustedYoutubeEmbedUrl('https://www.youtube.com/embed/JMNUXv-iIAY'), true);
assert.equal(isTrustedYoutubeEmbedUrl('https://example.com/?next=youtube.com/embed/JMNUXv-iIAY'), false, 'iframe URLs must validate the exact YouTube origin');

const duplicateNameCandidates = [
  { id: 'meta-1', name: 'TOF3', platformName: 'TOF3', spend: 10, impressions: 100, clicks: 2, conversions: 0 },
  { id: 'meta-2', name: 'TOF3', platformName: 'TOF3', spend: 20, impressions: 200, clicks: 4, conversions: 1 },
  { id: 'meta-3', name: 'BOF', platformName: 'BOF', spend: 30, impressions: 300, clicks: 6, conversions: 2 },
];
assert.equal(findCreativeReference({ referenceCreativeId: 'meta-2', referenceCreativeName: 'TOF3' }, duplicateNameCandidates)?.id, 'meta-2', 'creative IDs must select the exact referenced ad');
assert.equal(findCreativeReference({ referenceCreativeName: 'TOF3' }, duplicateNameCandidates), null, 'ambiguous names must fail closed instead of opening an arbitrary preview');
assert.equal(findCreativeReference({ referenceCreativeName: 'BOF' }, duplicateNameCandidates)?.id, 'meta-3', 'a unique exact legacy name may still resolve');
assert.equal(findCreativeReference({ referenceCreativeName: 'TOF' }, duplicateNameCandidates), null, 'substring matches must never select a different creative');
assert.equal(findCreativeReference({}, duplicateNameCandidates), null, 'tests without a reference must never attach an arbitrary creative');
const mergedIdCandidates = mergeCreativeReferencesById([
  { id: 'same-ad', name: 'MOF2', imageUrl: 'https://example.com/poster.jpg', spend: 10, impressions: 100, clicks: 2, conversions: 0 },
  { id: 'same-ad', name: 'MOF2', imageUrl: 'https://example.com/poster-2.jpg', videoUrl: 'https://cdn.example.com/video.mp4', previewKind: 'video', spend: 20, impressions: 200, clicks: 4, conversions: 1 },
]);
assert.equal(mergedIdCandidates.length, 1, 'the frontend must expose one reference candidate per immutable ad ID');
assert.equal(mergedIdCandidates[0].videoUrl, 'https://cdn.example.com/video.mp4', 'ID aggregation must preserve the playable video variant');
assert.equal(mergedIdCandidates[0].spend, 30, 'ID aggregation must reconcile metrics across duplicated placements');
assert.equal(
  isLowResolutionMetaThumbnail('https://scontent.example/image.png?stp=c0.5_p64x64_q75'),
  true,
  'Meta 64px catalog thumbnails must not be stretched as full-size previews',
);
assert.equal(isLowResolutionMetaThumbnail('https://example.com/creative.png'), false);
assert.equal(
  metaPreviewKind('https://scontent.example/image.png?stp=c0.5_p64x64_q75', 'https://cdn.example.com/video.mp4', true),
  'video',
  'playable Meta video must take precedence over a small poster thumbnail',
);
assert.equal(
  metaPreviewKind('https://scontent.example/image.png?stp=c0.5_p64x64_q75', '', false),
  'catalog',
  'small non-video Meta catalog thumbnails must use the clean catalog state',
);
assert.equal(creativeDisplayName('BOF', '{{product.name}}'), 'BOF', 'unresolved dynamic-product tokens must not replace the real ad name');

const sameNameDifferentAds = [
  { name: 'Same name', campaign: 'Campaign', adset: 'Set', headline: '', primaryText: '', finalCreativeLink: 'https://example.com/a.jpg', destinationUrl: '', ctaType: '', isVideo: false, videoId: '', videoUrl: '', adId: 'ad-1', spend: 10, leads: 1, clicks: 2, impressions: 100 },
  { name: 'Same name', campaign: 'Campaign', adset: 'Set', headline: '', primaryText: '', finalCreativeLink: 'https://example.com/b.jpg', destinationUrl: '', ctaType: '', isVideo: false, videoId: '', videoUrl: '', adId: 'ad-2', spend: 20, leads: 2, clicks: 4, impressions: 200 },
  { name: 'Same name', campaign: 'Campaign', adset: 'Set', headline: '', primaryText: '', finalCreativeLink: 'https://example.com/a.jpg', destinationUrl: '', ctaType: '', isVideo: false, videoId: '', videoUrl: '', adId: 'ad-1', spend: 5, leads: 1, clicks: 1, impressions: 50 },
];
const separatedPreviews = aggregateMetaCreativesByIdentity(sameNameDifferentAds);
assert.equal(separatedPreviews.length, 2, 'same-named ads with different immutable IDs must keep separate previews');
assert.equal(separatedPreviews.find((creative) => creative.adId === 'ad-1')?.spend, 15, 'rows for the same immutable ad ID must still reconcile metrics');

const root = new URL('../src/', import.meta.url);
const generic = fs.readFileSync(new URL('components/CreativeAnalysisClient.tsx', root), 'utf8');
const adPreviews = fs.readFileSync(new URL('components/AdPreviews.tsx', root), 'utf8');
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
assert.equal((champagne.match(/objective="volume"/g) ?? []).length, 1, 'Champagne Meta recommendations must rank by lead volume');
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
  'Creative reference · click to preview',
]) {
  assert.match(component, new RegExp(heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `missing Good Game presentation behavior: ${heading}`);
}
assert.match(component, /concisePresentationCopy/, 'Shared sections must compact long insight copy like Good Game');
assert.match(component, /normalizePresentationCopy/, 'Shared sections must preserve normalized full copy for expansion');
assert.match(component, /data-creative-reference="true"/, 'Priority tests must expose clickable creative previews');
assert.doesNotMatch(component, /withImages\[index %/, 'Priority tests must never cycle through unrelated image creatives as fallback references');
assert.match(component, /<video/, 'signed Meta video URLs must render as playable video previews');
assert.match(component, /<iframe/, 'YouTube PMax assets must render as playable embeds');
assert.match(component, /previewKind === 'search'/, 'Google Search references must render a text-ad preview instead of an empty image state');
assert.match(component, /previewKind === 'text'/, 'PMax text references must render a text-asset preview instead of an empty image state');
assert.match(component, /externalPreviewUrl/, 'Meta references must retain a native-preview escape hatch');
assert.match(component, /previewKind === 'catalog'/, 'catalog ads must use a dedicated non-image preview state');
assert.match(component, /Catalog ads do not generate a fixed preview\./, 'catalog previews must explain the limitation without showing a broken image');
assert.match(adPreviews, /isCatalogPreview/, 'the native Meta gallery must identify catalog thumbnails before trying to render an image');
assert.match(adPreviews, /Catalog ads do not generate a fixed preview\./, 'the native Meta gallery must show the clean catalog notice');
assert.match(component, /group-open:rotate-180/, 'Expandable sections must use the same arrow behavior as Good Game');
assert.match(generic, /platformName:\s*creative\.name/, 'Meta candidates must preserve platform names for preview matching');
assert.doesNotMatch(component, /\.includes\('youtube\.com\/embed\/'\)/, 'YouTube iframe selection must not trust a substring');
assert.match(generic, /data\.referenceCreatives \?\? creatives/, 'Kinsey must be able to provide unaggregated ID-stable reference candidates');
assert.match(generic, /previewKind:\s*metaPreviewKind\(/, 'Kinsey Meta thumbnails must use the shared image/video/catalog classifier');
assert.match(generic, /videoUrl:\s*creative\.videoUrl/, 'Meta candidates must preserve playable video URLs');
assert.match(generic, /src=\{c\.videoUrl\}/, 'Kinsey PMax cards must render playable YouTube video URLs');
assert.equal((champagne.match(/<CreativeDeepDiveSections/g) ?? []).length, 1, 'Champagne must render one Meta-only creative deep dive');
assert.match(champagne, /insight=\{insights\.Meta\}/, 'Champagne creative recommendations must use only the Meta insight');
assert.doesNotMatch(champagne, /insights\.(?:Search|Display|PMax)/, 'Champagne Google channels must not render Meta-only recommendation sections');
assert.doesNotMatch(champagne, /AI Creative Insights/, 'Champagne must not add a standalone section absent from the InfiniteHeart structure');
const champagneMetaIndex = champagne.indexOf('{/* Meta */}');
const champagneSearchIndex = champagne.indexOf('{/* Search */}');
const champagneDisplayIndex = champagne.indexOf('{/* Display */}');
const champagnePmaxIndex = champagne.indexOf('{/* Performance Max */}');
assert.ok(
  champagneMetaIndex >= 0 && champagneMetaIndex < champagneSearchIndex && champagneSearchIndex < champagneDisplayIndex && champagneDisplayIndex < champagnePmaxIndex,
  'Champagne must follow the InfiniteHeart flow: Meta analysis/previews first, then Search, Display, and PMax',
);
assert.match(champagne, /id:\s*creative\.adId/, 'Champagne Meta insight references must preserve immutable ad IDs');
assert.match(champagne, /<GoogleAdPreviews/, 'Champagne must preserve Google Search previews after removing the incorrect analysis block');
assert.match(champagne, /<ImageGrid creatives=\{display\.creatives\}/, 'Champagne must preserve Display previews');
assert.match(champagne, /<ImageGrid creatives=\{pmax\.creatives\}/, 'Champagne must preserve PMax previews');
assert.match(champagneService, /aggregateMetaCreativesByIdentity/, 'Champagne Meta previews must remain separate by immutable ad identity');
assert.match(champagneService, /adId:\s*String\(r\.ad_id\s*\?\?\s*''\)/, 'Champagne Meta rows must preserve immutable ad_id before identity aggregation');
assert.match(generic, /metaPreviewKind\(imageUrl, creative\.videoUrl, creative\.isVideo\)/, 'generic Meta previews must classify playable video before catalog thumbnails');
assert.match(adPreviews, /!ad\.videoUrl\s*&&\s*isLowResolutionMetaThumbnail\(imageSrc\)/, 'native Meta cards must not classify playable videos as catalog');
const kinseyService = fs.readFileSync(new URL('services/kinsey-analytics.ts', root), 'utf8');
assert.match(kinseyService, /conversion_value/, 'Kinsey PMax must preserve conversion value from the source table');
assert.match(kinseyService, /conversions:\s*num\(a\.conversions\)/, 'Kinsey PMax must preserve conversions instead of zeroing them');
assert.match(component, /showLeaderCards\?:\s*boolean/, 'shared deep dive must expose targeted leader-card visibility');
assert.match(component, /showLeaderCards\s*&&/, 'leader-card visibility must not suppress What to carry forward evidence');
assert.equal((component.match(/Creative Director Brief/g) ?? []).length, 1, 'the brief must not be rendered a second time in a duplicate disclosure');

console.log('Verified Good Game presentation parity, objective-aware Meta rollout, and Google-only exclusions.');
