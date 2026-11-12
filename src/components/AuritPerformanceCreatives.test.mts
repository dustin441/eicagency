import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { MetaAdPreviews } from './AdPreviews.tsx';
import type { MetaCreative } from '../services/analytics.ts';

const creatives: MetaCreative[] = Array.from({ length: 35 }, (_, i) => ({
  adId: `ad-${i}`, name: `Individual ad ${i}`, campaign: `Campaign ${i}`, adset: `Ad set ${i}`,
  headline: '', primaryText: '', finalCreativeLink: '', permanentImageUrl: '', destinationUrl: '',
  ctaType: '', isVideo: false, videoId: '', videoUrl: '', previewUrl: '', spend: 1, leads: 2, clicks: 3, impressions: 100,
}));
test('individual performance mode renders all ads including missing previews, with campaign and ad set context', () => {
  const html = renderToStaticMarkup(createElement(MetaAdPreviews, { creatives, previewLimit: null, showAdIdentity: true, conversionLabel: { conversion: 'Meta-reported Leads', cpa: 'Cost / Meta Lead' } }));
  assert.match(html, /Individual ad 34/);
  assert.match(html, /Campaign 34/);
  assert.match(html, /Ad set 34/);
  assert.match(html, /Meta-reported Leads/);
  assert.doesNotMatch(html, /Form Fills/);
});
test('existing galleries keep their default card limit', () => {
  const html = renderToStaticMarkup(createElement(MetaAdPreviews, { creatives }));
  assert.doesNotMatch(html, /Individual ad 34/);
});
test('Aurit performance mounts Meta gallery with honest source labels and Google-only empty state', () => {
  const source = readFileSync(new URL('./AuritDashboardClient.tsx', import.meta.url), 'utf8');
  assert.match(source, /<MetaAdPreviews/);
  assert.match(source, /previewLimit=\{null\}/);
  assert.match(source, /Meta-reported Leads/);
  assert.match(source, /not the completed website form submissions/);
  assert.match(source, /Google\/YouTube creative previews are not available/);
  assert.match(source, /data.filterParams.channel === 'Google'/);
  const analysis = readFileSync(new URL('../services/aurit-creative-analytics.ts', import.meta.url), 'utf8');
  assert.match(analysis, /aggregateMetaCreativesByIdentity\(Array.from\(byAd.values\(\)\)\)/);
});
