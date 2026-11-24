import test from 'node:test';
import assert from 'node:assert/strict';
import { parseMediaSnapshot, followerGrowth } from './nsi-ytd-media.ts';
const fixture = () => ({ extractedAt: '2026-11-11T00:00:00Z', periods: { start: '2026-01-01', end: '2026-10-31', compStart: '2025-01-01', compEnd: '2025-10-31' }, videos: [{ id: 'synthetic-video', platform: 'Google Ads', label: 'YouTube placement', spendScope: 'placement', viewDefinition: 'TrueView views', source: 'Official API', current: { spend: 100, impressions: 1000, views: 80, thruplays: null, completeViews: null }, previous: { spend: 50, impressions: 500, views: 30, thruplays: null, completeViews: null } }], social: [{ id: 'synthetic-social', platform: 'Facebook', brand: 'Bridgeport', boostedIncluded: true, source: 'Native export', current: { followersStart: 100, followersEnd: 110, reach: 900, engagements: 30, impressions: null, mediaViews: null }, previous: null }], notes: ['Platform definitions differ.'] });
test('protected snapshot preserves real zero and unknown independently and strips extras', () => { const f = fixture(); f.videos[0].current.views = 0; const x = parseMediaSnapshot(JSON.stringify({ ...f, secret: 'never-project' })); assert.equal(x.videos[0].current?.views, 0); assert.equal(x.videos[0].current?.thruplays, null); assert.equal(x.social[0].previous, null); assert(!('secret' in x)); });
test('requires exact matched reporting windows', () => { const f = fixture(); f.periods.end = '2026-11-10'; assert.throws(() => parseMediaSnapshot(JSON.stringify(f)), /Invalid NSI YTD media snapshot/); });
test('rejects missing, nonfinite, negative, fractional counts and duplicate row IDs', () => { for (const value of [-1, 1.5, '2', undefined]) { const f = fixture(); (f.videos[0].current as Record<string, unknown>).views = value; assert.throws(() => parseMediaSnapshot(JSON.stringify(f))); } const f = fixture(); f.videos.push(f.videos[0]); assert.throws(() => parseMediaSnapshot(JSON.stringify(f))); });
test('rejects unknown platforms, malformed dates and incomplete metrics', () => { const f = fixture(); f.videos[0].platform = 'Other'; assert.throws(() => parseMediaSnapshot(JSON.stringify(f))); assert.throws(() => parseMediaSnapshot('{')); const g = fixture(); g.extractedAt = 'bad'; assert.throws(() => parseMediaSnapshot(JSON.stringify(g))); });
test('follower growth is an endpoint difference, never a sum of daily follower stocks', () => { assert.equal(followerGrowth({ followersStart: 100, followersEnd: 90 }), -10); assert.equal(followerGrowth({ followersStart: null, followersEnd: 90 }), null); assert.equal(followerGrowth({ followersStart: 0, followersEnd: 0 }), 0); });
test('ad-associated spend and impressions preserve the exact same selected-ad scope', () => { const f = fixture(); f.videos[0].platform = 'Meta'; f.videos[0].spendScope = 'ad'; const row = parseMediaSnapshot(JSON.stringify(f)).videos[0]; assert.equal(row.spendScope, 'ad'); assert.equal(row.current?.spend, 100); assert.equal(row.current?.impressions, 1000); assert.equal(row.previous?.thruplays, null); });
test('unknown delivery scope remains invalid', () => { const f = fixture(); f.videos[0].spendScope = 'guessed-video-only'; assert.throws(() => parseMediaSnapshot(JSON.stringify(f))); });
test('legacy snapshots remain unchanged without a baseline status', () => {
  const f = fixture();
  assert.deepEqual(parseMediaSnapshot(JSON.stringify(f)), f);
  assert.equal('followersStartStatus' in parseMediaSnapshot(JSON.stringify(f)).social[0], false);
});
test('protected not-launched status requires null opening balance and strips unknown fields', () => {
  const f = fixture();
  const row = { ...f.social[0], followersStartStatus: 'not-launched', internal: 'do-not-project', current: { ...f.social[0].current, followersStart: null, internal: 'do-not-project' } };
  const parsed = parseMediaSnapshot(JSON.stringify({ ...f, social: [row] })).social[0];
  assert.equal((parsed as unknown as Record<string, unknown>).followersStartStatus, 'not-launched');
  assert.equal(followerGrowth(parsed.current!), null);
  assert.equal('internal' in parsed, false);
  assert.equal('internal' in parsed.current!, false);
});
test('rejects malformed baseline status and contradictory opening balances', () => {
  for (const status of [null, '', 'launched', true, 0, {}, []]) {
    const f = fixture();
    assert.throws(() => parseMediaSnapshot(JSON.stringify({ ...f, social: [{ ...f.social[0], followersStartStatus: status }] })));
  }
  for (const followersStart of [0, 100]) {
    const f = fixture();
    assert.throws(() => parseMediaSnapshot(JSON.stringify({ ...f, social: [{ ...f.social[0], followersStartStatus: 'not-launched', current: { ...f.social[0].current, followersStart } }] })));
  }
  const f = fixture();
  assert.throws(() => parseMediaSnapshot(JSON.stringify({ ...f, social: [{ ...f.social[0], followersStartStatus: 'not-launched', current: null, previous: f.social[0].current }] })));
});
test('empty authorized snapshot is distinct from invented zero metrics', () => { const f = fixture(); const x = parseMediaSnapshot(JSON.stringify({ ...f, videos: [], social: [] })); assert.deepEqual(x.videos, []); assert.deepEqual(x.social, []); });
