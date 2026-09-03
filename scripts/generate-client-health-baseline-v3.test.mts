import assert from 'node:assert/strict';
import test from 'node:test';

import { artifact, revision } from './generate-client-health-baseline-v3.mts';

const EXPECTED_ID = '9db01287-2ffa-80bf-aaed-d45ec28ce4e4';
const EXPECTED_HASH = '9db012872ffa00bf6aedd45ec28ce4e47759022bd9bcd57dcc2174e9900432c4';

test('September 2 baseline has the reviewed immutable identity and exact 15-client roster', () => {
  assert.equal(revision.id, EXPECTED_ID);
  assert.equal(revision.hash, EXPECTED_HASH);
  assert.deepEqual(artifact.provenance.excluded, ['Canary', 'LiveWorld', 'EIC Agency']);
  assert.equal(revision.content.schemaVersion, 3);
  assert.equal(revision.content.clients.length, 15);
  assert.deepEqual(revision.content.clients.filter(({ configStatus }) => configStatus === 'approved').map(({ clientKey }) => clientKey).sort(), ['bloom','bridgeway','cba','ihh','spartaco','state48']);
});

test('baseline economics and multi-lane source contracts match reviewed decisions', () => {
  if (revision.content.schemaVersion !== 3) assert.fail('expected v3 revision');
  const clients = new Map(revision.content.clients.map((client) => [client.clientKey, client]));
  assert.deepEqual(clients.get('nsi')?.economics, { effectiveMonth:'2026-09-01', monthlyRetainer:12_300, deliveryModel:'custom', fulfillmentHourlyCost:46, targetMarginPercent:80 });
  assert.deepEqual(clients.get('aurit')?.economics, { effectiveMonth:'2026-09-01', monthlyRetainer:500, deliveryModel:'custom', fulfillmentHourlyCost:46, targetMarginPercent:80 });
  assert.deepEqual(clients.get('medibrane')?.economics, { effectiveMonth:'2026-09-01', monthlyRetainer:2_500, deliveryModel:'custom', fulfillmentHourlyCost:46, targetMarginPercent:80 });
  assert.equal(clients.get('durodyne')?.economics.monthlyRetainer, null);
  assert.equal(clients.get('cba')?.fixedValues.monthlyBudget, 2_000);
  const spartaco = clients.get('spartaco');
  assert.deepEqual(spartaco?.northStarLanes.map(({ key, sourceKeys }) => ({ key, sourceKeys })), [
    { key:'lead-cpl', sourceKeys:['leads'] }, { key:'sales-roas', sourceKeys:['sales'] },
  ]);
  assert.deepEqual(spartaco?.sources.flatMap((source) => source.provider === 'supabase'
    ? [{ sourceKey: source.sourceKey, relation: source.relation }]
    : []), [
    { sourceKey:'leads', relation:'client_health_spartaco_leads_daily' },
    { sourceKey:'sales', relation:'client_health_spartaco_sales_daily' },
  ]);
  assert.deepEqual(spartaco?.sources.filter(({ provider }) => provider === 'supabase')
    .map(({ permittedFactFields }) => permittedFactFields), [
    ['currentRows','previousRows'], ['currentRows','previousRows'],
  ]);
  assert.deepEqual(clients.get('cba')?.sources.find(({ sourceKey }) => sourceKey === 'performance')?.permittedFactFields,
    ['currentRows','monthSpend','previousRows']);
});
