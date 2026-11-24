import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const MediaSection = require('../components/NsiYtdMediaSection.tsx').default;
import { parseMediaSnapshot } from './nsi-ytd-media.ts';

const snapshot = (status = false) => parseMediaSnapshot(JSON.stringify({
  extractedAt: '2026-11-11T00:00:00Z',
  periods: { start: '2026-01-01', end: '2026-10-31', compStart: '2025-01-01', compEnd: '2025-10-31' },
  videos: [], notes: [],
  social: [{ id: 'synthetic', brand: 'Polaris', platform: 'Facebook', boostedIncluded: true, source: 'Synthetic native export', ...(status ? { followersStartStatus: 'not-launched' } : {}), current: { followersStart: status ? null : 100, followersEnd: 120, reach: null, engagements: 5, impressions: null, mediaViews: 30 }, previous: null }],
}));

test('prelaunch January renders status, unavailable growth and visible source qualification', () => {
  const html = renderToStaticMarkup(React.createElement(MediaSection, { data: snapshot(true) }));
  const social = html.split('id="nsi-ytd-video-title"')[0];
  assert.match(social, />Not launched<\/td>/);
  assert.match(social, />120<\/td><td[^>]*>Not available<\/td>/);
  assert.match(social, /January prelaunch is not a follower balance; net growth requires a verified launch balance/);
  assert.match(social, /Synthetic native export/);
  assert.match(social, /2026-11-11/);
  assert.match(social, /Includes boosted activity/);
  assert.doesNotMatch(html, /independently reverified in this finishing pass/);
});
test('legacy display retains numeric opening and endpoint growth without status', () => {
  const html = renderToStaticMarkup(React.createElement(MediaSection, { data: snapshot() }));
  assert.match(html, />100<\/td><td[^>]*>120<\/td><td[^>]*>20<\/td>/);
  assert.doesNotMatch(html, />Not launched<\/td>/);
});
