import assert from 'node:assert/strict';
import test from 'node:test';
import { buildExportRequest, checksum, normalizeRows, parseArgs, parseCsv, REQUIRED_CORE_FIELDS, resolveSmartListId, validateFieldDictionary } from './prepass-marketo-mirror-sync.mjs';

test('parseCsv preserves quoted commas, escaped quotes, and blank values', () => {
  const rows = parseCsv('\uFEFFid,updatedAt,email,utmcampaign\r\n101,2026-10-09T01:00:00Z,a@example.test,"Search, ABM"\r\n202,2026-10-09T02:00:00Z,,"A ""quoted"" campaign"\r\n');
  assert.deepEqual(rows, [
    { id: '101', updatedAt: '2026-10-09T01:00:00Z', email: 'a@example.test', utmcampaign: 'Search, ABM' },
    { id: '202', updatedAt: '2026-10-09T02:00:00Z', email: '', utmcampaign: 'A "quoted" campaign' },
  ]);
});

test('parseCsv fails closed on malformed structure', () => {
  assert.throws(() => parseCsv('id,email\n1,"unterminated'), /Unterminated/);
  assert.throws(() => parseCsv('id,id\n1,2\n'), /Duplicate/);
  assert.throws(() => parseCsv('id,email\n1,a,extra\n'), /expected 2/);
});

test('normalizeRows preserves the complete Marketo payload and rejects duplicate IDs', () => {
  const rows = normalizeRows([
    { id: '202', updatedAt: '2026-10-09T02:00:00Z', dateMQL: '', customFutureField: 'kept exactly' },
    { id: '101', updatedAt: '2026-10-09T01:00:00Z', dateMQL: '2026-10-07', customFutureField: '' },
  ]);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].id, '101');
  assert.equal(rows[1].id, '202');
  assert.equal(rows[1].dateMQL, '');
  assert.equal(rows[1].customFutureField, 'kept exactly');
  assert.equal(Object.hasOwn(rows[1], 'dateClosedWon'), false);
  assert.throws(() => normalizeRows([
    { id: '202', updatedAt: '2026-10-09T01:00:00Z' },
    { id: '202', updatedAt: '2026-10-09T02:00:00Z' },
  ]), /Duplicate Marketo ID/);
});

test('normalizeRows fails closed on missing IDs or updatedAt', () => {
  assert.throws(() => normalizeRows([{ id: '', updatedAt: '2026-10-09T01:00:00Z' }]), /Invalid Marketo ID/);
  assert.throws(() => normalizeRows([{ id: '101', updatedAt: '' }]), /Invalid updatedAt/);
});

test('checksum is deterministic', () => {
  assert.equal(checksum('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});

test('daily export is always scoped to the configured full-population smart list', () => {
  const args = parseArgs(['--smart-list-id', '98765', '--poll-seconds', '2']);
  assert.equal(args.smartListId, '98765');
  const fields = [...REQUIRED_CORE_FIELDS, 'futureCustomField'];
  const request = buildExportRequest(resolveSmartListId(args, {}), fields);
  assert.deepEqual(request.fields, fields);
  assert.equal(request.format, 'CSV');
  assert.deepEqual(request.filter, { smartListId: 98765 });
  assert.equal(Object.hasOwn(request.filter, 'updatedAt'), false);
});

test('live field dictionary must contain exact-case core fields and keeps new custom fields', () => {
  const descriptors = [...REQUIRED_CORE_FIELDS, 'futureCustomField'].map((name) => ({ name, dataType: 'string' }));
  const result = validateFieldDictionary(descriptors);
  assert.equal(result.names.length, descriptors.length);
  assert.ok(result.names.includes('FBCLID'));
  assert.ok(result.names.includes('futureCustomField'));
  assert.match(result.dictionaryChecksum, /^[0-9a-f]{64}$/);
  assert.throws(
    () => validateFieldDictionary(descriptors.filter((field) => field.name !== 'FBCLID').concat({ name: 'fbclid' })),
    /FBCLID/,
  );
});

test('smart-list ID is required and must be positive', () => {
  assert.throws(() => resolveSmartListId(parseArgs([]), {}), /PREPASS_MARKETO_FULL_SMART_LIST_ID/);
  assert.throws(() => resolveSmartListId(parseArgs(['--smart-list-id', '0']), {}), /positive integer/);
  assert.equal(resolveSmartListId(parseArgs([]), { PREPASS_MARKETO_FULL_SMART_LIST_ID: '123' }), 123);
});

test('incremental updatedAt window arguments are rejected', () => {
  assert.throws(() => parseArgs(['--start', '2026-10-01']), /Unknown argument/);
  assert.throws(() => parseArgs(['--end', '2026-10-02']), /Unknown argument/);
});
