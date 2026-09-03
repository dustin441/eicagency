import assert from 'node:assert/strict';
import test from 'node:test';

import { buildApprovedConfigRevision } from './config-revision.ts';
import { configWritePayload, signConfigWriteRequest } from './config-write-signature.ts';

const revision = buildApprovedConfigRevision({
  schemaVersion: 3,
  calculationVersion: 'v3',
  sourceContractVersion: 's3',
  clients: [{
    clientId: '44444444-4444-4444-8444-444444444444',
    clientKey: 'pending',
    displayName: 'Pending',
    dashboardHref: null,
    reportingTimezone: 'America/Phoenix',
    clickupListIds: [],
    marginAliases: [],
    configStatus: 'configuration_required',
    economics: {
      effectiveMonth: '2026-09-01',
      monthlyRetainer: null,
      deliveryModel: 'custom',
      fulfillmentHourlyCost: 46,
      targetMarginPercent: 80,
    },
    fixedValues: { monthlyBudget: null },
    northStarLanes: [],
    metrics: [],
    sources: [],
  }],
});
const request = {
  revisionId: revision.id, revisionHash: revision.hash, revision: revision.content,
  activationId: '11111111-1111-4111-8111-111111111111', reviewedCommitSha: 'a'.repeat(40),
  reason: 'Economics settings verification', expectedCurrentActivationId: null,
  operatorIdentity: 'prepass-auth:22222222-2222-4222-8222-222222222222',
  issuedAtUnixMs: 1_788_390_000_000, nonce: '33333333-3333-4333-8333-333333333333',
};

test('config write payload and HMAC are deterministic and bind every mutation field', () => {
  const secret = '11'.repeat(32);
  const signature = signConfigWriteRequest(request, secret);
  assert.match(signature, /^[0-9a-f]{64}$/);
  assert.equal(signature, signConfigWriteRequest(structuredClone(request), secret));
  assert.deepEqual(Object.keys(configWritePayload(request)).sort(), [
    'action','activationId','expectedCurrentActivationId','issuedAtUnixMs','nonce','operatorIdentity',
    'reason','reviewedCommitSha','revision','revisionHash','revisionId',
  ]);
  for (const [key, value] of Object.entries(request)) {
    const changed = structuredClone(request) as Record<string, unknown>;
    changed[key] = typeof value === 'number' ? value + 1 : value === null ? request.activationId : `${value}x`;
    assert.notEqual(signConfigWriteRequest(changed as typeof request, secret), signature, key);
  }
});

test('config write signing rejects malformed secrets and timestamps', () => {
  assert.throws(() => signConfigWriteRequest(request, 'secret'), /32 lowercase hex bytes/);
  assert.throws(() => signConfigWriteRequest({ ...request, issuedAtUnixMs: Number.MAX_VALUE }, '11'.repeat(32)), /safe integer/);
});
