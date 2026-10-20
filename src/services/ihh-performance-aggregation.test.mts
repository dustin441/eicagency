import assert from 'node:assert/strict';
import test from 'node:test';

import {
  accumulateNullableMetric,
  ihhAdIdentityKey,
  ihhAdsetIdentityKey,
  latestIhhAdDisplayMetadata,
} from './ihh-performance-aggregation.ts';

test('ad identity prefers stable Meta ad ID', () => {
  assert.equal(
    ihhAdIdentityKey({ ad_id: '123', ad_name: 'Shared', adset_name: 'Shared', campaign_name: 'Campaign A' }),
    'id:123',
  );
  assert.equal(
    ihhAdIdentityKey({ ad_id: '123', ad_name: 'Renamed', adset_name: 'Other', campaign_name: 'Campaign B' }),
    'id:123',
  );
});

test('ad identity fallback separates reused names across campaigns and ad sets', () => {
  const first = ihhAdIdentityKey({ ad_name: 'Shared', adset_name: 'Audience', campaign_name: 'Campaign A' });
  const second = ihhAdIdentityKey({ ad_name: 'Shared', adset_name: 'Audience', campaign_name: 'Campaign B' });
  const third = ihhAdIdentityKey({ ad_name: 'Shared', adset_name: 'Different Audience', campaign_name: 'Campaign A' });
  assert.notEqual(first, second);
  assert.notEqual(first, third);
});

test('ad display metadata follows the latest non-empty labels', () => {
  const updated = latestIhhAdDisplayMetadata(
    { adName: 'Old ad', adsetName: 'Old ad set', campaignName: 'Old campaign' },
    { ad_id: '123', ad_name: 'New ad', adset_name: 'New ad set', campaign_name: 'New campaign' },
  );
  assert.deepEqual(updated, {
    adName: 'New ad',
    adsetName: 'New ad set',
    campaignName: 'New campaign',
  });
  assert.deepEqual(
    latestIhhAdDisplayMetadata(updated, { ad_id: '123', ad_name: '', adset_name: '', campaign_name: '' }),
    updated,
  );
});

test('ad-set fallback separates reused names across campaigns', () => {
  const first = ihhAdsetIdentityKey({ adset_name: 'Shared Audience', campaign_name: 'Campaign A' });
  const second = ihhAdsetIdentityKey({ adset_name: 'Shared Audience', campaign_name: 'Campaign B' });
  assert.notEqual(first, second);
});

test('nullable closer accumulation preserves missing-data state', () => {
  let state = { total: 0, complete: true };
  state = accumulateNullableMetric(state, 2);
  state = accumulateNullableMetric(state, null);
  state = accumulateNullableMetric(state, 3);
  assert.deepEqual(state, { total: 5, complete: false });
});
