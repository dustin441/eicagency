import assert from 'node:assert/strict';
import {
  channelsForFocusQuery,
  combineRpcResponsesFailClosed,
  filterRowsForFocusChannel,
  platformMatchesFocusChannel,
  shouldUseUnfilteredAbmFleetTotals,
} from '../src/services/prepass-platform-normalization.ts';

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

// ABM also consolidates its persisted fb/ig aliases into Meta.
assert.equal(platformMatchesFocusChannel('fb', 'Meta', 'ABM'), true);
assert.equal(platformMatchesFocusChannel('ig', 'Meta', 'ABM'), true);
assert.equal(platformMatchesFocusChannel('ig', 'Meta', 'SMB'), false);
assert.equal(platformMatchesFocusChannel('Meta', 'Meta', 'ABM'), true);
assert.equal(platformMatchesFocusChannel('Meta', 'Meta', 'SMB'), true);

const rows = ['Google', 'Meta', 'fb', 'facebook', 'ig', 'instagram'].map((platform) => ({ platform }));
assert.deepEqual(
  filterRowsForFocusChannel(rows, 'Meta', 'FD360').map((row) => row.platform),
  ['Meta', 'fb', 'facebook', 'ig', 'instagram'],
);
assert.deepEqual(
  filterRowsForFocusChannel(rows, 'Meta', 'ABM').map((row) => row.platform),
  ['Meta', 'fb', 'facebook', 'ig', 'instagram'],
);
const rowsWithUnattributed = [...rows, { platform: 'Unattributed' }];
assert.deepEqual(
  filterRowsForFocusChannel(rowsWithUnattributed, null, 'ABM').map((row) => row.platform),
  ['Google', 'Meta', 'fb', 'facebook', 'ig', 'instagram'],
);
assert.deepEqual(
  filterRowsForFocusChannel(rowsWithUnattributed, null, 'SMB').map((row) => row.platform),
  ['Google', 'Meta', 'fb', 'facebook', 'ig', 'instagram'],
);
assert.deepEqual(
  filterRowsForFocusChannel(rowsWithUnattributed, null, 'FD360').map((row) => row.platform),
  ['Google', 'Meta', 'fb', 'facebook', 'ig', 'instagram', 'Unattributed'],
);
assert.throws(
  () => platformMatchesFocusChannel('Meta', 'Meta', 'FutureFocus'),
  /Unsupported PrePass focus: FutureFocus/,
);
assert.throws(
  () => filterRowsForFocusChannel(rows, null, 'FutureFocus'),
  /Unsupported PrePass focus: FutureFocus/,
);
assert.throws(
  () => channelsForFocusQuery(null, 'FutureFocus'),
  /Unsupported PrePass focus: FutureFocus/,
);
assert.deepEqual(channelsForFocusQuery('Meta', 'FD360'), ['Meta', 'fb', 'facebook', 'ig', 'instagram']);
assert.deepEqual(channelsForFocusQuery('Meta', 'ABM'), ['Meta', 'fb', 'facebook', 'ig', 'instagram']);
assert.deepEqual(channelsForFocusQuery('Meta', 'SMB'), ['Meta']);
assert.deepEqual(channelsForFocusQuery(null, 'ABM'), ['Google', 'Meta', 'fb', 'facebook', 'ig', 'instagram']);
assert.deepEqual(channelsForFocusQuery(null, 'SMB'), ['Google', 'Meta']);

const funnelRows = [
  { platform: 'Meta', mqls: 1, sqls: 1, won: 1 },
  { platform: 'fb', mqls: 2, sqls: 3, won: 4 },
  { platform: 'facebook', mqls: 11, sqls: 12, won: 13 },
  { platform: 'ig', mqls: 5, sqls: 6, won: 7 },
  { platform: 'instagram', mqls: 14, sqls: 15, won: 16 },
  { platform: 'Unattributed', mqls: 8, sqls: 9, won: 10 },
];
const sumStages = (focus) => {
  const queriedPlatforms = new Set(channelsForFocusQuery(null, focus));
  const queriedRows = funnelRows.filter((row) => queriedPlatforms.has(row.platform));
  const paidRows = filterRowsForFocusChannel(queriedRows, null, focus);
  const metaRows = paidRows.filter((row) => platformMatchesFocusChannel(row.platform, 'Meta', focus));
  return {
    paid: paidRows.reduce((totals, row) => ({
      mqls: totals.mqls + row.mqls,
      sqls: totals.sqls + row.sqls,
      won: totals.won + row.won,
    }), { mqls: 0, sqls: 0, won: 0 }),
    meta: metaRows.reduce((totals, row) => ({
      mqls: totals.mqls + row.mqls,
      sqls: totals.sqls + row.sqls,
      won: totals.won + row.won,
    }), { mqls: 0, sqls: 0, won: 0 }),
  };
};
assert.deepEqual(sumStages('ABM'), {
  paid: { mqls: 33, sqls: 37, won: 41 },
  meta: { mqls: 33, sqls: 37, won: 41 },
});
assert.deepEqual(sumStages('SMB'), {
  paid: { mqls: 1, sqls: 1, won: 1 },
  meta: { mqls: 1, sqls: 1, won: 1 },
});

assert.equal(shouldUseUnfilteredAbmFleetTotals('ABM', null), true);
assert.equal(shouldUseUnfilteredAbmFleetTotals('ABM', 'Meta'), false);
assert.equal(shouldUseUnfilteredAbmFleetTotals('ABM', 'Google'), false);
assert.equal(shouldUseUnfilteredAbmFleetTotals('FD360', null), false);

assert.deepEqual(
  combineRpcResponsesFailClosed([
    { data: [{ platform: 'Meta' }], error: null },
    { data: [{ platform: 'fb' }], error: null },
  ]),
  { data: [{ platform: 'Meta' }, { platform: 'fb' }], error: null },
);
const aliasFailure = { message: 'facebook alias RPC failed' };
assert.deepEqual(
  combineRpcResponsesFailClosed([
    { data: [{ platform: 'Meta' }], error: null },
    { data: null, error: aliasFailure },
  ]),
  { data: null, error: aliasFailure },
);

console.log('FD360 channel normalization checks passed');
