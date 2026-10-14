import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import test from 'node:test';
import {
  buildExportRequest,
  checksum,
  consumeCsvStream,
  parseArgs,
  REQUIRED_CORE_FIELDS,
  resolveSmartListId,
  validateFieldDictionary,
  validatePopulation,
  validatePublicationArgs,
  validateSourceAgainstContract,
  validateSourceContract,
} from './prepass-marketo-mirror-sync.mjs';

test('consumeCsvStream hashes and stages bounded batches across arbitrary chunks', async () => {
  const csv = '\uFEFFid,updatedAt,email,notes\r\n101,2026-10-09T01:00:00Z,a@example.test,"line one\nline two"\r\n202,2026-10-09T02:00:00Z,,"quoted ""value"""\r\n';
  const bytes = Buffer.from(csv);
  const batches = [];
  const result = await consumeCsvStream(
    Readable.from([bytes.subarray(0, 7), bytes.subarray(7, 41), bytes.subarray(41, 79), bytes.subarray(79)]),
    async (batch) => batches.push(batch),
    1,
  );
  assert.equal(result.parsedCount, 2);
  assert.equal(result.uniqueCount, 2);
  assert.equal(result.sourceChecksum, checksum(csv));
  assert.deepEqual(batches.map((batch) => batch.length), [1, 1]);
  assert.equal(batches[0][0].notes, 'line one\nline two');
  assert.equal(batches[1][0].notes, 'quoted "value"');
  assert.equal(batches[1][0].email, '');
});

test('consumeCsvStream keeps staging batches bounded for a large lazy source', async () => {
  async function* source() {
    yield Buffer.from('id,updatedAt,customFutureField\n');
    for (let id = 1; id <= 10000; id += 1) {
      yield Buffer.from(`${id},2026-10-09T01:00:00Z,value-${id}\n`);
    }
  }
  let batches = 0;
  let maximumBatchSize = 0;
  const result = await consumeCsvStream(Readable.from(source()), async (batch) => {
    batches += 1;
    maximumBatchSize = Math.max(maximumBatchSize, batch.length);
  }, 250);
  assert.equal(result.parsedCount, 10000);
  assert.equal(result.uniqueCount, 10000);
  assert.equal(batches, 40);
  assert.equal(maximumBatchSize, 250);
});

test('consumeCsvStream rejects duplicate IDs without retaining full row objects', async () => {
  const csv = 'id,updatedAt\n101,2026-10-09T01:00:00Z\n101,2026-10-09T02:00:00Z\n';
  await assert.rejects(() => consumeCsvStream(Readable.from([Buffer.from(csv)])), /Duplicate Marketo ID/);
});

test('consumeCsvStream fails closed on malformed CSV structure', async () => {
  await assert.rejects(() => consumeCsvStream(Readable.from([Buffer.from('id,updatedAt\n101,"unterminated\n')])));
  await assert.rejects(() => consumeCsvStream(Readable.from([Buffer.from('id,id,updatedAt\n101,101,2026-10-09T01:00:00Z\n')])), /Duplicate Marketo CSV headers/);
  await assert.rejects(() => consumeCsvStream(Readable.from([Buffer.from('id,updatedAt\n101,2026-10-09T01:00:00Z,extra\n')])), /invalid/i);
});

test('consumeCsvStream rejects invalid IDs and timestamps', async () => {
  await assert.rejects(
    () => consumeCsvStream(Readable.from([Buffer.from('id,updatedAt\n,2026-10-09T01:00:00Z\n')])),
    /Invalid Marketo ID/,
  );
  await assert.rejects(
    () => consumeCsvStream(Readable.from([Buffer.from('id,updatedAt\n101,not-a-date\n')])),
    /Invalid updatedAt/,
  );
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

test('approved source contract is exact and publishing cannot override its smart-list ID', () => {
  const contract = validateSourceContract([{
    singleton: true,
    smart_list_id: 9001,
    smart_list_name: 'Reporting v2 | Full Marketo Snapshot',
    smart_list_rules_checksum: '1'.repeat(64),
    minimum_provider_count: 50000,
    maximum_drop_fraction: '0.2000',
  }]);
  assert.equal(contract.smartListId, 9001);
  assert.equal(contract.minimumProviderCount, 50000);
  validateSourceAgainstContract({
    smartListId: 9001,
    smartListName: 'Reporting v2 | Full Marketo Snapshot',
    smartListRulesChecksum: '1'.repeat(64),
  }, contract);
  assert.throws(() => validateSourceAgainstContract({
    smartListId: 9001,
    smartListName: 'Reporting v2 | Full Marketo Snapshot',
    smartListRulesChecksum: '2'.repeat(64),
  }, contract), /does not match approved contract/);
  assert.throws(() => validatePublicationArgs(parseArgs(['--smart-list-id', '9002'])), /dry-run only/);
  assert.doesNotThrow(() => validatePublicationArgs(parseArgs(['--dry-run', '--smart-list-id', '9002'])));
});

test('population gates reject empty and implausibly small snapshots', () => {
  assert.throws(() => validatePopulation(0, 1), /nonzero/);
  assert.throws(() => validatePopulation(49999, 50000), /below approved minimum/);
  assert.doesNotThrow(() => validatePopulation(50000, 50000));
});

test('incremental updatedAt window arguments are rejected', () => {
  assert.throws(() => parseArgs(['--start', '2026-10-01']), /Unknown argument/);
  assert.throws(() => parseArgs(['--end', '2026-10-02']), /Unknown argument/);
});
