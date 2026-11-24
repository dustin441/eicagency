import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createRequire } from 'node:module';
import * as media from './nsi-ytd-media.ts';
const require = createRequire(import.meta.url);
const MediaSection = require('../components/NsiYtdMediaSection.tsx').default;
const fixture = () => ({ extractedAt: '2026-11-11T00:00:00Z', periods: { start: '2026-01-01', end: '2026-10-31', compStart: '2025-01-01', compEnd: '2025-10-31' }, videos: [], notes: [], social: [{ id: 'synthetic', brand: 'Polaris', platform: 'Facebook', boostedIncluded: true, source: 'Synthetic export', current: { followersStart: null as number | null, followersEnd: null as number | null, reach: null, engagements: null, impressions: null, mediaViews: null }, previous: null, activity: { start: '2026-01-01', end: '2026-10-31', source: 'Synthetic Page Activity DAILY CSV', points: Array.from({ length: 304 }, (_, i) => ({ date: new Date(Date.UTC(2026, 0, i + 1)).toISOString().slice(0, 10), netFollows: i === 0 ? -4 : i === 303 ? 2 : 0 })), interactions: 7, views: 9, impressions: 11 } }] });
const parse = (value: unknown) => media.parseMediaSnapshot(JSON.stringify(value));
test('activity projection strips unknown fields and legacy shape remains exact', () => {
  const f = fixture(); Object.assign(f.social[0].activity, { secret: 'drop' }); Object.assign(f.social[0].activity.points[0], { secret: 'drop' });
  const row = parse(f).social[0]; assert.ok(row.activity); assert.equal('secret' in row.activity, false); assert.equal('secret' in row.activity.points[0], false);
  const legacy = fixture(); delete (legacy.social[0] as { activity?: unknown }).activity;
  assert.equal('activity' in parse(legacy).social[0], false);
  assert.deepEqual(parse(legacy).social[0], legacy.social[0]);
});
test('rejects bounds, duplicates, gaps, impossible dates, unsigned/count violations and follower stocks', () => {
  const mutations = [
    (f: ReturnType<typeof fixture>) => { f.social[0].activity.start = '2026-01-02'; },
    (f: ReturnType<typeof fixture>) => { f.social[0].activity.end = '2026-11-01'; },
    (f: ReturnType<typeof fixture>) => { f.social[0].activity.points.pop(); },
    (f: ReturnType<typeof fixture>) => { f.social[0].activity.points[1].date = '2026-01-01'; },
    (f: ReturnType<typeof fixture>) => { f.social[0].activity.points[59].date = '2026-02-30'; },
    (f: ReturnType<typeof fixture>) => { f.social[0].activity.points.reverse(); },
    ...[1.5, Number.MAX_SAFE_INTEGER + 1, '-4', null].map(value => (f: ReturnType<typeof fixture>) => { Object.assign(f.social[0].activity.points[0], { netFollows: value }); }),
    ...[-1, 1.5, Number.MAX_SAFE_INTEGER + 1, null].map(value => (f: ReturnType<typeof fixture>) => { Object.assign(f.social[0].activity, { views: value }); }),
    (f: ReturnType<typeof fixture>) => { Object.assign(f.social[0].current, { followersEnd: 10 }); },
    (f: ReturnType<typeof fixture>) => { Object.assign(f.social[0].current, { followersStart: 0 }); },
  ];
  for (const mutate of mutations) { const f = fixture(); mutate(f); assert.throws(() => parse(f)); }
});
test('relative cumulative and monthly sums preserve negative net changes', () => {
  const summary = media.summarizePageActivity(parse(fixture()).social[0].activity!);
  assert.equal(summary.baseline, 0); assert.equal(summary.points[0].cumulative, -4); assert.equal(summary.total, -2);
  assert.equal(summary.months.length, 10); assert.equal(summary.months[0].netFollows, -4); assert.equal(summary.months[9].netFollows, 2);
});
test('actual React SSR shows negative flow chart, daily titles, monthly export and untouched legacy stock UI', () => {
  const f = fixture(); const legacy = { ...f.social[0], id: 'legacy', brand: 'Bridgeport', current: { ...f.social[0].current, followersStart: 100, followersEnd: 120 } }; delete (legacy as { activity?: unknown }).activity; f.social.push(legacy);
  const html = renderToStaticMarkup(React.createElement(MediaSection, { data: parse(f) }));
  assert.match(html, /Net follower change, not total followers/); assert.match(html, /relative tracking baseline/); assert.match(html, /2026-01-01 to 2026-10-31/);
  assert.match(html, /Synthetic Page Activity DAILY CSV/); assert.match(html, /<svg/); assert.match(html, /data-zero-baseline/); assert.match(html, /2026-01-01: net -4, cumulative -4/);
  assert.match(html, /Monthly net follower change/); assert.match(html, /Total interactions/); assert.match(html, /print:hidden/);
  assert.match(html, />100<\/td><td[^>]*>120<\/td><td[^>]*>20<\/td>/);
  const stockTable = html.match(/<table[^>]*>[\s\S]*?<\/table>/)?.[0] ?? ''; assert.doesNotMatch(stockTable, /Polaris/);
});
