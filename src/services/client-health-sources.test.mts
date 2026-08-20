import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeClientName, parseCurrentMarginCsv } from './client-health-sources.ts';

test('client aliases normalize to dashboard client ids', () => {
  assert.equal(normalizeClientName('State Forty Eight'), 'state48');
  assert.equal(normalizeClientName('Scott - Arabella'), 'arabella');
  assert.equal(normalizeClientName('Infinite Health'), 'ihh');
  assert.equal(normalizeClientName('CBA AutoGlass'), 'cba');
});

test('current margin CSV uses hours and margin but does not treat blank-hour 100 percent as real', () => {
  const csv = [
    'Client,Amount,,Monthly Hours,Hourly $ by Client,Cost to Fullfill,Margin',
    'Prepass,"$25,000",,,,0,100.00%',
    'Spartaco,"$5,000",,12,"$417",552,88.96%',
    'NSI Electrical,"$6,800",,10,"$680",460,93.24%',
    'NSI Direct Electrical,"$1,500",,5,"$300",230,84.67%',
  ].join('\n');
  const parsed = parseCurrentMarginCsv(csv);
  assert.equal(parsed.get('prepass')?.marginPercent, null);
  assert.equal(parsed.get('prepass')?.sheetHours, null);
  assert.equal(parsed.get('spartaco')?.sheetHours, 12);
  assert.equal(parsed.get('spartaco')?.marginPercent, 88.96);
  assert.equal(parsed.get('nsi')?.sheetHours, 15);
  assert.ok(Math.abs((parsed.get('nsi')?.marginPercent ?? 0) - 91.6867) < 0.001);
});
