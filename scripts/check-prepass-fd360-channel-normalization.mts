import assert from 'node:assert/strict';
import { channelsForFocusQuery, filterRowsForFocusChannel, platformMatchesFocusChannel } from '../src/services/prepass-platform-normalization.ts';

const fd360Platforms = ['Meta', 'meta', 'fb', 'FB', 'ig', 'Instagram', 'facebook'];
for (const platform of fd360Platforms) {
  assert.equal(
    platformMatchesFocusChannel(platform, 'Meta', 'FD360'),
    true,
    `FD360 must consolidate ${platform} into Meta`,
  );
}

assert.equal(platformMatchesFocusChannel('Google', 'Meta', 'FD360'), false);
assert.equal(platformMatchesFocusChannel('Google', 'Google', 'FD360'), true);

// ABM and SMB retain their existing exact platform rules in this change.
assert.equal(platformMatchesFocusChannel('fb', 'Meta', 'ABM'), false);
assert.equal(platformMatchesFocusChannel('ig', 'Meta', 'SMB'), false);
assert.equal(platformMatchesFocusChannel('Meta', 'Meta', 'ABM'), true);
assert.equal(platformMatchesFocusChannel('Meta', 'Meta', 'SMB'), true);

const rows = ['Google', 'Meta', 'fb', 'ig'].map((platform) => ({ platform }));
assert.deepEqual(
  filterRowsForFocusChannel(rows, 'Meta', 'FD360').map((row) => row.platform),
  ['Meta', 'fb', 'ig'],
);
assert.deepEqual(
  filterRowsForFocusChannel(rows, 'Meta', 'ABM').map((row) => row.platform),
  ['Meta'],
);
assert.deepEqual(channelsForFocusQuery('Meta', 'FD360'), ['Meta', 'fb', 'ig']);
assert.deepEqual(channelsForFocusQuery('Meta', 'ABM'), ['Meta']);
assert.deepEqual(channelsForFocusQuery('Meta', 'SMB'), ['Meta']);

console.log('FD360 channel normalization checks passed');
